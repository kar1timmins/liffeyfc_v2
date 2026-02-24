# Liffey Founders Club - Web Platform

A modern full-stack web application for the Liffey Founders Club community, built with SvelteKit, NestJS, and Web3 integration.

> **📚 Complete Documentation**: This README consolidates all deployment, setup, Web3 integration, and troubleshooting documentation for easy access.

---

## 📑 Table of Contents

1. [Quick Start](#-quick-start)
2. [Project Architecture](#️-project-architecture)
3. [Technology Stack](#️-technology-stack)
4. [🚀 DEPLOYMENT GUIDE](#-deployment-guide)
   - [Quick 3-Step Deployment](#-3-step-deployment)
   - [Backend Deployment (Railway)](#backend-deployment-railway)
   - [Frontend Deployment (Blacknight)](#frontend-deployment-blacknight)
5. [Web3 Integration](#-web3-integration)
6. [Blockchain Escrow System](#-blockchain-escrow-system) **✨ NEW**
7. [Environment Variables](#-environment-variables)
8. [Development](#-development)
9. [Troubleshooting](#-troubleshooting)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- Docker and Docker Compose (for local development)
- Git

### Local Development with Docker

```bash
# Clone the repository
git clone <repository-url>
cd liffeyfc_v2

# Start all services
docker-compose up
```

**Services:**
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

### Manual Development

**Frontend:**
```bash
cd frontend
pnpm install
pnpm dev
```

**Backend:**
```bash
cd backend
pnpm install
pnpm start:dev
```

---

## 🏗️ Project Architecture

### Monorepo Structure

```
liffeyfc_v2/
├── frontend/          # SvelteKit static site (Svelte 5 + Tailwind CSS)
├── backend/           # NestJS API server (TypeScript)
├── email-server/      # Node.js email service (Railway deployment)
├── docker-compose.yml # Local development orchestration
└── deploy.sh          # Deployment automation
```

### Frontend (`/frontend/`)
```
frontend/
├── src/
│   ├── routes/              # SvelteKit file-based routing
│   │   ├── +page.svelte     # Homepage
│   │   ├── learnMore/       # Learn More page
│   │   ├── pitch/           # Pitch event page
│   │   └── welcome/         # Welcome page
│   ├── lib/
│   │   ├── components/      # Reusable components (Web3Modal, etc.)
│   │   ├── stores/          # Svelte stores (walletStore, etc.)
│   │   ├── web3/            # Web3 integration utilities
│   │   └── config.ts        # API and chain configuration
│   ├── app.css              # Global Tailwind styles + custom classes
│   └── app.html             # HTML template
├── static/                  # Static assets (images, videos, etc.)
├── build/                   # Production build output
└── package.json
```

### Backend (`/backend/`)
```
backend/
├── src/
│   ├── contact/             # Contact form module
│   ├── web3/                # Web3 blockchain module (NEW!)
│   │   ├── web3.controller.ts
│   │   ├── web3.service.ts
│   │   ├── web3.module.ts
│   │   └── dto/            # Data Transfer Objects
│   ├── app.module.ts        # Root application module
│   └── main.ts              # Application entry point with CORS
├── test/                    # E2E tests
└── package.json
```

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: SvelteKit 2 with Svelte 5 (runes-based reactivity)
- **Styling**: Tailwind CSS v4 + DaisyUI
- **Build Tool**: Vite 7
- **Adapter**: Static site generation (`@sveltejs/adapter-static`)
- **Language**: TypeScript (ES2020+)
- **Web3**: MetaMask integration via `window.ethereum`
- **Package Manager**: pnpm

### Backend
- **Framework**: NestJS 11
- **Runtime**: Node.js with TypeScript
- **Web3 Library**: ethers.js 6.15.0
- **Features**: 
  - Contact form handling with reCAPTCHA validation
  - 9 Web3 RESTful endpoints for blockchain interactions
  - Multi-chain support (Ethereum, Avalanche)
  - Wallet signature verification
- **Package Manager**: pnpm

### Email Service
- **Runtime**: Node.js with Express
- **SMTP**: Zoho Mail
- **Deployment**: Railway
- **Purpose**: Automated welcome emails for registrations

---

## 🚀 DEPLOYMENT GUIDE

### ⚡ 3-Step Deployment

#### 1️⃣ Deploy Backend (Railway)

**Quick Steps:**
1. Go to [railway.app/new](https://railway.app/new)
2. Deploy from: `kar1timmins/liffeyfc_v2`
3. Root directory: `backend`
4. Add environment variables (see [Backend Environment Variables](#backend-env-in-backend))
5. Generate domain
6. **SAVE THE URL!**

**Time: ~10-15 minutes**

#### 2️⃣ Build Frontend

```bash
cd frontend
./build-production.sh https://YOUR-RAILWAY-URL.railway.app
```

**Or manually:**
```bash
echo "VITE_API_URL=https://YOUR-RAILWAY-URL.railway.app" > .env.production
pnpm build
```

**Time: ~2 minutes**

#### 3️⃣ Upload to Blacknight

Upload everything from `/frontend/build/`:
- ✅ `index.html`
- ✅ `_app/` folder (all JS/CSS)
- ✅ `img/` folder
- ✅ `videos/` folder
- ✅ `.htaccess`
- ✅ `robots.txt`
- ✅ `sitemap.xml`
- ✅ All HTML files

**Time: ~5-10 minutes**

---

### Backend Deployment (Railway)

#### Option A: Railway Dashboard (Recommended)

**Step 1: Create Project**
1. Sign in to [railway.app](https://railway.app)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select repository: `kar1timmins/liffeyfc_v2`

**Step 2: Configure Service**
1. Click on the deployed service
2. **Settings** → **Root Directory**: Set to `backend`
3. **Settings** → **Builder**: Auto-detects Nixpacks

**Step 3: Environment Variables**

Click **Variables** tab and add:

```env
RECAPTCHA_SECRET_KEY=<your_recaptcha_secret>
WEB3FORMS_ACCESS_KEY=<your_web3forms_key>
NODE_ENV=production
FRONTEND_URL=https://liffeyfoundersclub.com
```

**Where to get keys:**
- **reCAPTCHA**: [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
- **Web3Forms**: [Web3Forms Dashboard](https://web3forms.com/dashboard)

**Step 4: Generate Domain**
1. **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy URL (e.g., `https://liffeyfc-backend.up.railway.app`)
4. **SAVE THIS!** You need it for frontend build

**Step 5: Verify Deployment**

```bash
# Health check
curl https://your-backend.railway.app/
# Returns: "Liffey Founders Club Backend API"

# Test Web3 endpoints
curl https://your-backend.railway.app/web3/chains
# Returns: JSON array of blockchain networks
```

#### Option B: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Navigate to backend
cd backend

# Initialize and deploy
railway init
railway up

# Set environment variables
railway variables --set "RECAPTCHA_SECRET_KEY=your_key"
railway variables --set "WEB3FORMS_ACCESS_KEY=your_key"
railway variables --set "NODE_ENV=production"
railway variables --set "FRONTEND_URL=https://liffeyfoundersclub.com"

# Generate domain
railway domain

# View logs
railway logs
```

#### Quick Deploy Script

Use the provided script:
```bash
cd backend
./railway-deploy.sh
```

#### Option C: Railway MCP Agent (Advanced) 🤖

For automated deployment with intelligent workflows, use the Railway MCP (Model Context Protocol) Agent:

```bash
# Run automated setup
./.github/mcp/railway-setup.sh
```

**Features:**
- 🚀 Automated deployment workflows
- 📊 Health monitoring and alerts
- 🔄 One-command rollbacks
- 🔐 Environment management
- 📝 Database migration automation
- 🐛 Built-in troubleshooting

**Quick Commands:**
```bash
# Deploy all services
railway up

# View real-time logs
railway logs --service backend --follow

# Check service status
railway status

# Run database migrations
railway run -- pnpm run migration:run
```

**Complete Documentation:**
- [MCP Agent Overview](./.github/mcp/README.md)
- [Quick Reference](./.github/mcp/RAILWAY_QUICK_REF.md)
- [Full Documentation](./.github/mcp/railway-agent.md)
- [Setup Guide](./.github/mcp/SETUP_SUMMARY.md)

---

### Frontend Deployment (Blacknight)

**Step 1: Build with Backend URL**

```bash
cd frontend
./build-production.sh https://your-backend.railway.app
```

**Step 2: Test Locally (Optional)**

```bash
pnpm preview
# Visit http://localhost:4173
# Test FAB, forms, wallet connection
```

**Step 3: Upload to Blacknight**

Via File Manager or FTP/SFTP, upload **entire** `/frontend/build/` directory:

```
Upload to public_html/ (or root):
├── index.html
├── pitch.html
├── learnMore.html
├── welcome.html
├── _app/              # ALL files inside!
│   └── immutable/
│       ├── assets/    # CSS files
│       ├── chunks/    # JS modules
│       ├── entry/     # Entry points
│       └── nodes/     # Route nodes
├── img/
├── videos/
├── .htaccess
├── robots.txt
└── sitemap.xml
```

**Step 4: Set Permissions** (if needed)

```bash
chmod 644 *.html
chmod 755 _app/
chmod 644 _app/immutable/**/*
```

**Step 5: Clear Cache**

After upload:
- Clear browser cache: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Test all pages and functionality

---

### ✅ Post-Deployment Verification

#### Backend Tests

```bash
# Health check
curl https://your-backend.railway.app/

# Web3 chains endpoint
curl https://your-backend.railway.app/web3/chains

# Contact form endpoint
curl https://your-backend.railway.app/contact/health
```

#### Frontend Tests

1. Visit `https://liffeyfoundersclub.com`
2. Open DevTools (F12) → Console
3. Check for errors
4. **Test FAB**: Click Floating Action Button
5. **Test Navigation**: Click menu items
6. **Test Wallet**: Click "Connect Wallet" button
7. **Test Forms**: Submit contact form

---

## 🌐 Web3 Integration

### Overview

Complete Web3 wallet integration with MetaMask support and blockchain interaction capabilities.

**Current Features:**
- ✅ MetaMask wallet connection
- ✅ Multi-chain support (Ethereum Mainnet/Sepolia, Avalanche C-Chain/Fuji)
- ✅ Wallet signature verification
- ✅ Balance fetching
- ✅ Chain switching
- ✅ Sign-in message generation
- 🔜 Avalanche Core wallet integration
- 🔜 User-wallet database association

### API Endpoints

#### 1. Connect Wallet
**POST** `/web3/connect`

```json
// Request
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "chainId": "0x1"
}

// Response
{
  "success": true,
  "data": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "chainId": "0x1",
    "chainName": "Ethereum Mainnet",
    "connectedAt": "2025-11-03T21:45:00.000Z"
  },
  "message": "Wallet connected successfully"
}
```

#### 2. Get Balance
**GET** `/web3/balance/:address?chainId=0x1`

```json
// Response
{
  "success": true,
  "data": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "balance": "1234567890000000000",
    "formattedBalance": "1.23456789",
    "chainId": "0x1"
  }
}
```

#### 3. Generate Sign-In Message
**GET** `/web3/message/:address`

```json
// Response
{
  "success": true,
  "data": {
    "message": "Welcome to Liffey Founders Club!\n\nSign this message to verify your wallet ownership.\n\nWallet: 0x742d35Cc...\nTimestamp: 2025-11-03T21:45:00.000Z\nNonce: 123456"
  }
}
```

#### 4. Verify Signature
**POST** `/web3/verify`

```json
// Request
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "message": "Sign-in message here",
  "signature": "0x..."
}

// Response
{
  "success": true,
  "data": {
    "isValid": true,
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  },
  "message": "Signature verified successfully"
}
```

#### 5. Get Supported Chains
**GET** `/web3/chains`

```json
// Response
{
  "success": true,
  "data": [
    {
      "chainId": "0x1",
      "chainName": "Ethereum Mainnet",
      "nativeCurrency": {
        "name": "Ether",
        "symbol": "ETH",
        "decimals": 18
      },
      "rpcUrls": ["https://eth.llamarpc.com"],
      "blockExplorerUrls": ["https://etherscan.io"]
    }
    // ... more chains
  ]
}
```

#### Additional Endpoints
- **POST** `/web3/disconnect` - Disconnect wallet session
- **POST** `/web3/switch-chain` - Request chain switch
- **GET** `/web3/transaction/:txHash` - Get transaction details
- **GET** `/web3/validate/:address` - Validate wallet address

### Frontend Web3 Components

**Location**: `/frontend/src/lib/`

**Key Files:**
- `components/Web3Modal.svelte` - Wallet connection UI
- `stores/walletStore.ts` - Reactive wallet state
- `config.ts` - Blockchain configuration
- `web3/web3.ts` - Web3 utilities

**Usage Example:**

```svelte
<script>
  import { walletStore } from '$lib/stores/walletStore';
  import Web3Modal from '$lib/components/Web3Modal.svelte';
  
  let showModal = false;
</script>

{#if $walletStore.connected}
  <p>Connected: {$walletStore.address}</p>
  <p>Balance: {$walletStore.balance} ETH</p>
{:else}
  <button onclick={() => showModal = true}>
    Connect Wallet
  </button>
{/if}

<Web3Modal bind:show={showModal} />
```

---

## 💰 Blockchain Escrow System

### Overview

Complete smart contract-based escrow system for company wishlist funding on Ethereum and Avalanche blockchains.

**Status**: ✅ **Implementation Complete** - Ready for testnet deployment

**Features:**
- ✅ Time-bound fundraising campaigns with deadlines
- ✅ All-or-nothing funding (target must be met)
- ✅ Automatic fund release when successful
- ✅ Refund mechanism for failed campaigns
- ✅ Multi-chain support (Ethereum + Avalanche)
- ✅ Factory pattern for deploying unlimited campaigns
- ✅ Comprehensive security features (reentrancy protection, access control)

### Architecture

```
┌─────────────────┐
│ EscrowFactory   │  (Singleton per network)
└────────┬────────┘
         │ creates
         ▼
┌─────────────────┐
│ Escrow #1       │  (One per campaign)
│ - Company A     │
│ - Target: 1 ETH │
│ - 7 days        │
└─────────────────┘
```

### Smart Contracts

#### CompanyWishlistEscrow.sol
Individual campaign contract that holds funds for a specific fundraising goal.

**Key Functions:**
```solidity
contribute() payable           // Accept investor contributions
finalize()                     // End campaign (auto-releases or enables refunds)
claimRefund()                  // Allow contributors to reclaim funds if failed
getCampaignStatus() view       // Get complete campaign state
getProgressPercentage() view   // Calculate funding completion %
isActive() view                // Check if accepting contributions
```

#### EscrowFactory.sol
Factory contract for deploying multiple escrow contracts.

**Key Functions:**
```solidity
createEscrow() returns address     // Deploy new escrow contract
getCompanyEscrows() view           // Get all company campaigns
getEscrowDetails() view            // Query campaign status
```

### Backend API Endpoints

#### 1. Create Escrow Campaign
**POST** `/escrow/create` (JWT auth required)

```json
// Request
{
  "wishlistItemId": 123,
  "targetAmount": "1.0",      // ETH
  "durationInDays": 7
}

// Response
{
  "success": true,
  "addresses": {
    "ethereum": "0x1234...",
    "avalanche": "0x5678..."
  },
  "wishlistItemId": 123,
  "targetAmount": "1.0",
  "deadline": "2024-01-15T10:30:00Z"
}
```

#### 2. Get Campaign Status
**GET** `/escrow/status/:wishlistItemId`

```json
// Response
{
  "ethereum": {
    "totalRaised": "0.75",
    "targetAmount": "1.0",
    "deadline": "2024-01-15T10:30:00Z",
    "isActive": true,
    "isFinalized": false,
    "isSuccessful": false,
    "contributorCount": 5,
    "progressPercentage": 75
  },
  "avalanche": { ... }
}
```

#### 3. Sync with Blockchain
**POST** `/escrow/sync/:wishlistItemId`

Syncs database with current on-chain state.

#### 4. List Company Escrows
**GET** `/escrow/company/:companyId`

Returns all escrow campaigns for a company.

#### 5. Health Check
**GET** `/escrow/health`

```json
{
  "configured": true,
  "networks": {
    "ethereum": {
      "factoryAddress": "0x...",
      "hasPrivateKey": true,
      "hasRpcUrl": true
    },
    "avalanche": { ... }
  }
}
```

### Database Schema Updates

**WishlistItem Entity** (New Fields):
```typescript
ethereumEscrowAddress: string       // Contract address on Ethereum
avalancheEscrowAddress: string      // Contract address on Avalanche
solanaEscrowAddress?: string        // SOL deposit address unique to this bounty
stellarEscrowAddress?: string       // XLM deposit address unique to this bounty
bitcoinEscrowAddress?: string       // BTC deposit address unique to this bounty
campaignDeadline: Date              // Campaign end time
campaignDurationDays: number        // Duration in days
isEscrowActive: boolean             // Is campaign currently running
isEscrowFinalized: boolean          // Has campaign ended
```

### Testing

The system has been successfully tested with comprehensive test scenarios:

✅ **Test Scenario 1: Successful Campaign**
- Factory deployed
- Escrow created with 1.0 ETH target
- Multiple contributions accepted (0.3 + 0.4 + 0.2 + 0.1 ETH)
- Target reached (100%)
- Funds automatically released to company

✅ **Test Scenario 2: Failed Campaign**
- Escrow created with 2.0 ETH target
- Partial contribution (0.5 ETH, 25%)
- Deadline passed
- Campaign finalized as failed
- Investor claimed full refund

### Quick Start

#### 1. Compile Contracts
```bash
cd hardhat
pnpm install
npx hardhat compile
```

#### 2. Test Locally
```bash
npx hardhat run scripts/test-escrow-system.ts --network hardhat
```

#### 3. Deploy to Testnet
```bash
# Interactive deployment helper
./deploy-escrow.sh

# Or deploy manually
npx hardhat run scripts/deploy-factory.ts --network sepolia
npx hardhat run scripts/deploy-factory.ts --network fuji
```

#### 4. Configure Backend
Add to `backend/.env`:
```bash
ETHEREUM_FACTORY_ADDRESS=0x...
AVALANCHE_FACTORY_ADDRESS=0x...
WEB3_PRIVATE_KEY=your_private_key_here
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
```

#### 5. Run Database Migration
```bash
cd backend
pnpm run migration:generate -- src/migrations/AddEscrowFields
pnpm run migration:run
```

### Complete Documentation

For detailed documentation, see:
- **[ESCROW_SYSTEM.md](./ESCROW_SYSTEM.md)** - Complete technical documentation
- **[QUICK_START.md](./QUICK_START.md)** - Step-by-step deployment guide
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Full implementation details
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Phase-by-phase checklist
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Visual architecture diagrams
- **[hardhat/TEST_RESULTS.md](./hardhat/TEST_RESULTS.md)** - Test validation report

### Networks Configured

- **Ethereum Sepolia** (Testnet) - Ready to deploy
- **Avalanche Fuji** (Testnet) - Ready to deploy
- **Ethereum Mainnet** (Production) - Configured (requires security audit)
- **Avalanche C-Chain** (Production) - Configured (requires security audit)

### Roadmap

- **Phase 1**: Core Implementation ✅ **COMPLETE**
- **Phase 2**: Testnet Deployment ⏸️ **NEXT**
- **Phase 3**: Frontend Integration ⏸️ Pending
- **Phase 4**: Testing & Optimization ⏸️ Pending
- **Phase 5**: Security Audit ⏸️ Pending
- **Phase 6**: Mainnet Deployment ⏸️ Pending

---

## 🔐 Environment Variables

### Frontend (`.env` in `/frontend/`)

```bash
# Public variables (exposed to client)
PUBLIC_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
PUBLIC_API_URL=http://localhost:3000
PUBLIC_DEBUG_LOGS=1
PUBLIC_APP_ENV=development

# Private variables (server-side only during build)
RECAPTCHA_SECRET_KEY=your_recaptcha_secret
WEB3FORMS_ACCESS_KEY=your_web3forms_key
```

**Production** (`.env.production`):
```bash
VITE_API_URL=https://your-backend.railway.app
```

### Backend (`.env` in `/backend/`)

```bash
PORT=3000
NODE_ENV=development
WEB3FORMS_ACCESS_KEY=your_web3forms_key
RECAPTCHA_SECRET_KEY=your_recaptcha_secret
FRONTEND_URL=http://localhost:5173
ENABLE_API_LOGS=1
```

**Railway Production:**
```bash
NODE_ENV=production
RECAPTCHA_SECRET_KEY=<from_google>
WEB3FORMS_ACCESS_KEY=<from_web3forms>
FRONTEND_URL=https://liffeyfoundersclub.com
# PORT is auto-provided by Railway
```

### Email Server (Railway)

```bash
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=info@liffeyfoundersclub.com
SMTP_PASS=your_zoho_app_password
PORT=3001
NODE_ENV=production
ALLOWED_ORIGINS=https://liffeyfoundersclub.com
```

---

## 💻 Development

### Available Scripts

#### Frontend
```bash
pnpm dev              # Start development server (localhost:5173)
pnpm build            # Build static site + generate sitemap
pnpm preview          # Preview production build (localhost:4173)
pnpm generate:sitemap # Generate sitemap.xml
pnpm validate:sitemap # Validate sitemap
pnpm lint             # Run ESLint
pnpm format           # Format code with Prettier
```

#### Backend
```bash
pnpm start:dev        # Start development server (watch mode)
pnpm start:prod       # Start production server
pnpm build            # Build production bundle
pnpm lint             # Run ESLint
pnpm test             # Run unit tests
pnpm test:e2e         # Run E2E tests
pnpm test:cov         # Coverage report
```

### Docker Development

```bash
# Start all services
docker-compose up

# Rebuild after changes
docker-compose up --build

# Stop all services
docker-compose down

# View logs
docker-compose logs -f frontend
docker-compose logs -f backend
```

### Code Style Guidelines

- **Frontend**: Svelte 5 runes (`$state`, `$derived`, `$effect`), Tailwind utilities, TypeScript strict
- **Backend**: NestJS patterns, dependency injection, DTOs with validation
- **Formatting**: Prettier with project config
- **Linting**: ESLint with project rules
- **Naming**: camelCase for variables/functions, PascalCase for classes/components

---

## 🆘 Troubleshooting

### FAB Button Not Opening (Production)

**Symptoms**: Floating Action Button clicks don't work on deployed site

**Solutions:**
1. **Clear browser cache**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. **Check Console**: Open DevTools (F12) → Console for JavaScript errors
3. **Verify upload**: Ensure entire `_app/` folder uploaded correctly
4. **Check permissions**: 
   ```bash
   chmod 644 build/_app/immutable/**/*.js
   ```

**Technical Details:**
- Fixed in `/frontend/src/routes/+layout.svelte`
- Changed `onclick={toggleFab}` to `onclick={(e) => toggleFab(e)}`
- Rebuild required after fix: `pnpm build`

### CORS Errors

**Symptom**: Frontend can't connect to backend, console shows CORS errors

**Solutions:**
1. **Check backend CORS configuration** in `/backend/src/main.ts`:
   ```typescript
   app.enableCors({
     origin: [
       'http://localhost:5173',
       'https://liffeyfoundersclub.com',
       'https://www.liffeyfoundersclub.com'
     ],
     credentials: true
   });
   ```

2. **Verify Railway environment variable**:
   ```bash
   FRONTEND_URL=https://liffeyfoundersclub.com
   ```

3. **Redeploy backend** after changes

### MetaMask Modal Styling Issues (Production)

**Symptoms**: Modal appears but has no styling, icon doesn't show

**Solutions:**
1. **Check CSS loading**:
   - Open DevTools → Network tab
   - Look for 404 errors on CSS files
   - Verify `_app/immutable/assets/*.css` files uploaded

2. **Check image paths**:
   - MetaMask logo should be at `/img/logo/metamask-logo.svg`
   - Verify `img/` folder uploaded correctly

3. **Clear browser cache**: Hard refresh after fixes

4. **Check `.htaccess`**: Ensure it's not blocking resources

**Current Status:**
- CSS classes (`glass-subtle`, `modal-box`) are in build
- SVG file exists in build output
- Issue likely path resolution or caching

### Build Failures

**Frontend Build Issues:**

```bash
# Clear cache and rebuild
cd frontend
rm -rf .svelte-kit node_modules/.vite
pnpm install
pnpm build
```

**Backend Build Issues:**

```bash
# Clear dist and rebuild
cd backend
rm -rf dist node_modules/.cache
pnpm install
pnpm build
```

### Railway Deployment Issues

**pnpm not detected:**
- Railway should auto-detect from `pnpm-lock.yaml`
- If fails, ensure `railway.json` exists with Nixpacks config

**Environment variables not working:**
- Check Railway dashboard → Variables tab
- Ensure no trailing spaces in variable values
- Restart deployment after adding variables

**Logs:**
```bash
railway logs
# Or via dashboard: Deployments → View Logs
```

### Static Asset 404s

**Missing images/videos:**
1. Verify files exist in `/frontend/static/`
2. Check they're copied to `/frontend/build/`
3. Ensure correct paths in HTML: `/img/...` not `./img/...`
4. Upload entire `img/` and `videos/` folders

### Testing Checklist

Before marking deployment complete:

- [ ] Backend health endpoint responds
- [ ] Backend Web3 endpoints return data
- [ ] Frontend loads without console errors
- [ ] FAB button opens and closes
- [ ] Navigation works (all pages load)
- [ ] Contact form submits successfully
- [ ] reCAPTCHA loads and validates
- [ ] Wallet connection button appears
- [ ] MetaMask modal opens with styling
- [ ] Images and videos load
- [ ] Mobile responsive (test on phone)

---

## 📚 Additional Documentation

Service-specific documentation:

- **Frontend Setup & Features**: [`/frontend/README.md`](/frontend/README.md)
- **Backend API & Services**: [`/backend/README.md`](/backend/README.md)
- **Email Service**: [`/email-server/README.md`](/email-server/README.md)
- **GitHub Copilot Instructions**: [`/.github/instructions/lfc_project_instructions.instructions.md`](/.github/instructions/lfc_project_instructions.instructions.md)

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Follow coding guidelines in `.github/instructions/`
3. Update relevant documentation for new features
4. Ensure all tests pass
5. Submit a pull request

---

## 📄 License

[Add your license here]

---

## 👥 Contact

**Liffey Founders Club**  
Email: info@liffeyfoundersclub.com  
Website: https://liffeyfoundersclub.com

---

## ⏱️ Deployment Time Estimates

- **Backend deployment (Railway)**: 10-15 minutes
- **Frontend build**: 2 minutes
- **Frontend upload (Blacknight)**: 5-10 minutes
- **Testing**: 5 minutes

**Total: ~30 minutes for full deployment**

---

**Last Updated**: November 3, 2025  
**Version**: 2.0 (Web3 Integration Complete)
