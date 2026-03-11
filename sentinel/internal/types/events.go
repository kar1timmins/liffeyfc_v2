package types

import "time"

// X402PaymentEvent is published to channel:x402_payments when the sentinel
// detects a USDC transfer to the platform receiver address.
type X402PaymentEvent struct {
	EventType       string    `json:"eventType"` // "X402_PAYMENT_DETECTED"
	Chain           string    `json:"chain"`     // "ethereum_sepolia" | "avalanche_fuji"
	TransactionHash string    `json:"transactionHash"`
	SenderAddress   string    `json:"senderAddress"`
	ReceiverAddress string    `json:"receiverAddress"`
	AmountUSDC      string    `json:"amountUSDC"` // human-readable, e.g. "10.000000"
	RawAmount       string    `json:"rawAmount"`  // raw 6-decimal string
	BlockNumber     uint64    `json:"blockNumber"`
	Timestamp       time.Time `json:"timestamp"`
}

// NativePaymentEvent is published to channel:native_payments when the sentinel
// detects an on-chain payment (BTC or XLM/USDC on Stellar) to a monitored address.
type NativePaymentEvent struct {
	EventType       string    `json:"eventType"` // "NATIVE_PAYMENT_RECEIVED"
	Chain           string    `json:"chain"`     // "bitcoin" | "stellar"
	TransactionHash string    `json:"transactionHash"`
	SenderAddress   string    `json:"senderAddress"`
	ReceiverAddress string    `json:"receiverAddress"`
	Amount          string    `json:"amount"`         // human-readable (e.g. "0.001")
	CurrencySymbol  string    `json:"currencySymbol"` // "BTC", "XLM", "USDC"
	RawAmount       string    `json:"rawAmount"`      // satoshis or stroops
	Confirmed       bool      `json:"confirmed"`      // false = mempool only
	BlockNumber     uint64    `json:"blockNumber"`
	Timestamp       time.Time `json:"timestamp"`
}

// EscrowContributionEvent is published to channel:escrow_contributions when
// the sentinel detects a ContributionReceived event on a known escrow contract.
type EscrowContributionEvent struct {
	EventType          string    `json:"eventType"` // "ESCROW_CONTRIBUTION_RECEIVED"
	Chain              string    `json:"chain"`     // "ethereum_sepolia" | "avalanche_fuji"
	ContractAddress    string    `json:"contractAddress"`
	TransactionHash    string    `json:"transactionHash"`
	ContributorAddress string    `json:"contributorAddress"`
	AmountNative       string    `json:"amountNative"`      // human-readable ETH/AVAX
	AmountEurEstimate  float64   `json:"amountEurEstimate"` // 0 if not available
	TotalRaisedNow     string    `json:"totalRaisedNow"`    // human-readable
	IsTargetMet        bool      `json:"isTargetMet"`
	BlockNumber        uint64    `json:"blockNumber"`
	Timestamp          time.Time `json:"timestamp"`
}
