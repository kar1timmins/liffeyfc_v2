# Liffey Founders Club — Platform Overview

A full-stack web platform for the Liffey Founders Club community. It connects founders through company profiles, wishlist-based crowdfunding (bounties), and Web3-enabled authentication and payments.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                             │
│              SvelteKit (Static, Svelte 5 + Tailwind)        │
│          liffeyfoundersclub.com  (Blacknight / FTP)          │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API (HTTPS)
                           │ SSE /notifications/stream
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     NestJS Backend API                      │
│               api.liffeyfoundersclub.com (Railway)          │
│                                                             │
│  auth │ users │ companies │ bounties │ web3 │ payments      │
└──────┬───────────────────────────────────────┬─────────────┘
       │                                       │ Redis Pub/Sub
       ▼                                       ▼
┌─────────────────┐               ┌────────────────────────┐
│   PostgreSQL    │               │        Redis           │
│  (TypeORM ORM)  │               │  nonce / BullMQ queue  │
│   Railway       │               │   Railway              │
└─────────────────┘               └───────────┬────────────┘
                                              │ subscribe
                                              ▼
                                 ┌────────────────────────┐
                                 │   Sentinel (Go 1.24)   │
                                 │  Watches 5 blockchains │
                                 │  ETH Sepolia · AVAX    │
                                 │  Solana · BTC · XLM    │
                                 └────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│              Blockchain (Hardhat contracts)               │
│  Ethereum Sepolia  │  Avalanche Fuji (testnet)            │
│  CompanyWishlistEscrow.sol  │  EscrowFactory.sol          │
└──────────────────────────────────────────────────────────┘
```

---

## Monorepo Structure

```
liffeyfc_v2/
├── frontend/          # SvelteKit static site
├── backend/           # NestJS API server
├── email-server/      # Node.js email service (Railway)
├── sentinel/          # Go 1.24 blockchain watcher microservice
├── hardhat/           # Solidity smart contracts
├── docs/              # Architecture and feature documentation
├── docker-compose.yml # Local development orchestration
└── deploy.sh          # Deployment helper script
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | SvelteKit 2, Svelte 5 (runes), Tailwind CSS v4, Vite 7 |
| Backend | NestJS 11, TypeScript, Node.js 20 |
| Blockchain Watcher | Go 1.24 (Sentinel microservice — 5 chains) |
| Database | PostgreSQL 15, TypeORM 0.3.x |
| Cache / Queue | Redis 7 (ioredis) — nonce, BullMQ jobs, Pub/Sub |
| Authentication | JWT (HS256), bcryptjs, SIWE (Sign-In with Ethereum) |
| Web3 Frontend | `window.ethereum` (MetaMask), custom `web3.ts` |
| Smart Contracts | Solidity 0.8.x, Hardhat, TypeChain |
| Email | Zoho SMTP via Node.js Express (Railway) |
| Storage | GCP Cloud Storage (avatars / uploads) |
| Crypto prices | Chainlink (ETH/AVAX), CoinGecko (SOL/XLM/BTC) |

---

## Key User Flows

### 1. Registration & Authentication
```
User lands on /auth
  → Register with email/password  OR  Connect MetaMask wallet
  → Backend issues JWT access token (15 min) + refresh token (7 days, httpOnly cookie)
  → Authenticated session begins
```

### 2. Wallet Setup (SIWE / HD Wallet)
```
User authenticates with MetaMask (SIWE)
  → Backend generates HD master wallet (BIP-39 mnemonic, encrypted at rest)
  → Master wallet derives child wallets: one ETH + AVAX address per company
  → Additional Solana, Stellar, Bitcoin addresses derived as needed
  → user_wallets table stores encrypted mnemonic + chain addresses
```

### 3. Company & Wishlist Management
```
User creates a company profile
  → Backend assigns company a child wallet (derived from master wallet)
  → User adds wishlist items (e.g. "Need $5000 for marketing")
  → Wishlist items are publicly visible on company page
```

### 4. Bounty / Crowdfunding Flow
```
Company owner creates a bounty for a wishlist item
  → Backend deploys CompanyWishlistEscrow contract via EscrowFactory (ETH Sepolia / AVAX Fuji)
  → Unique SOL / XLM / BTC deposit addresses derived and attached to wishlist item
  → Bounty appears on public /bounties page
  
Investor contributes:
  → EVM: MetaMask tx → escrow contract → funds held on-chain
  → Non-EVM (SOL/XLM/BTC): send to displayed deposit address → owner records manually via API
  → All amounts converted to EUR and aggregated on the bounty

Agentic payment flow (USDC via x402):
  → User sends USDC to platform wallet on-chain
  → Sentinel (Go) detects payment via WebSocket → publishes to Redis Pub/Sub
  → NestJS SentinelListenerService receives event → confirms payment → queues BullMQ deployment job
  → DeploymentWorkerService deploys escrow contracts → emits DEPLOYMENT_COMPLETE SSE event
  → Frontend receives event via /notifications/stream → shows toast + refreshes UI

Campaign ends:
  → Success: owner calls releaseFunds() → receives ETH/AVAX
  → Failure: contributors call claimRefund() → proportional gas fee deducted
```

