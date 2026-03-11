package solana

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gagliardetto/solana-go/rpc/ws"

	"github.com/liffeyfc/sentinel/internal/publisher"
	sentinelTypes "github.com/liffeyfc/sentinel/internal/types"
)

// Listener watches Solana for USDC SPL token transfers to the platform ATA.
type Listener struct {
	wssURL         string
	httpRPC        string
	usdcMint       solana.PublicKey
	platformWallet solana.PublicKey
	platformATA    solana.PublicKey
	pub            *publisher.Publisher
}

// NewListener creates a Solana listener. It derives the platform ATA for the
// configured USDC mint and platform wallet at startup.
func NewListener(wssURL, httpRPC, usdcMintStr, platformWalletStr string, pub *publisher.Publisher) (*Listener, error) {
	mint, err := solana.PublicKeyFromBase58(usdcMintStr)
	if err != nil {
		return nil, fmt.Errorf("invalid SOLANA_USDC_MINT: %w", err)
	}
	wallet, err := solana.PublicKeyFromBase58(platformWalletStr)
	if err != nil {
		return nil, fmt.Errorf("invalid SOLANA_PLATFORM_WALLET: %w", err)
	}

	// Derive the Associated Token Account for the platform wallet + USDC mint.
	ata, _, err := solana.FindAssociatedTokenAddress(wallet, mint)
	if err != nil {
		return nil, fmt.Errorf("derive ATA: %w", err)
	}

	return &Listener{
		wssURL:         wssURL,
		httpRPC:        httpRPC,
		usdcMint:       mint,
		platformWallet: wallet,
		platformATA:    ata,
		pub:            pub,
	}, nil
}

