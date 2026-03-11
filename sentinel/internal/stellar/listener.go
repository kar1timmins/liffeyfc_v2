package stellar

import (
"bufio"
"context"
"encoding/json"
"fmt"
"log"
"net/http"
"strings"
"time"

"github.com/liffeyfc/sentinel/internal/publisher"
sentinelTypes "github.com/liffeyfc/sentinel/internal/types"
)

// Listener monitors a Stellar account for incoming payment operations using
// the Horizon server-sent events (SSE) streaming API. No external SDK required —
// Horizon's SSE endpoint is standard HTTP with text/event-stream content-type.
type Listener struct {
address    string
horizonURL string
pub        *publisher.Publisher
}

// NewListener creates a Stellar listener.
// horizonURL defaults to the Stellar testnet Horizon if empty.
func NewListener(address, horizonURL string, pub *publisher.Publisher) *Listener {
if horizonURL == "" {
horizonURL = "https://horizon-testnet.stellar.org"
}
return &Listener{
address:    address,
horizonURL: strings.TrimRight(horizonURL, "/"),
pub:        pub,
}
}

// Run starts the Stellar listener loop with exponential backoff on error.
func (l *Listener) Run(ctx context.Context) error {
backoff := 2 * time.Second
for {
err := l.connectAndStream(ctx)
if ctx.Err() != nil {
return nil
}
log.Printf("[stellar] Stream disconnected: %v — reconnecting in %s", err, backoff)
select {
case <-time.After(backoff):
case <-ctx.Done():
return nil
}
if backoff < 60*time.Second {
backoff *= 2
}
}
}

// horizonOperation holds the fields we care about from a Horizon payment or
// create_account operation. Fields are a union of both operation types.
type horizonOperation struct {
Type                   string `json:"type"`
ID                     string `json:"id"`
TransactionHash        string `json:"transaction_hash"`
TransactionSuccessful  bool   `json:"transaction_successful"`
// payment
From        string `json:"from"`
To          string `json:"to"`
Amount      string `json:"amount"`
AssetType   string `json:"asset_type"`  // "native", "credit_alphanum4", "credit_alphanum12"
AssetCode   string `json:"asset_code"`  // e.g. "USDC"
AssetIssuer string `json:"asset_issuer"`
// create_account
Account         string `json:"account"`
StartingBalance string `json:"starting_balance"`
}

func (l *Listener) connectAndStream(ctx context.Context) error {
// cursor=now means "start from the next operation going forward".
// Horizon streams each operation as a text/event-stream data event.
streamURL := fmt.Sprintf("%s/accounts/%s/payments?cursor=now&limit=200",
l.horizonURL, l.address)

req, err := http.NewRequestWithContext(ctx, http.MethodGet, streamURL, nil)
if err != nil {
return fmt.Errorf("build request: %w", err)
}
req.Header.Set("Accept", "text/event-stream")

client := &http.Client{} // no timeout — SSE is long-lived
resp, err := client.Do(req)
if err != nil {
return fmt.Errorf("connect to Horizon: %w", err)
}
defer resp.Body.Close()

if resp.StatusCode != http.StatusOK {
return fmt.Errorf("unexpected HTTP %d from Horizon SSE", resp.StatusCode)
}

log.Printf("[stellar] Streaming payments for account %s via %s", l.address, l.horizonURL)

scanner := bufio.NewScanner(resp.Body)
for scanner.Scan() {
line := scanner.Text()

// SSE lines beginning with "data:" carry the JSON payload.
if !strings.HasPrefix(line, "data: ") {
continue
}
data := strings.TrimPrefix(line, "data: ")

// Horizon sends "hello" and "byebye" as connection lifecycle messages.
if data == `"hello"` || data == `"byebye"` || data == "" {
continue
}

var op horizonOperation
if err := json.Unmarshal([]byte(data), &op); err != nil {
log.Printf("[stellar] JSON parse error: %v", err)
continue
}

if !op.TransactionSuccessful {
continue
}

l.handleOperation(ctx, op)
}

if err := scanner.Err(); err != nil {
if ctx.Err() != nil {
return nil
}
return fmt.Errorf("SSE scanner: %w", err)
}
return nil
}

func (l *Listener) handleOperation(ctx context.Context, op horizonOperation) {
var amount, rawAmount, currency, senderAddr string

switch op.Type {
case "payment":
if op.To != l.address {
return // not directed to us
}
senderAddr = op.From
amount = op.Amount

if op.AssetType == "native" {
currency = "XLM"
rawAmount = fmt.Sprintf("%d", xlmToStroops(op.Amount))
} else {
// Issued asset (e.g. USDC on Stellar)
currency = op.AssetCode
rawAmount = op.Amount
}

case "create_account":
// XLM sent as initial balance to a new account.
if op.Account != l.address {
return
}
senderAddr = op.From
amount = op.StartingBalance
currency = "XLM"
rawAmount = fmt.Sprintf("%d", xlmToStroops(op.StartingBalance))

default:
return // skip other operation types (path_payment, manage_offer, etc.)
}

event := &sentinelTypes.NativePaymentEvent{
EventType:       "NATIVE_PAYMENT_RECEIVED",
Chain:           "stellar",
TransactionHash: op.TransactionHash,
SenderAddress:   senderAddr,
ReceiverAddress: l.address,
Amount:          amount,
CurrencySymbol:  currency,
RawAmount:       rawAmount,
Confirmed:       true, // Horizon only streams confirmed ledger operations
BlockNumber:     0,    // Stellar uses ledger sequences, not block numbers
Timestamp:       time.Now().UTC(),
}

log.Printf("[stellar] Incoming %s payment: %s %s from=%s tx=%s",
op.Type, amount, currency, senderAddr, op.TransactionHash)

if err := l.pub.Publish(ctx, publisher.ChannelNativePayments, event); err != nil {
log.Printf("[stellar] publish error: %v", err)
}
}

// xlmToStroops converts a decimal XLM amount string (7 decimal places) to
// the integer stroops representation (1 XLM = 10,000,000 stroops).
func xlmToStroops(xlm string) int64 {
var f float64
fmt.Sscanf(xlm, "%f", &f)
return int64(f * 10_000_000)
}
