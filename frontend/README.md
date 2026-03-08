# Liffey Founders Club — Frontend

SvelteKit static site built with Svelte 5 (runes), Tailwind CSS v4, and a lightweight custom Web3 layer. Deployed to Blacknight (Apache static hosting).

---

## Tech Stack

| Tool | Purpose |
|---|---|
| SvelteKit 2 | Routing, SSG via `adapter-static` |
| Svelte 5 (runes) | Reactivity (`$state`, `$derived`, `$effect`) |
| Tailwind CSS v4 | Utility-first styling |
| Vite 7 | Build tool |
| TypeScript | Type safety throughout |
| Lucide Svelte | Icon library |

---

## Project Structure

```
frontend/src/
├── routes/
│   ├── +layout.svelte          # Root layout with FAB navigation
│   ├── +page.svelte            # Homepage
│   ├── auth/                   # Login + register page
│   ├── dashboard/              # User dashboard
│   ├── profile/                # Profile management + avatar upload
│   ├── settings/               # Wallet key reveal + download
│   ├── companies/
│   │   ├── +page.svelte        # Browse all companies
│   │   └── [id]/+page.svelte   # Company detail + wishlist + contribution UI
│   ├── bounties/
│   │   ├── +page.svelte        # Browse all bounties
│   │   └── [id]/+page.svelte   # Bounty detail (view-only)
│   ├── learnMore/              # About the club (3-tab layout)
│   ├── pitch/                  # Pitch event page
│   ├── forgot-password/        # Password reset request
│   └── reset-password/         # Password reset confirmation
├── lib/
│   ├── components/
│   │   ├── learnMore/          # AboutEvents, InterestForm, EventRegistration
│   │   ├── Web3Modal.svelte    # MetaMask connection modal
│   │   └── Toast.svelte        # Toast notifications
│   ├── stores/
│   │   ├── auth.ts             # Auth state, JWT, user profile
│   │   └── walletStore.ts      # Web3 wallet connection + master wallet addresses
│   ├── web3/
│   │   └── web3.ts             # MetaMask interactions, network switching, contract calls
│   └── config.ts               # API base URL, chain config
├── app.css                     # Global styles + Tailwind imports
└── app.html                    # HTML shell
```

---

## Backend API Connections

All API calls use the native `fetch` API against `PUBLIC_API_URL`. Credentials (`credentials: 'include'`) are passed for authenticated routes so the refresh token cookie is sent automatically.

### Authentication (`/auth`)

| What | Method | Endpoint | Auth |
|---|---|---|---|
| Register | POST | `/auth/register` | none |
| Login | POST | `/auth/login` | none |
| Refresh token | POST | `/auth/refresh` | cookie |
| Logout | POST | `/auth/logout` | cookie |
| Get current user | GET | `/auth/me` | JWT |
| Request password reset | POST | `/auth/request-password-reset` | none |
| Reset password | POST | `/auth/reset-password` | none |
| Validate reset token | POST | `/auth/validate-reset-token` | none |
| Google OAuth redirect | GET | `/auth/google` | none |
| OAuth exchange | POST | `/auth/oauth/exchange` | none |

**SIWE (Sign-In with Ethereum)**

| What | Method | Endpoint |
|---|---|---|
| Get sign-in message | GET | `/auth/siwe/message/:address` |
| Verify signature | POST | `/auth/siwe/verify` |

### Users (`/users`)

| What | Method | Endpoint | Auth |
|---|---|---|---|
| Get user by ID | GET | `/users/:id` | JWT |
| Upload avatar | POST | `/users/upload-avatar` | JWT |
| Upgrade to investor | PATCH | `/users/upgrade-to-investor` | JWT |

### Wallet (`/wallet`)

| What | Method | Endpoint | Auth |
|---|---|---|---|
| Check wallet exists | GET | `/wallet/check` | JWT |
| Get master wallet addresses | GET | `/wallet/addresses` | JWT |
| Download mnemonic + private keys | GET | `/wallet/download` | JWT |
| Derive multichain addresses | POST | `/wallet/derive-multichain` | JWT |
| List company wallets | GET | `/wallet/companies` | JWT |
| Create company wallet | POST | `/wallet/company/:companyId` | JWT |
| Lookup wallet address | GET | `/wallet/lookup?address=&chain=` | none |
| Send funds | POST | `/wallet/send` | JWT |

The `/wallet/lookup` endpoint is used by the **SendFunds** component:
- Pass `address` (ETH or company child wallet) + `chain` (`ethereum` or `avalanche`)
- Returns company details, bounties, and `isUserMasterWallet` flag
- Master wallet → returns all companies + all bounties for that user
- Company wallet → returns that single company + its bounties

### Wallet Balance Proxy (`/wallet-balance`)

All RPC calls are proxied through the backend to avoid CORS. **Never call RPC endpoints directly from the frontend.**