### 5. Three-Tier Wallet Hierarchy
```
Tier 1  user_wallets      → Master HD wallet per user (never changes)
Tier 2  companies         → Child wallets per company (ethAddress, avaxAddress, etc.)
Tier 3  wishlist_items    → Escrow contract addresses + SOL/XLM/BTC deposit addresses
```

---

## Quick Start (Docker)

```bash
git clone <repository-url>
cd liffeyfc_v2

# Copy and configure environment
cp .env.example .env   # edit with your credentials
cp sentinel/.env.example sentinel/.env  # set REDIS_URL=redis://redis:6379 plus Alchemy WSS keys

# Start all services (postgres, redis, backend, frontend, sentinel)
docker compose up
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| Health check | http://localhost:3000/health |

---

## Component Documentation

| Component | README |
|---|---|
| Frontend | [frontend/README.md](frontend/README.md) — pages, API connections, Web3, build |
| Backend | [backend/README.md](backend/README.md) — full API reference, auth, contracts, migrations |
| Sentinel | `sentinel/` — Go 1.24 blockchain watcher; see `sentinel/.env.example` for required env vars |
| Email Service | [email-server/README.md](email-server/README.md) |

---

## Sentinel Microservice

The sentinel watches 5 blockchains via WebSocket connections and publishes payment/contribution events to Redis Pub/Sub. The NestJS backend subscribes and turns these into real-time SSE notifications for the browser.

**Chains**: Ethereum Sepolia, Avalanche Fuji (Alchemy WSS), Solana (public RPC), Bitcoin (Blockstream), Stellar (Horizon).

**Redis channels**:
- `channel:x402_payments` — USDC payments to platform wallet
- `channel:escrow_contributions` — `ContributionReceived` events on deployed escrow contracts
- `channel:native_payments` — BTC / XLM deposits to company child wallets

**Required env vars** (`sentinel/.env`):

| Variable | Description |
|---|---|
| `REDIS_URL` | Redis connection URL (e.g. `redis://redis:6379`) |
| `ETH_SEPOLIA_WSS` | Alchemy WebSocket URL for Ethereum Sepolia |
| `AVAX_FUJI_WSS` | Alchemy WebSocket URL for Avalanche Fuji |
| `ETH_SEPOLIA_FACTORY` | EscrowFactory contract address on Sepolia |
| `AVAX_FUJI_FACTORY` | EscrowFactory contract address on Fuji |
| `PLATFORM_RECEIVER_ADDRESS` | Wallet address that receives USDC x402 payments |

**Build**: `cd sentinel && go build ./...`  
**Go version**: 1.24 (`golang:1.24-alpine` Docker image). Do not upgrade `golang.org/x/sync` past `v0.11.0` without a Go 1.25 image.

---

## Deployment Summary

| Component | Platform | Method |
|---|---|---|
| Frontend | Blacknight (Apache) | Upload `frontend/build/` via FTP / GitHub Actions |
| Backend | Railway | Dockerfile, auto-deploy on push to `main` |
| Sentinel | Railway | Dockerfile (`sentinel/Dockerfile`), auto-deploy |
| Email | Railway | Dockerfile |
| Database | Railway (Postgres plugin) | Managed |
| Redis | Railway (Redis plugin) | Managed |

**Backend deploy process:**
1. Push to `main` — Railway builds via Dockerfile
2. `start.sh` runs TypeORM migrations (`migration:run`)
3. NestJS app starts, Railway health-checks `GET /health`

See [backend/README.md](backend/README.md) for environment variables and migration commands.

---

## Smart Contracts

Contracts live in `/hardhat/`. Deployed on Ethereum Sepolia and Avalanche Fuji (testnets).

- **`CompanyWishlistEscrow.sol`**: Time-bound crowdfunding escrow. Stores `string public wishlistItemId` on-chain (set at construction) to permanently record which wishlist item each contract belongs to.
- **`EscrowFactory.sol`**: Factory for deploying escrow instances. `createEscrow` takes 7 arguments including `_wishlistItemId`. `EscrowCreated` event includes `wishlistItemId`. **Must be redeployed if ABI changes.**

```bash
cd hardhat
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy-factory.ts --network sepolia
npx hardhat run scripts/deploy-factory.ts --network fuji
```

After redeployment update `ESCROW_FACTORY_ADDRESS_ETHEREUM` and `ESCROW_FACTORY_ADDRESS_AVALANCHE` in the backend environment. See [backend/README.md](backend/README.md#smart-contracts) for full contract ABI and escrow architecture.

---

## Environment Variables

Detailed variable lists are in each component README. Summary of required variables:

**Backend** (Railway): `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `RECAPTCHA_SECRET_KEY`, `GCP_BUCKET_NAME`, `GCP_SERVICE_ACCOUNT_KEY`, `NODE_ENV=production`, `TYPEORM_SYNCHRONIZE=false`

**Frontend** (build-time): `PUBLIC_API_URL`, `PUBLIC_RECAPTCHA_SITE_KEY`

**Sentinel** (Railway): `REDIS_URL`, `ETH_SEPOLIA_WSS`, `AVAX_FUJI_WSS`, `ETH_SEPOLIA_FACTORY`, `AVAX_FUJI_FACTORY`, `PLATFORM_RECEIVER_ADDRESS`

---

*Updated: 2026-03-10*
