package config

import (
	"log"
	"os"
)

// Config holds all runtime configuration for the sentinel, loaded from env vars.
type Config struct {
	RedisURL string

	EthSepoliaWSS     string
	EthSepoliaUSDC    string
	EthSepoliaFactory string

	AvaxFujiWSS     string
	AvaxFujiUSDC    string
	AvaxFujiFactory string

	SolanaWSS            string
	SolanaHTTPRPC        string
	SolanaUSDCMint       string
	SolanaPlatformWallet string

	// Bitcoin (mempool.space WebSocket)
	BitcoinPlatformAddress string
	BitcoinNetwork         string // "mainnet" | "testnet4" (default: mainnet)

	// Stellar (Horizon SSE)
	StellarPlatformAddress string
	StellarHorizonURL      string // defaults to testnet Horizon

	PlatformReceiverAddress string
	USDCRequiredRawAmount   string

	Port string
}

func Load() *Config {
	cfg := &Config{
		RedisURL: requireEnv("REDIS_URL"),

		EthSepoliaWSS:     os.Getenv("RPC_WSS_ETH_SEPOLIA"),
		EthSepoliaUSDC:    getEnv("USDC_ADDRESS_SEPOLIA", "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
		EthSepoliaFactory: os.Getenv("ETHEREUM_FACTORY_ADDRESS"),

		AvaxFujiWSS:     os.Getenv("RPC_WSS_AVAX_FUJI"),
		AvaxFujiUSDC:    getEnv("USDC_ADDRESS_FUJI", "0x5425890298aed601595a70AB815c96711a31Bc65"),
		AvaxFujiFactory: os.Getenv("AVALANCHE_FACTORY_ADDRESS"),

		SolanaWSS:            os.Getenv("RPC_WSS_SOLANA"),
		SolanaHTTPRPC:        getEnv("RPC_HTTP_SOLANA", "https://api.devnet.solana.com"),
		SolanaUSDCMint:       os.Getenv("SOLANA_USDC_MINT"),
		SolanaPlatformWallet: os.Getenv("SOLANA_PLATFORM_WALLET"),

		BitcoinPlatformAddress: os.Getenv("BITCOIN_PLATFORM_ADDRESS"),
		BitcoinNetwork:         getEnv("BITCOIN_NETWORK", "mainnet"),

		StellarPlatformAddress: os.Getenv("STELLAR_PLATFORM_ADDRESS"),
		StellarHorizonURL:      getEnv("STELLAR_HORIZON_URL", "https://horizon-testnet.stellar.org"),

		PlatformReceiverAddress: os.Getenv("PLATFORM_RECEIVER_ADDRESS"),
		USDCRequiredRawAmount:   getEnv("USDC_REQUIRED_RAW_AMOUNT", "10000000"),

		Port: getEnv("PORT", "8080"),
	}

	if cfg.EthSepoliaWSS == "" && cfg.AvaxFujiWSS == "" {
		log.Println("WARNING: no EVM WebSocket endpoints configured")
	}
	return cfg
}

func requireEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("Required environment variable %q is not set", key)
	}
	return v
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
