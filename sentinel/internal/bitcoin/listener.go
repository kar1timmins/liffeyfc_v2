package bitcoin

import (
"context"
"encoding/json"
"fmt"
"log"
"time"

"github.com/gorilla/websocket"

"github.com/liffeyfc/sentinel/internal/publisher"
sentinelTypes "github.com/liffeyfc/sentinel/internal/types"
)

func mempoolWSURL(network string) string {
switch network {
case "testnet4":
return "wss://mempool.space/testnet4/api/v1/ws"
case "testnet":
return "wss://mempool.space/testnet/api/v1/ws"
default: // "mainnet"
return "wss://mempool.space/api/v1/ws"
}
}

// Listener monitors a Bitcoin address for incoming transactions using
// the mempool.space WebSocket API.
type Listener struct {
address string
wssURL  string
pub     *publisher.Publisher
}

// NewListener creates a Bitcoin listener for the given address and network.
// network should be "mainnet", "testnet4", or "testnet".
func NewListener(address, network string, pub *publisher.Publisher) *Listener {
return &Listener{
address: address,
wssURL:  mempoolWSURL(network),
pub:     pub,
}
}

// mempoolInput is a transaction input from the mempool.space JSON format.
type mempoolInput struct {
Prevout *mempoolOutput `json:"prevout"`
}

// mempoolOutput is a transaction output from the mempool.space JSON format.
type mempoolOutput struct {
ScriptpubkeyAddress string `json:"scriptpubkey_address"`
Value               int64  `json:"value"` // satoshis
}

// mempoolTx is a Bitcoin transaction from the mempool.space JSON format.
type mempoolTx struct {
Txid   string           `json:"txid"`
Vin    []mempoolInput   `json:"vin"`
Vout   []mempoolOutput  `json:"vout"`
Status struct {
Confirmed   bool   `json:"confirmed"`
BlockHeight uint64 `json:"block_height"`
} `json:"status"`
}

// mempoolMsg is the top-level envelope sent by mempool.space WebSocket.
type mempoolMsg struct {
// "address-transactions" fires for both unconfirmed and confirmed.
AddressTransactions []mempoolTx `json:"address-transactions"`
}

// Run starts the listener with exponential backoff on disconnect.
// It blocks until ctx is cancelled.
func (l *Listener) Run(ctx context.Context) error {
backoff := 2 * time.Second
for {
err := l.connectAndListen(ctx)
if ctx.Err() != nil {
return nil
}
log.Printf("[bitcoin] WebSocket disconnected: %v — reconnecting in %s", err, backoff)
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

func (l *Listener) connectAndListen(ctx context.Context) error {
dialer := websocket.Dialer{HandshakeTimeout: 15 * time.Second}
conn, _, err := dialer.DialContext(ctx, l.wssURL, nil)
if err != nil {
return fmt.Errorf("dial: %w", err)
}
defer conn.Close()
log.Printf("[bitcoin] Connected to %s", l.wssURL)

// Initialise the mempool.space session.
if err := conn.WriteJSON(map[string]any{"action": "init"}); err != nil {
return fmt.Errorf("send init: %w", err)
}

// Subscribe to transaction events for our platform address.
if err := conn.WriteJSON(map[string]any{
"action": "watch-address",
"data":   l.address,
}); err != nil {
return fmt.Errorf("send watch-address: %w", err)
}
log.Printf("[bitcoin] Watching address %s", l.address)

// Background goroutine closes the connection when the context is cancelled
// so that the blocking ReadMessage call below unblocks.
done := make(chan struct{})
go func() {
select {
case <-ctx.Done():
_ = conn.WriteControl(
websocket.CloseMessage,
websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""),
time.Now().Add(2*time.Second),
)
case <-done:
}
}()
defer close(done)

// Track txids we have already published to avoid duplicates when a
// transaction transitions from unconfirmed → confirmed.
seen := make(map[string]bool)

for {
_, rawMsg, err := conn.ReadMessage()
if err != nil {
if ctx.Err() != nil {
return nil
}
return fmt.Errorf("read: %w", err)
}

var msg mempoolMsg
if err := json.Unmarshal(rawMsg, &msg); err != nil {
continue // not an address-transactions message; ignore
}
for _, tx := range msg.AddressTransactions {
// Only emit once per confirmation state (unconfirmed, then confirmed).
key := fmt.Sprintf("%s-%v", tx.Txid, tx.Status.Confirmed)
if seen[key] {
continue
}
seen[key] = true
l.handleTx(ctx, tx)
}
}
}

func (l *Listener) handleTx(ctx context.Context, tx mempoolTx) {
// Sum all outputs paying to our address.
var totalSats int64
for _, out := range tx.Vout {
if out.ScriptpubkeyAddress == l.address {
totalSats += out.Value
}
}
if totalSats == 0 {
return // nothing directed to us
}

// Best-effort sender: first vin prevout with a known address.
senderAddr := "unknown"
for _, in := range tx.Vin {
if in.Prevout != nil && in.Prevout.ScriptpubkeyAddress != "" {
senderAddr = in.Prevout.ScriptpubkeyAddress
break
}
}

event := &sentinelTypes.NativePaymentEvent{
EventType:       "NATIVE_PAYMENT_RECEIVED",
Chain:           "bitcoin",
TransactionHash: tx.Txid,
SenderAddress:   senderAddr,
ReceiverAddress: l.address,
Amount:          formatSatoshis(totalSats),
CurrencySymbol:  "BTC",
RawAmount:       fmt.Sprintf("%d", totalSats),
Confirmed:       tx.Status.Confirmed,
BlockNumber:     tx.Status.BlockHeight,
Timestamp:       time.Now().UTC(),
}

log.Printf("[bitcoin] Incoming payment detected: %s BTC from=%s tx=%s confirmed=%v",
event.Amount, senderAddr, tx.Txid, tx.Status.Confirmed)

if err := l.pub.Publish(ctx, publisher.ChannelNativePayments, event); err != nil {
log.Printf("[bitcoin] publish error: %v", err)
}
}

// formatSatoshis converts a satoshi integer to a human-readable BTC string.
func formatSatoshis(sats int64) string {
return fmt.Sprintf("%.8f", float64(sats)/1e8)
}
