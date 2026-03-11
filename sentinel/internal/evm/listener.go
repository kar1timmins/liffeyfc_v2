package evm

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/liffeyfc/sentinel/internal/publisher"
	sentinelTypes "github.com/liffeyfc/sentinel/internal/types"
)

// ABI fragments for the events we watch.
const usdcTransferABIJSON = `[{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"}]`

const contributionABIJSON = `[{"anonymous":false,"inputs":[{"indexed":true,"name":"contributor","type":"address"},{"indexed":false,"name":"amount","type":"uint256"},{"indexed":false,"name":"totalRaised","type":"uint256"}],"name":"ContributionReceived","type":"event"}]`

const escrowCreatedABIJSON = `[{"anonymous":false,"inputs":[{"indexed":true,"name":"escrowAddress","type":"address"},{"indexed":true,"name":"company","type":"address"},{"indexed":false,"name":"targetAmount","type":"uint256"},{"indexed":false,"name":"deadline","type":"uint256"},{"indexed":false,"name":"timestamp","type":"uint256"},{"indexed":false,"name":"campaignName","type":"string"},{"indexed":false,"name":"campaignDescription","type":"string"},{"indexed":false,"name":"wishlistItemId","type":"string"}],"name":"EscrowCreated","type":"event"}]`

var (
	transferSig     = crypto.Keccak256Hash([]byte("Transfer(address,address,uint256)"))
	contributionSig = crypto.Keccak256Hash([]byte("ContributionReceived(address,uint256,uint256)"))
	escrowCreatedSig = crypto.Keccak256Hash([]byte("EscrowCreated(address,address,uint256,uint256,uint256,string,string,string)"))
)

// Listener connects to an EVM chain via WebSocket and publishes events to Redis.
type Listener struct {
	chain           string
	rpcWSS          string
	usdcAddress     common.Address
	receiverAddress common.Address
	factoryAddress  common.Address
	knownEscrows    []common.Address // accumulates from EscrowCreated events; persists across reconnects
	pub             *publisher.Publisher

	transferABI     abi.ABI
	contributionABI abi.ABI
	escrowCreatedABI abi.ABI
}

// NewListener creates a new EVM listener.
func NewListener(chain, rpcWSS string, usdcAddress common.Address, receiver string, factoryAddress string, pub *publisher.Publisher) (*Listener, error) {
	tABI, err := abi.JSON(strings.NewReader(usdcTransferABIJSON))
	if err != nil {
		return nil, fmt.Errorf("parse transfer abi: %w", err)
	}
	cABI, err := abi.JSON(strings.NewReader(contributionABIJSON))
	if err != nil {
		return nil, fmt.Errorf("parse contribution abi: %w", err)
	}
	eABI, err := abi.JSON(strings.NewReader(escrowCreatedABIJSON))
	if err != nil {
		return nil, fmt.Errorf("parse escrowCreated abi: %w", err)
	}

	var receiverAddr common.Address
	if receiver != "" {
		receiverAddr = common.HexToAddress(receiver)
	}
	var factoryAddr common.Address
	if factoryAddress != "" {
		factoryAddr = common.HexToAddress(factoryAddress)
	}

	return &Listener{
		chain:            chain,
		rpcWSS:           rpcWSS,
		usdcAddress:      usdcAddress,
		receiverAddress:  receiverAddr,
		factoryAddress:   factoryAddr,
		pub:              pub,
		transferABI:      tABI,
		contributionABI:  cABI,
		escrowCreatedABI: eABI,
	}, nil
}

