# Liffey Founders Club — Backend API

NestJS 11 REST API server. Handles authentication, company management, blockchain bounties, wallet derivation, and smart contract interaction. Deployed on Railway via Dockerfile.

---

## Module Structure

```
src/
├── auth/              # JWT, SIWE, email/password, refresh tokens, OAuth
├── users/             # User profiles, avatar upload, wallet attachment
├── companies/         # Company CRUD, wishlist items
├── web3/
│   ├── bounties.controller.ts        # Crowdfunding campaigns
│   ├── escrow.controller.ts          # Smart contract escrow management
│   ├── wallet.controller.ts          # HD wallet derivation + lookup
│   ├── wallet-balance.controller.ts  # RPC proxy for balance queries
│   ├── wallet-generation.service.ts  # BIP-39/HD key derivation
│   ├── crypto-prices.service.ts      # EUR price oracle (Chainlink + CoinGecko)
│   ├── crypto-prices.controller.ts   # Price endpoints
│   └── nonce.redis.service.ts        # SIWE nonce storage (Redis-backed)
├── payments/          # Fiat on-ramp sessions, payment tracking
├── crypto/            # Crypto purchase history
├── admin/             # Platform admin endpoints
├── contact/           # Interest form (reCAPTCHA-validated)
├── entities/          # TypeORM entity definitions
├── migrations/        # TypeORM migrations (20 total)
├── common/            # Shared filters, guards, services (GCP storage, throttler)
└── config/            # JWT config validation, throttler config
```

---

## Full API Reference

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Root (returns "Hello World") |
| GET | `/health` | Health check — DB + Redis status. Used by Railway healthcheck. |

---

### Authentication — `/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | none | Register with email + password |
| POST | `/auth/login` | none | Login — returns JWT + sets refresh cookie |
| POST | `/auth/refresh` | cookie | Rotate refresh token, issue new JWT |
| POST | `/auth/logout` | cookie | Revoke refresh token |
| GET | `/auth/me` | JWT | Get current user from token |
| POST | `/auth/request-password-reset` | none | Send password reset email |
| POST | `/auth/reset-password` | none | Set new password with reset token |
| POST | `/auth/validate-reset-token` | none | Check if reset token is still valid |
| GET | `/auth/google` | none | Redirect to Google OAuth |
| GET | `/auth/google/callback` | none | Google OAuth callback |
| POST | `/auth/oauth/exchange` | none | Exchange OAuth code for JWT |
| GET | `/auth/siwe/message/:address` | none | Generate SIWE sign-in message |
| POST | `/auth/siwe/verify` | none | Verify SIWE signature — returns JWT |
| POST | `/auth/admin/cleanup-tokens` | JWT (staff) | Remove expired refresh tokens |
| GET | `/auth/admin/token-stats` | JWT (staff) | Token usage statistics |

**Authentication Flows:**

```
Email/Password:
  POST /auth/register { email, password, name }
    → password hashed with bcryptjs
    → JWT (15 min) + refresh token (7 days, httpOnly cookie)

SIWE (MetaMask):
  GET  /auth/siwe/message/:address  → returns EIP-4361 message + nonce (stored in Redis, TTL 5 min)
  POST /auth/siwe/verify { message, signature, address }
    → recovers signer address with ethers.js
    → nonce consumed atomically (Lua GET+DEL prevents replay)
    → JWT + refresh token issued

Token Refresh:
  POST /auth/refresh (refresh token in httpOnly cookie)
    → old token revoked, new token pair issued (rotation)
    → reuse detection: if revoked token used → all tokens for user revoked
```

---

### Users — `/users`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/users/register` | none | Legacy registration endpoint |
| GET | `/users/:id` | JWT | Get user profile by ID |
| POST | `/users/upload-avatar` | JWT | Upload profile photo to GCP Cloud Storage |
| POST | `/users/attach-wallet` | JWT | Attach a MetaMask address to user (legacy) |
| PATCH | `/users/upgrade-to-investor` | JWT | Change role to `investor` |
| POST | `/users/usdc-wallet` | JWT | Configure USDC wallet address |
| GET | `/users/usdc-wallet` | JWT | Get USDC wallet configuration |
| POST | `/users/usdc-wallet/remove` | JWT | Remove USDC wallet |

---

### Wallet — `/wallet`