| What | Method | Endpoint |
|---|---|---|
| Get ETH/AVAX balance | GET | `/wallet-balance?address=&chain=` |
| Get USDC balance | GET | `/wallet-balance/usdc?address=&chain=` |
| Get gas price | GET | `/wallet-balance/gas-price?chain=` |

`chain` accepts: `ethereum`, `avalanche`

### Companies (`/companies`)

| What | Method | Endpoint | Auth |
|---|---|---|---|
| List all companies | GET | `/companies` | none |
| Get company | GET | `/companies/:id` | none |
| Get my companies | GET | `/companies/my-companies` | JWT |
| Create company | POST | `/companies` | JWT |
| Update company | PATCH | `/companies/:id` | JWT (owner) |
| Delete company | DELETE | `/companies/:id` | JWT (owner) |
| Get wishlist | GET | `/companies/:id/wishlist` | none |
| Add wishlist item | POST | `/companies/:id/wishlist` | JWT (owner) |
| Update wishlist item | PATCH | `/companies/:companyId/wishlist/:itemId` | JWT (owner) |
| Delete wishlist item | DELETE | `/companies/:companyId/wishlist/:itemId` | JWT (owner) |
| Donate to wishlist item | POST | `/companies/:companyId/wishlist/:itemId/donate` | JWT |

### Bounties (`/bounties`)

| What | Method | Endpoint | Auth |
|---|---|---|---|
| List all bounties | GET | `/bounties` | none |
| Get bounty | GET | `/bounties/:id` | none |
| Leaderboard | GET | `/bounties/leaderboard` | none |
| Get bounties by company | GET | `/bounties/company/:companyId` | none |
| Get contributors | GET | `/bounties/:id/contributors` | none |
| Get history | GET | `/bounties/:id/history` | none |
| Create bounty | POST | `/bounties` | JWT (owner) |
| Sync bounty with chain | POST | `/bounties/:id/sync` | JWT |
| Record manual contribution | POST | `/bounties/:id/contributions/manual` | JWT |
| Get my contributions | GET | `/bounties/contributions/user` | JWT |

### Crypto Prices (`/crypto-prices`)

| What | Method | Endpoint |
|---|---|---|
| Get all prices (EUR) | GET | `/crypto-prices` |
| Force refresh | POST | `/crypto-prices/refresh` |

Used on company pages to display live EUR equivalents.

### Contact (`/contact`)

| What | Method | Endpoint |
|---|---|---|
| Submit interest form | POST | `/contact/interest` |

Validated with reCAPTCHA v3. Used on the LearnMore page.

---

## Web3 Integration

`src/lib/web3/web3.ts` wraps all direct `window.ethereum` calls:

- Detect MetaMask presence
- Request wallet connection (`eth_requestAccounts`)
- Get account and ETH balance
- Switch networks: Ethereum Sepolia (`0xaa36a7`), Avalanche Fuji (`0xa869`)
- Send transactions with ABI-encoded data
- Contribution function selector: `0xd7bb99ba`
- Format addresses for display (truncate middle)

**Chain IDs:**

| Network | Chain ID |
|---|---|
| Ethereum Sepolia | `0xaa36a7` (11155111) |
| Avalanche Fuji | `0xa869` (43113) |

Non-EVM contributions (SOL/XLM/BTC) display a deposit address derived for that wishlist item — users send externally and the owner records via the manual contributions API.

---

## State Management

### `auth.ts` store
- Holds `user`, `accessToken` (memory only, never localStorage), and login/logout/refresh methods
- Access token re-fetched via `/auth/refresh` on page load if refresh cookie is present

### `walletStore.ts`
- MetaMask connection state: `connected`, `address`, `chainId`, `balance`
- Master wallet addresses fetched from `/wallet/addresses`: `ethAddress`, `avaxAddress`, `solanaAddress`, `stellarAddress`, `bitcoinAddress`
- Used by profile, dashboard, and settings pages to display all chain addresses

---

## Environment Variables

```bash
# .env (local dev) or build-time env
PUBLIC_API_URL=http://localhost:3000         # Backend URL
PUBLIC_RECAPTCHA_SITE_KEY=6L...             # reCAPTCHA v3 site key (visible to browser)
```

For production, set `PUBLIC_API_URL` to the Railway backend URL before building.

---

## Development

```bash
cd frontend
pnpm install
pnpm dev           # http://localhost:5173
pnpm build         # outputs to frontend/build/
pnpm preview       # preview production build locally
pnpm run check     # TypeScript type checks
```

---

## Build & Deploy to Blacknight

```bash
# Set backend URL and build
PUBLIC_API_URL=https://your-backend.railway.app pnpm build

# Upload frontend/build/ to Blacknight via FTP or File Manager
# Contents to upload to public_html/:
#   index.html, _app/, img/, videos/, .htaccess, robots.txt, sitemap.xml
```

A GitHub Actions workflow (`.github/workflows/deploy-frontend.yml`) can automate this:
- Triggers on push to `main`
- Builds the frontend
- Uploads `frontend/build/` via FTP using secrets: `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`, `FTP_TARGET_DIR`

---

*Updated: 2026-03-08*