// Run starts the listener loop with exponential backoff on disconnect.
// It blocks until ctx is cancelled.
func (l *Listener) Run(ctx context.Context) error {
	backoff := 2 * time.Second
	for {
		err := l.connectAndListen(ctx)
		if ctx.Err() != nil {
			return nil // graceful shutdown
		}
		log.Printf("[%s] WebSocket disconnected: %v — reconnecting in %s", l.chain, err, backoff)
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
	client, err := ethclient.DialContext(ctx, l.rpcWSS)
	if err != nil {
		return fmt.Errorf("dial %s: %w", l.rpcWSS, err)
	}
	defer client.Close()
	log.Printf("[%s] Connected to %s", l.chain, l.rpcWSS)

	// Build USDC transfer filter: Transfer events TO platform receiver.
	var receiverTopic []common.Hash
	if l.receiverAddress != (common.Address{}) {
		receiverTopic = []common.Hash{common.BytesToHash(l.receiverAddress.Bytes())}
	}
	transferQuery := ethereum.FilterQuery{
		Addresses: []common.Address{l.usdcAddress},
		Topics: [][]common.Hash{
			{transferSig},
			nil,           // from: any
			receiverTopic, // to: platform receiver (nil = any)
		},
	}

	transferLogs := make(chan types.Log, 32)
	subTransfer, err := client.SubscribeFilterLogs(ctx, transferQuery, transferLogs)
	if err != nil {
		return fmt.Errorf("subscribe transfer logs: %w", err)
	}
	defer subTransfer.Unsubscribe()

	// Build ContributionReceived filter: only subscribe when we have known escrow addresses.
	// Alchemy (and most providers) reject an eth_subscribe with an empty Addresses list.
	// Escrow addresses are accumulated from EscrowCreated events and persist across reconnects.
	var subContrib ethereum.Subscription
	contribLogs := make(chan types.Log, 32)
	if len(l.knownEscrows) > 0 {
		contribQuery := ethereum.FilterQuery{
			Addresses: l.knownEscrows,
			Topics: [][]common.Hash{
				{contributionSig},
			},
		}
		subContrib, err = client.SubscribeFilterLogs(ctx, contribQuery, contribLogs)
		if err != nil {
			return fmt.Errorf("subscribe contribution logs: %w", err)
		}
		defer subContrib.Unsubscribe()
		log.Printf("[%s] Subscribed to ContributionReceived on %d escrow contract(s)", l.chain, len(l.knownEscrows))
	} else {
		log.Printf("[%s] No known escrow contracts yet — ContributionReceived subscription skipped (will activate after first EscrowCreated)", l.chain)
	}

	// Subscribe to EscrowCreated events from the factory (if configured).
	// This lets us learn new escrow addresses at runtime and re-subscribe with them.
	var subFactory ethereum.Subscription
	factoryLogs := make(chan types.Log, 8)
	if l.factoryAddress != (common.Address{}) {
		factoryQuery := ethereum.FilterQuery{
			Addresses: []common.Address{l.factoryAddress},
			Topics: [][]common.Hash{
				{escrowCreatedSig},
			},
		}
		subFactory, err = client.SubscribeFilterLogs(ctx, factoryQuery, factoryLogs)
		if err != nil {
			// Non-fatal: log and continue without factory subscription.
			log.Printf("[%s] Warning: could not subscribe to factory events: %v", l.chain, err)
		} else {
			defer subFactory.Unsubscribe()
			log.Printf("[%s] Subscribed to EscrowCreated on factory %s", l.chain, l.factoryAddress.Hex())
		}
	}

	log.Printf("[%s] Subscribed to USDC transfers", l.chain)

	for {
		select {
		case <-ctx.Done():
			return nil
		case err := <-subTransfer.Err():
			return fmt.Errorf("transfer subscription error: %w", err)
		case err := <-contribErrCh(subContrib):
			return fmt.Errorf("contribution subscription error: %w", err)
		case err := <-factoryErrCh(subFactory):
			return fmt.Errorf("factory subscription error: %w", err)
		case vLog := <-transferLogs:
			l.handleUSDCTransfer(ctx, vLog)
		case vLog := <-contribLogs:
			l.handleContributionReceived(ctx, vLog)
		case vLog := <-factoryLogs:
			if newAddr, ok := l.handleEscrowCreated(vLog); ok {
				log.Printf("[%s] New escrow detected %s — reconnecting to include it in ContributionReceived filter", l.chain, newAddr.Hex())
				return fmt.Errorf("new escrow %s registered — reconnecting", newAddr.Hex())
			}
		}
	}
}

func (l *Listener) handleUSDCTransfer(ctx context.Context, vLog types.Log) {
	// ABI unpack the non-indexed value field.
	vals := make(map[string]interface{})
	if err := l.transferABI.UnpackIntoMap(vals, "Transfer", vLog.Data); err != nil {
		log.Printf("[%s] unpack Transfer data: %v", l.chain, err)
		return
	}
	valueBig, ok := vals["value"].(*big.Int)
	if !ok {
		return
	}

	from := common.BytesToAddress(vLog.Topics[1].Bytes())
	to := common.BytesToAddress(vLog.Topics[2].Bytes())

	event := &sentinelTypes.X402PaymentEvent{
		EventType:       "X402_PAYMENT_DETECTED",
		Chain:           l.chain,
		TransactionHash: vLog.TxHash.Hex(),
		SenderAddress:   from.Hex(),
		ReceiverAddress: to.Hex(),
		AmountUSDC:      formatUnits(valueBig, 6),
		RawAmount:       valueBig.String(),
		BlockNumber:     vLog.BlockNumber,
		Timestamp:       time.Now().UTC(),
	}

	log.Printf("[%s] USDC transfer detected: %s → %s  amount=%s", l.chain, from.Hex(), to.Hex(), event.AmountUSDC)

	if err := l.pub.Publish(ctx, publisher.ChannelX402Payments, event); err != nil {
		log.Printf("[%s] publish X402 event: %v", l.chain, err)
	}
}

func (l *Listener) handleContributionReceived(ctx context.Context, vLog types.Log) {
	vals := make(map[string]interface{})
	if err := l.contributionABI.UnpackIntoMap(vals, "ContributionReceived", vLog.Data); err != nil {
		log.Printf("[%s] unpack ContributionReceived data: %v", l.chain, err)
		return
	}
	amount, _ := vals["amount"].(*big.Int)
	totalRaised, _ := vals["totalRaised"].(*big.Int)
	contributor := common.BytesToAddress(vLog.Topics[1].Bytes())

	event := &sentinelTypes.EscrowContributionEvent{
		EventType:          "ESCROW_CONTRIBUTION_RECEIVED",
		Chain:              l.chain,
		ContractAddress:    vLog.Address.Hex(),
		TransactionHash:    vLog.TxHash.Hex(),
		ContributorAddress: contributor.Hex(),
		AmountNative:       formatUnits(amount, 18),
		TotalRaisedNow:     formatUnits(totalRaised, 18),
		BlockNumber:        vLog.BlockNumber,
		Timestamp:          time.Now().UTC(),
	}

	log.Printf("[%s] ContributionReceived: contract=%s contributor=%s amount=%s ETH",
		l.chain, vLog.Address.Hex(), contributor.Hex(), event.AmountNative)

	if err := l.pub.Publish(ctx, publisher.ChannelEscrowContributions, event); err != nil {
		log.Printf("[%s] publish escrow contribution event: %v", l.chain, err)
	}
}

// formatUnits converts a raw big.Int to a human-readable string with decimals places.
func formatUnits(val *big.Int, decimals int) string {
	if val == nil {
		return "0"
	}
	divisor := new(big.Float).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil))
	result := new(big.Float).Quo(new(big.Float).SetInt(val), divisor)
	return result.Text('f', decimals)
}

// contribErrCh returns a nil channel (never fires) when the subscription is nil,
// avoiding a nil-pointer panic in the select statement.
func contribErrCh(sub ethereum.Subscription) <-chan error {
	if sub == nil {
		return nil
	}
	return sub.Err()
}

// factoryErrCh mirrors contribErrCh for the factory subscription.
func factoryErrCh(sub ethereum.Subscription) <-chan error {
	if sub == nil {
		return nil
	}
	return sub.Err()
}

// handleEscrowCreated processes an EscrowCreated log from the factory contract.
// It returns the new escrow address and true if it was not already known.
func (l *Listener) handleEscrowCreated(vLog types.Log) (common.Address, bool) {
	if len(vLog.Topics) < 2 {
		return common.Address{}, false
	}
	newEscrow := common.BytesToAddress(vLog.Topics[1].Bytes())
	for _, existing := range l.knownEscrows {
		if existing == newEscrow {
			return common.Address{}, false // already known
		}
	}
	l.knownEscrows = append(l.knownEscrows, newEscrow)
	log.Printf("[%s] EscrowCreated: registered new escrow contract %s (total known: %d)",
		l.chain, newEscrow.Hex(), len(l.knownEscrows))
	return newEscrow, true
}