Three-tier HD wallet system: master wallet → company wallets → bounty escrow addresses.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/wallet/check` | JWT | Check if user has a master wallet |
| GET | `/wallet/addresses` | JWT | Get all master wallet addresses (ETH/AVAX/SOL/XLM/BTC) |
| GET | `/wallet/download` | JWT | Decrypt + return mnemonic and private keys for all chains |
| POST | `/wallet/derive-multichain` | JWT | Derive SOL/XLM/BTC addresses from existing master wallet |
| GET | `/wallet/companies` | JWT | List all company wallets for current user |
| POST | `/wallet/company/:companyId` | JWT | Create + persist child wallet for a company |
| GET | `/wallet/lookup?address=&chain=` | none | Resolve wallet address → companies + bounties |
| POST | `/wallet/send` | JWT | Sign and broadcast transaction from backend wallet |

**Wallet Lookup behaviour:**
- `chain`: `ethereum` or `avalanche`
- If `address` matches a company wallet (`companies` table) → returns that company + its bounties
- If `address` matches a master wallet (`user_wallets` table) → returns ALL companies and ALL bounties for that user; response includes `isUserMasterWallet: true`

---

### Wallet Balance Proxy — `/wallet-balance`

CORS-safe RPC proxy. All frontend balance queries must use these endpoints.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/wallet-balance?address=&chain=` | Native balance (ETH/AVAX/SOL/XLM) |
| GET | `/wallet-balance/usdc?address=&chain=` | USDC token balance |
| GET | `/wallet-balance/gas-price?chain=` | Current gas price in Gwei |

`chain` accepts: `ethereum`, `avalanche`, `solana`, `stellar`

Multiple RPC fallbacks per chain for reliability.

---

### Companies — `/companies`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/companies` | JWT | Create company (assigns child wallet) |
| GET | `/companies` | none | List all companies (public) |
| GET | `/companies/my-companies` | JWT | Get current user's companies |
| GET | `/companies/:id` | none | Get company by ID |
| PATCH | `/companies/:id` | JWT (owner) | Update company details |
| DELETE | `/companies/:id` | JWT (owner) | Delete company |
| POST | `/companies/:id/wishlist` | JWT (owner) | Add wishlist item |
| GET | `/companies/:id/wishlist` | none | List wishlist items |
| PATCH | `/companies/:companyId/wishlist/:itemId` | JWT (owner) | Update wishlist item |
| DELETE | `/companies/:companyId/wishlist/:itemId` | JWT (owner) | Delete wishlist item |
| POST | `/companies/:companyId/wishlist/:itemId/donate` | JWT | Record a donation to wishlist item |

---

### Bounties — `/bounties`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/bounties` | none | List all bounties |
| GET | `/bounties/leaderboard` | none | Top contributors leaderboard |
| GET | `/bounties/:id` | none | Get bounty details |
| GET | `/bounties/company/:companyId` | none | Bounties for a company |
| GET | `/bounties/:id/contributors` | none | Contributor list with amounts |
| GET | `/bounties/:id/history` | none | Full audit trail (deployments + contributions) |
| GET | `/bounties/contributions/user` | JWT | Current user's contribution history |
| POST | `/bounties` | JWT (owner) | Create bounty (deploys escrow contract) |
| POST | `/bounties/:id/sync` | JWT | Sync on-chain state to database |
| POST | `/bounties/:id/contributions/manual` | JWT | Record non-EVM contribution (SOL/XLM/BTC) |

**Manual contributions** are converted to EUR using the crypto price service and aggregated into `totalRaisedEur` on the bounty.

---

### Escrow — `/escrow`

Direct escrow contract management.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/escrow/create` | JWT (owner) | Deploy new escrow via EscrowFactory |
| POST | `/escrow/estimate-gas` | JWT | Estimate deployment gas cost |
| GET | `/escrow/status/:wishlistItemId` | none | Get contract status per chain |
| POST | `/escrow/sync/:wishlistItemId` | JWT | Sync on-chain state to DB |
| GET | `/escrow/company/:companyId` | none | All escrow contracts for a company |
| POST | `/escrow/backfill-addresses` | JWT (staff) | Backfill missing contract addresses |
| GET | `/escrow/health` | none | Factory contract configuration status |

---

### Crypto Prices — `/crypto-prices`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/crypto-prices` | none | All prices in EUR (cached 5 min) |
| POST | `/crypto-prices/refresh` | JWT (staff) | Force cache refresh |
| GET | `/crypto-prices/test` | none | Test price fetch (debug) |