// Run starts the Solana listener loop with reconnect on error.
func (l *Listener) Run(ctx context.Context) error {
	backoff := 2 * time.Second
	for {
		err := l.connectAndListen(ctx)
		if ctx.Err() != nil {
			return nil
		}
		log.Printf("[solana] WebSocket disconnected: %v — reconnecting in %s", err, backoff)
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
	client, err := ws.Connect(ctx, l.wssURL)
	if err != nil {
		return fmt.Errorf("ws connect: %w", err)
	}
	defer client.Close()

	// Subscribe to logs mentioning the USDC mint program.
	sub, err := client.LogsSubscribeMentions(l.usdcMint, rpc.CommitmentConfirmed)
	if err != nil {
		return fmt.Errorf("logs subscribe: %w", err)
	}
	defer sub.Unsubscribe()

	log.Printf("[solana] Subscribed to USDC mint logs — ATA=%s", l.platformATA.String())

	for {
		select {
		case <-ctx.Done():
			return nil
		default:
		}

		result, err := sub.Recv()
		if err != nil {
			return fmt.Errorf("sub recv: %w", err)
		}
		if result == nil || result.Value.Err != nil {
			continue
		}

		sig := result.Value.Signature
		go l.fetchAndHandle(ctx, sig.String())
	}
}

func (l *Listener) fetchAndHandle(ctx context.Context, sigStr string) {
	httpClient := rpc.New(l.httpRPC)

	sig, err := solana.SignatureFromBase58(sigStr)
	if err != nil {
		return
	}

	maxVersion := uint64(0)
	tx, err := httpClient.GetTransaction(ctx, sig, &rpc.GetTransactionOpts{
		MaxSupportedTransactionVersion: &maxVersion,
		Commitment:                     rpc.CommitmentConfirmed,
	})
	if err != nil || tx == nil {
		log.Printf("[solana] GetTransaction error for %s: %v", sigStr, err)
		return
	}

	// Look for a token balance delta on our platform ATA.
	meta := tx.Meta
	if meta == nil {
		return
	}

	delta := l.computeATADelta(tx)
	if delta <= 0 {
		return // no USDC received
	}

	// Attempt to identify sender from pre-token balances.
	senderATA := l.findSenderATA(tx)

	event := &sentinelTypes.X402PaymentEvent{
		EventType:       "X402_PAYMENT_DETECTED",
		Chain:           "solana",
		TransactionHash: sigStr,
		SenderAddress:   senderATA,
		ReceiverAddress: l.platformATA.String(),
		AmountUSDC:      fmt.Sprintf("%.6f", float64(delta)/1e6),
		RawAmount:       fmt.Sprintf("%d", delta),
		BlockNumber:     uint64(tx.Slot),
		Timestamp:       time.Now().UTC(),
	}

	log.Printf("[solana] USDC received: amount=%s sig=%s", event.AmountUSDC, sigStr)

	if err := l.pub.Publish(ctx, publisher.ChannelX402Payments, event); err != nil {
		log.Printf("[solana] publish error: %v", err)
	}
}

// computeATADelta returns the increase in USDC balance on the platform ATA
// across the transaction (post - pre). Returns 0 if no relevant change.
func (l *Listener) computeATADelta(tx *rpc.GetTransactionResult) int64 {
	meta := tx.Meta
	if meta == nil {
		return 0
	}

	ataStr := l.platformATA.String()

	// GetTransaction serialises pre/post token balances as JSON — parse them.
	preRaw, _ := json.Marshal(meta.PreTokenBalances)
	postRaw, _ := json.Marshal(meta.PostTokenBalances)

	type tokenBalance struct {
		AccountIndex  int    `json:"accountIndex"`
		Mint          string `json:"mint"`
		UITokenAmount struct {
			Amount string `json:"amount"`
		} `json:"uiTokenAmount"`
	}

	var pre, post []tokenBalance
	_ = json.Unmarshal(preRaw, &pre)
	_ = json.Unmarshal(postRaw, &post)

	// Resolve account index for platform ATA from the transaction account keys.
	decoded, err := tx.Transaction.GetTransaction()
	if err != nil {
		return 0
	}
	msg := decoded.Message
	var platformIdx int = -1
	for i, key := range msg.AccountKeys {
		if key.String() == ataStr {
			platformIdx = i
			break
		}
	}
	if platformIdx < 0 {
		return 0
	}

	var preAmt, postAmt int64
	for _, b := range pre {
		if b.AccountIndex == platformIdx {
			fmt.Sscanf(b.UITokenAmount.Amount, "%d", &preAmt)
		}
	}
	for _, b := range post {
		if b.AccountIndex == platformIdx {
			fmt.Sscanf(b.UITokenAmount.Amount, "%d", &postAmt)
		}
	}
	return postAmt - preAmt
}

// findSenderATA attempts to identify the sending token account by looking for
// a USDC account whose balance decreased in the transaction.
func (l *Listener) findSenderATA(tx *rpc.GetTransactionResult) string {
	meta := tx.Meta
	if meta == nil {
		return "unknown"
	}

	mintStr := l.usdcMint.String()
	ataStr := l.platformATA.String()

	decoded, err := tx.Transaction.GetTransaction()
	if err != nil {
		return "unknown"
	}
	accounts := decoded.Message.AccountKeys

	type tokenBalance struct {
		AccountIndex  int    `json:"accountIndex"`
		Mint          string `json:"mint"`
		UITokenAmount struct {
			Amount string `json:"amount"`
		} `json:"uiTokenAmount"`
	}

	preRaw, _ := json.Marshal(meta.PreTokenBalances)
	postRaw, _ := json.Marshal(meta.PostTokenBalances)
	var pre, post []tokenBalance
	_ = json.Unmarshal(preRaw, &pre)
	_ = json.Unmarshal(postRaw, &post)

	preMap := make(map[int]int64)
	for _, b := range pre {
		if b.Mint == mintStr {
			var amt int64
			fmt.Sscanf(b.UITokenAmount.Amount, "%d", &amt)
			preMap[b.AccountIndex] = amt
		}
	}

	for _, b := range post {
		if b.Mint != mintStr {
			continue
		}
		var postAmt int64
		fmt.Sscanf(b.UITokenAmount.Amount, "%d", &postAmt)
		preAmt := preMap[b.AccountIndex]
		if postAmt < preAmt && b.AccountIndex < len(accounts) {
			addr := accounts[b.AccountIndex].String()
			if addr != ataStr {
				return addr
			}
		}
	}
	return "unknown"
}
