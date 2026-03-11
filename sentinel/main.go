package main

// on-chain-sentinel: real-time blockchain indexer for the Liffey Founders Club.
// Connects via WebSocket to EVM chains (Sepolia, Fuji) and Solana, detects
// USDC transfers and escrow ContributionReceived events, and publishes
// structured JSON payloads to Redis Pub/Sub for the NestJS backend to consume.

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"golang.org/x/sync/errgroup"

	"github.com/liffeyfc/sentinel/config"
	"github.com/liffeyfc/sentinel/internal/bitcoin"
	"github.com/liffeyfc/sentinel/internal/evm"
	"github.com/liffeyfc/sentinel/internal/publisher"
	solanaListener "github.com/liffeyfc/sentinel/internal/solana"
	"github.com/liffeyfc/sentinel/internal/stellar"
)

func main() {
	log.SetFlags(log.Ldate | log.Ltime | log.LUTC)
	log.Println("Starting On-Chain Sentinel v1.0.0")

	cfg := config.Load()

	// ── Redis publisher ──────────────────────────────────────────────────────
	pub, err := publisher.New(cfg.RedisURL)
	if err != nil {
		log.Fatalf("Cannot connect to Redis: %v", err)
	}
	defer pub.Close()

	// ── Graceful shutdown ────────────────────────────────────────────────────
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	g, gCtx := errgroup.WithContext(ctx)

	// ── Health-check HTTP server ─────────────────────────────────────────────
	// Railway requires a reachable port for health checks.
	g.Go(func() error {
		return serveHealth(gCtx, cfg.Port)
	})

	// ── Ethereum Sepolia listener ────────────────────────────────────────────
	if cfg.EthSepoliaWSS != "" {
		l, err := evm.NewListener(
			"ethereum_sepolia",
			cfg.EthSepoliaWSS,
			common.HexToAddress(cfg.EthSepoliaUSDC),
			cfg.PlatformReceiverAddress,
			cfg.EthSepoliaFactory,
			pub,
		)
		if err != nil {
			log.Fatalf("Ethereum Sepolia listener init: %v", err)
		}
		log.Println("Ethereum Sepolia listener goroutine started")
		g.Go(func() error { return l.Run(gCtx) })
	} else {
		log.Println("RPC_WSS_ETH_SEPOLIA not set — Ethereum Sepolia disabled")
	}

	// ── Avalanche Fuji listener ──────────────────────────────────────────────
	if cfg.AvaxFujiWSS != "" {
		l, err := evm.NewListener(
			"avalanche_fuji",
			cfg.AvaxFujiWSS,
			common.HexToAddress(cfg.AvaxFujiUSDC),
			cfg.PlatformReceiverAddress,
			cfg.AvaxFujiFactory,
			pub,
		)
		if err != nil {
			log.Fatalf("Avalanche Fuji listener init: %v", err)
		}
		log.Println("Avalanche Fuji listener goroutine started")
		g.Go(func() error { return l.Run(gCtx) })
	} else {
		log.Println("RPC_WSS_AVAX_FUJI not set — Avalanche Fuji disabled")
	}

	// ── Solana listener ──────────────────────────────────────────────────────
	if cfg.SolanaWSS != "" && cfg.SolanaUSDCMint != "" && cfg.SolanaPlatformWallet != "" {
		sl, err := solanaListener.NewListener(
			cfg.SolanaWSS,
			cfg.SolanaHTTPRPC,
			cfg.SolanaUSDCMint,
			cfg.SolanaPlatformWallet,
			pub,
		)
		if err != nil {
			log.Printf("Solana listener init failed (will skip): %v", err)
		} else {
			log.Println("Solana listener goroutine started")
			g.Go(func() error { return sl.Run(gCtx) })
		}
	} else {
		log.Println("Solana env vars not fully set — Solana disabled")
	}

	// ── Bitcoin listener ─────────────────────────────────────────────────────
	if cfg.BitcoinPlatformAddress != "" {
		bl := bitcoin.NewListener(cfg.BitcoinPlatformAddress, cfg.BitcoinNetwork, pub)
		log.Printf("Bitcoin listener goroutine started (network=%s address=%s)",
			cfg.BitcoinNetwork, cfg.BitcoinPlatformAddress)
		g.Go(func() error { return bl.Run(gCtx) })
	} else {
		log.Println("BITCOIN_PLATFORM_ADDRESS not set — Bitcoin monitoring disabled")
	}

	// ── Stellar listener ──────────────────────────────────────────────────────
	if cfg.StellarPlatformAddress != "" {
		sl := stellar.NewListener(cfg.StellarPlatformAddress, cfg.StellarHorizonURL, pub)
		log.Printf("Stellar listener goroutine started (address=%s horizon=%s)",
			cfg.StellarPlatformAddress, cfg.StellarHorizonURL)
		g.Go(func() error { return sl.Run(gCtx) })
	} else {
		log.Println("STELLAR_PLATFORM_ADDRESS not set — Stellar monitoring disabled")
	}

	log.Printf("Sentinel running. Health on :%s. Press Ctrl+C to stop.", cfg.Port)

	if err := g.Wait(); err != nil {
		log.Printf("Sentinel exited with error: %v", err)
		os.Exit(1)
	}
	log.Println("Sentinel shut down cleanly")
}

// serveHealth starts a minimal HTTP server for Railway health checks.
// GET /health → 200 OK {"status":"ok"}
// GET /ready  → 200 OK {"status":"ready"}
func serveHealth(ctx context.Context, port string) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, `{"status":"ok","service":"on-chain-sentinel"}`)
	})
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, `{"status":"ready"}`)
	})

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutCtx)
	}()

	log.Printf("Health server listening on :%s", port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("health server: %w", err)
	}
	return nil
}