Sources: Chainlink on-chain feeds (ETH, AVAX), CoinGecko API (SOL, XLM, BTC).

---

### Payments — `/payments`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/payments/create` | JWT | Create payment record |
| POST | `/payments/deploy` | JWT | Deploy payment-linked contract |
| POST | `/payments/create-master-wallet` | JWT | Create wallet during payment flow |
| POST | `/payments/verify` | JWT | Verify payment on-chain |
| GET | `/payments/:id` | JWT | Get payment by ID |
| GET | `/payments` | JWT | List user payments |
| POST | `/payments/estimate` | JWT | Estimate payment fees |
| GET | `/payments/job/:jobId` | JWT | Poll async job status |
| GET | `/payments/info/:chain` | none | Chain payment info |
| GET | `/payments/wishlist/:wishlistItemId` | none | Payments for a wishlist item |
| GET | `/payments/company/:companyId` | none | Payments for a company |

---

### Crypto — `/crypto`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/crypto/create-onramp-session` | JWT | Create fiat on-ramp session |
| GET | `/crypto/history` | JWT | User's crypto purchase history |

---

### Contact — `/contact`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/contact/interest` | none | Submit interest form (reCAPTCHA v3 validated) |

---

### Admin — `/admin`

All admin endpoints require JWT with `staff` role.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/setup` | Initial platform setup |
| GET | `/admin/platform-info` | Platform metadata |
| GET | `/admin/stats` | Usage statistics |
| GET | `/admin/users` | List all users |
| GET | `/admin/users/:id` | Get user details |
| PATCH | `/admin/users/:id/role` | Change user role |
| PATCH | `/admin/users/:id/status` | Activate / deactivate user |
| GET | `/admin/wallets` | List all wallets |
| GET | `/admin/wallets/:id/private-key` | Get decrypted private key |
| GET | `/admin/transactions` | List all transactions |

---

## Smart Contracts

Contracts in `/hardhat/`. Deployed on Ethereum Sepolia and Avalanche Fuji.

### CompanyWishlistEscrow.sol

Time-bound crowdfunding escrow per wishlist item.

```solidity
function contribute() external payable           // Accept ETH/AVAX contributions
function releaseFunds() external                 // Owner claims on successful campaign
function claimRefund() external                  // Contributor claims refund if campaign failed
function getCampaignStatus() view returns (...)  // Full campaign state
function isActive() view returns (bool)          // Whether campaign accepts contributions
```

**Gas fee on refund:** 0.1% of `totalRaised` split proportionally among contributors (`min 0.001 ETH, max 0.1 ETH`).

**Events:**
- `ContributionReceived(address indexed contributor, uint256 amount)`
- `FundsReleased(address indexed owner, uint256 amount)`
- `RefundClaimed(address indexed contributor, uint256 refundAmount, uint256 gasFee)`

### EscrowFactory.sol

Deploys new `CompanyWishlistEscrow` instances.

```solidity
function createEscrow(address _owner, uint256 _goalAmount, uint256 _deadline) external returns (address)
function getCompanyEscrows(address _owner) view returns (address[])
```

### Deployment

```bash
cd hardhat
npx hardhat compile
npx hardhat test

# Deploy factory on testnets
npx hardhat run scripts/deploy-factory.ts --network sepolia
npx hardhat run scripts/deploy-factory.ts --network fuji
```

Set `ESCROW_FACTORY_ADDRESS_ETHEREUM` and `ESCROW_FACTORY_ADDRESS_AVALANCHE` in the backend environment after deployment.

---

## Database

### TypeORM Entities (`src/entities/`)

| Entity | Table | Description |
|---|---|---|
| `User` | `users` | User accounts (roles: user, investor, staff) |
| `UserWallet` | `user_wallets` | Master HD wallet per user (encrypted mnemonic, all chain addresses) |
| `Wallet` | `wallets` | Legacy MetaMask wallet attachment (vestigial, empty in production) |
| `Company` | `companies` | Company profiles with child wallet addresses |
| `CompanyWallet` | `company_wallets` | Company wallet derivation metadata |
| `WishlistItem` | `wishlist_items` | Company wishlists with escrow + deposit addresses |
| `EscrowDeployment` | `escrow_deployments` | Smart contract deployments per bounty |
| `Contribution` | `contributions` | Individual contributions (EVM + non-EVM) |
| `ContractDeploymentHistory` | `contract_deployment_history` | Audit trail |
| `RefreshToken` | `refresh_tokens` | Hashed refresh tokens with rotation |
| `Payment` | `payments` | Payment session records |
| `CryptoPurchase` | `crypto_purchases` | Fiat on-ramp purchase history |

### WishlistItem — Key Fields

```typescript
ethereumEscrowAddress: string          // EscrowFactory-deployed contract (Sepolia)
avalancheEscrowAddress: string         // EscrowFactory-deployed contract (Fuji)
solanaEscrowAddress?: string           // Unique SOL deposit address for this bounty
stellarEscrowAddress?: string          // Unique XLM deposit address for this bounty
bitcoinEscrowAddress?: string          // Unique BTC deposit address for this bounty
```

Non-EVM addresses are derived by `WalletGenerationService.generateWishlistItemAddresses()` using the owner's `UserWallet.encryptedMnemonic` + `nextChildIndex` (incremented per derivation).

### Migrations

TypeORM migrations in `src/migrations/`. **`data-source.ts` must use explicit class imports** — glob patterns silently fail in Alpine Linux Docker.

```bash
cd backend

# Generate migration from entity changes
pnpm run migration:generate -- src/migrations/<name>

# Run pending migrations
pnpm run migration:run

# Revert last migration
pnpm run migration:revert
```

**Adding a new migration:** Add an `import` to `src/data-source.ts` and append the class to the `migrations` array. Do not use globs.

20 migrations currently registered (timestamps `1680000000000` → `1773000000000`).

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db   # Parsed first if set
TYPEORM_SYNCHRONIZE=false                           # Always false in production; use migrations

# Auth
JWT_SECRET=<64-char hex string>                    # Min 32 chars; generate: openssl rand -hex 32
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Redis (nonce storage + multi-instance cache)
REDIS_URL=redis://redis:6379

# reCAPTCHA
RECAPTCHA_SECRET_KEY=...

# GCP Storage (avatar uploads)
GCP_BUCKET_NAME=...
GCP_SERVICE_ACCOUNT_KEY=<base64-encoded JSON>      # Or mount credentials file

# Smart Contracts (set after hardhat deployment)
ESCROW_FACTORY_ADDRESS_ETHEREUM=0x...
ESCROW_FACTORY_ADDRESS_AVALANCHE=0x...

# App
NODE_ENV=production
FRONTEND_URL=https://liffeyfoundersclub.com
PORT=3000                                          # Railway sets this automatically

# SMTP (email service)
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=...
SMTP_PASS=...
```

---

## Development

### With Docker Compose (recommended)

```bash
# From repo root
docker compose up
```

Starts postgres, redis, backend (port 3000), and frontend (port 5173) together.

### Manual

```bash
cd backend
pnpm install

# Requires Postgres + Redis running locally
export DATABASE_URL=postgresql://lfc_user:lfc_pass@localhost:5432/lfc_db
export REDIS_URL=redis://localhost:6379
export JWT_SECRET=<your-dev-secret>

pnpm start:dev     # Watch mode, port 3000
```

---

## Testing

```bash
pnpm test           # Unit tests
pnpm test:watch     # Watch mode
pnpm test:cov       # Coverage report
pnpm test:e2e       # End-to-end tests
```

Repositories are mocked via `getRepositoryToken()` from TypeORM test utilities. Services are unit-tested in isolation.

---

## Production Deployment (Railway)

Railway builds from the `Dockerfile`. On deploy:

1. Multi-stage Docker build — compiles TypeScript to `dist/`
2. `start.sh` runs: `node ./node_modules/typeorm/cli.js migration:run -d dist/src/data-source.js`
3. NestJS app starts on `$PORT`
4. Railway health-checks `GET /health` (timeout: 300s, `railway.json`)

**Key production checklist:**
- `TYPEORM_SYNCHRONIZE=false`
- `NODE_ENV=production`
- `JWT_SECRET` is at least 32 characters
- `REDIS_URL` is set (for SIWE nonce safety in multi-instance deploys)
- Run `pnpm run migration:run` locally first to verify migrations pass before pushing

---

*Updated: 2026-03-08*
