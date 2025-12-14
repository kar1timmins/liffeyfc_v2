# X402 Payment Integration - Phase 4: Frontend Integration

## Overview

Phase 4 implements the user-facing interface for USDC payment-based contract deployment. Users can now pay for bounty deployments using testnet USDC instead of needing testnet ETH/AVAX for gas.

**Status**: ✅ Complete  
**Commit**: `410567a`  
**Branch**: `feature/x402-usdc-payment-integration`

---

## What Was Built

### 1. USDC Utilities Module (`/frontend/src/lib/web3/usdc.ts`)

**Purpose**: Reusable utilities for USDC interactions via MetaMask  
**Size**: 282 lines  
**Dependencies**: Ethers.js 6.16.0, MetaMask (window.ethereum)

#### Key Functions

```typescript
// Get USDC balance for a wallet
getUSDCBalance(chain: 'ethereum' | 'avalanche', address: string): Promise<USDCBalance>

// Transfer USDC to recipient
transferUSDC(
  chain: 'ethereum' | 'avalanche',
  to: string,
  amount: number
): Promise<TransferResult>

// Switch MetaMask network
switchToNetwork(chain: 'ethereum' | 'avalanche'): Promise<boolean>

// Verify transaction confirmation
verifyTransaction(chain: 'ethereum' | 'avalanche', txHash: string): Promise<boolean>

// Format USDC amounts for display
formatUSDC(amount: string | number): string
```

#### USDC Contract Addresses

```typescript
USDC_CONTRACTS = {
  ethereum: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
  avalanche: '0x5425890298aed601595a70AB815c96711a31Bc65', // Fuji
}
```

#### Features

- **Balance Checking**: Query USDC balance via contract `balanceOf()`
- **Transfers**: ERC20 transfer with MetaMask signature
- **Network Switching**: Auto-switch to Sepolia/Fuji testnets
- **Transaction Verification**: Wait for confirmations
- **Error Handling**: Comprehensive error messages for all failure scenarios

---

### 2. X402 Bounty Creation Modal (`/frontend/src/lib/components/CreateBountyModalX402.svelte`)

**Purpose**: 4-step wizard for creating bounties with USDC payment option  
**Size**: 1041 lines  
**Framework**: Svelte 5 with runes (`$state`, `$derived`)

#### User Flow

```
Step 1: Configure
├─ Payment method selection (USDC / Traditional)
├─ Campaign details (name, description)
├─ Target amount (EUR ↔ ETH conversion)
├─ Duration (1 week to 3 months)
└─ Network selection (Ethereum Sepolia, Avalanche Fuji)

Step 2: USDC Payment (if USDC method selected)
├─ Payment chain selection
├─ USDC balance display with refresh
├─ Cost breakdown (per-chain + platform fee)
├─ Platform receiver address
├─ "Pay X USDC" button
└─ MetaMask transfer confirmation

Step 3: Deploying
├─ Payment confirmation
├─ Job queued message
├─ Real-time deployment progress
└─ Loading indicators

Step 4: Success
├─ Contract addresses (Ethereum + Avalanche)
├─ Explorer links
└─ Auto-close after 3 seconds
```

#### Payment Method Options

**USDC Payment (Recommended)**:
- User pays stablecoin (testnet USDC)
- Platform handles all gas fees
- No need for testnet ETH/AVAX
- Simpler UX for users

**Traditional Direct Deployment**:
- User pays gas directly
- Requires testnet ETH/AVAX in wallet
- Original flow (backward compatible)

#### Key Features

1. **Reactive Form Validation**
   - EUR ↔ ETH conversion
   - Network selection (at least one required)
   - Duration presets (1w, 2w, 1m, 2m, 3m)
   - Campaign name/description

2. **USDC Payment Flow**
   - Real-time balance checking
   - Insufficient balance warnings
   - Cost breakdown display
   - MetaMask integration

3. **Status Tracking**
   - Payment transaction hash capture
   - Job ID from backend queue
   - Deployment status polling (simulated)
   - Progress indicators

4. **Error Handling**
   - MetaMask not installed
   - Wallet not connected
   - Insufficient USDC balance
   - Payment validation failures
   - Deployment failures
   - Clear error messages

---

### 3. Backend API Endpoints

#### Cost Estimation

```http
POST /payments/estimate
Content-Type: application/json

{
  "chains": ["ethereum", "avalanche"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "breakdown": [
      {
        "chain": "Ethereum",
        "gasCostETH": "0.002",
        "gasCostUSD": 7.6
      },
      {
        "chain": "Avalanche",
        "gasCostETH": "0.01",
        "gasCostUSD": 0.4
      }
    ],
    "totalUSD": 8.0,
    "platformFeeUSD": 0.0,
    "grandTotalUSD": 8.0
  }
}
```

**Implementation**:
- Historical gas cost estimates (Ethereum: 0.002 ETH, Avalanche: 0.01 AVAX)
- ETH to USD: $3800 (placeholder, use price oracle in production)
- AVAX to USD: $40 (placeholder)
- No platform fee currently

#### Job Status Polling

```http
GET /payments/job/:jobId
```

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "progress": 100,
    "data": {
      "ethereumAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "avalancheAddress": "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199"
    }
  }
}
```

**Job States**:
- `waiting`: In queue
- `active`: Being processed
- `completed`: Deployed successfully
- `failed`: Deployment failed
- `not-found`: Invalid job ID

---

## Technical Implementation

### Frontend State Management

```typescript
// Svelte 5 runes for reactive state
let paymentMethod = $state<'traditional' | 'usdc'>('usdc');
let selectedPaymentChain = $state<'ethereum' | 'avalanche'>('ethereum');
let usdcBalance = $state<USDCBalance | null>(null);
let paymentTxHash = $state<string | null>(null);
let jobId = $state<string | null>(null);
let deploymentStatus = $state<'pending' | 'deploying' | 'deployed' | 'failed'>('pending');
let currentStep = $state<'form' | 'payment' | 'deploying' | 'success'>('form');
```

### USDC Transfer Flow

### Master Wallet Flow

- Allows company owners to pay using their registered master wallet address without connecting MetaMask.
- Frontend posts to `/payments/create-master-wallet` and backend validates ownership and records an off-chain payment (no `usdcTxHash`).
- This option is only available to users with a configured master wallet (`user.wallet.ethAddress`).
- Deployment is queued immediately after payment is accepted.


### USDC Transfer Flow

```typescript
async function handleUSDCPayment() {
  // 1. Transfer USDC to platform
  const transferResult = await transferUSDC(
    selectedPaymentChain,
    platformReceiverAddress,
    estimatedCostUSDC
  );

  paymentTxHash = transferResult.txHash;

  // 2. Create payment record and queue deployment
  const paymentResponse = await fetch(`${PUBLIC_API_URL}/payments/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${$authStore.accessToken}`,
    },
    body: JSON.stringify({
      wishlistItemId,
      usdcTxHash: paymentTxHash,
      usdcAmount: estimatedCostUSDC,
      chain: selectedPaymentChain,
      deploymentChains: ['ethereum', 'avalanche'],
      targetAmountEth,
      durationInDays,
      campaignName,
      campaignDescription,
    }),
  });

  jobId = paymentData.data.jobId;

  // 3. Poll for deployment status
  await pollDeploymentStatus();
}
```

### Deployment Status Polling

```typescript
async function pollDeploymentStatus() {
  const pollInterval = setInterval(async () => {
    const response = await fetch(`${PUBLIC_API_URL}/payments/job/${jobId}`);
    const data = await response.json();

    if (data.data.status === 'completed') {
      clearInterval(pollInterval);
      deploymentResult = data.data.data;
      currentStep = 'success';
    }

    if (data.data.status === 'failed') {
      clearInterval(pollInterval);
      error = 'Deployment failed';
    }
  }, 3000); // Poll every 3 seconds
}
```

---

## Integration Points

### Required Environment Variables

**Frontend** (`.env`):
```bash
PUBLIC_API_URL=http://localhost:3000
PUBLIC_RECAPTCHA_SITE_KEY=your_site_key
```

**Backend** (`.env`):
```bash
# Platform Wallets (for gas payments)
PLATFORM_ETH_PRIVATE_KEY=0x...
PLATFORM_AVAX_PRIVATE_KEY=0x...

# Platform USDC Receivers
PLATFORM_USDC_RECEIVER_ETHEREUM=0x...
PLATFORM_USDC_RECEIVER_AVALANCHE=0x...

# Redis (for job queue)
REDIS_URL=redis://localhost:6379

# Database
DATABASE_URL=postgres://lfc_user:lfc_pass@localhost:5433/lfc_db
TYPEORM_SYNCHRONIZE=true  # Dev only, use migrations in production
```

### API Dependencies

1. **POST /payments/create** (Phase 1)
   - Validates USDC payment
   - Creates payment record
   - Queues deployment job

2. **POST /payments/estimate** (Phase 4)
   - Calculates deployment costs
   - Returns breakdown by chain

3. **GET /payments/job/:jobId** (Phase 4)
   - Returns BullMQ job status
   - Includes deployment results

4. **GET /payments/info/:chain** (Phase 1)
   - Returns platform USDC receiver address
   - Returns USDC contract address

---

## User Interface

### Step Indicator

```
┌───────┬───────┬───────┬───────┐
│ ✓ 1   │ ✓ 2   │   3   │   4   │
├───────┼───────┼───────┼───────┤
│Config │Payment│Deploy │Success│
└───────┴───────┴───────┴───────┘
```

### Cost Breakdown Card

```
┌──────────────────────────────────┐
│ Cost Breakdown                   │
├──────────────────────────────────┤
│ Ethereum Sepolia    ~$5.00 USDC  │
│ Avalanche Fuji      ~$1.00 USDC  │
│ Platform Fee        $0.00 USDC   │
├──────────────────────────────────┤
│ Total Cost          $6.00 USDC   │
└──────────────────────────────────┘
```

### USDC Balance Display

```
┌──────────────────────────────────┐
│ Your USDC Balance                │
│ 100.00 USDC           [Refresh]  │
└──────────────────────────────────┘
```

---

## Testing Guide

### Prerequisites

1. **MetaMask Installed**
   - Chrome/Firefox extension

2. **Test Networks Added**
   - Ethereum Sepolia (Chain ID: 0xaa36a7)
   - Avalanche Fuji (Chain ID: 0xa869)

3. **Testnet USDC Acquired**
   - Sepolia: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
   - Fuji: `0x5425890298aed601595a70AB815c96711a31Bc65`

### USDC Faucets

**Ethereum Sepolia USDC**:
1. Get Sepolia ETH from https://sepoliafaucet.com/
2. Swap for USDC on testnet DEX or use Circle faucet

**Avalanche Fuji USDC**:
1. Get AVAX from https://faucet.avax.network/
2. Swap for USDC on testnet DEX

### Test Scenarios

#### Scenario 1: USDC Payment Success

1. Open CreateBountyModalX402
2. Select "USDC Payment" method
3. Configure bounty (amount, duration, networks)
4. Click "Continue to Payment"
5. Select payment chain (Ethereum or Avalanche)
6. Verify USDC balance displays correctly
7. Click "Pay X USDC"
8. Approve MetaMask transaction
9. Wait for payment confirmation
10. Verify deployment status polling
11. Verify success screen with contract addresses

**Expected Result**: Contracts deployed, addresses shown, modal closes

#### Scenario 2: Insufficient USDC Balance

1. Follow steps 1-6 from Scenario 1
2. Ensure balance < estimated cost
3. Verify "Pay X USDC" button is disabled
4. Verify warning message displayed

**Expected Result**: Cannot proceed with payment

#### Scenario 3: Traditional Deployment

1. Select "Direct Deployment" method
2. Configure bounty
3. Click "Deploy Contracts"
4. Approve MetaMask gas payment
5. Verify deployment via direct RPC calls

**Expected Result**: Backward compatible with original flow

#### Scenario 4: Network Switching

1. Start on wrong network (e.g., mainnet)
2. Select USDC payment
3. Choose Ethereum payment chain
4. Click "Pay X USDC"
5. Verify MetaMask prompts network switch

**Expected Result**: Auto-switches to Sepolia

#### Scenario 5: Transaction Rejection

1. Follow Scenario 1 steps 1-8
2. Reject MetaMask transaction
3. Verify error message
4. Verify can retry payment

**Expected Result**: Clear error, can retry

---

## Known Limitations

### Current Implementation

1. **Simulated Deployment Polling**
   - Frontend uses 10-second delay mock
   - TODO: Replace with real GET /payments/job/:jobId polling

2. **Hardcoded Cost Estimates**
   - ETH: 0.002 ETH (~$7.60)
   - AVAX: 0.01 AVAX (~$0.40)
   - TODO: Fetch real-time gas prices

3. **Placeholder Exchange Rates**
   - ETH/USD: $3800 (hardcoded)
   - AVAX/USD: $40 (hardcoded)
   - TODO: Integrate Chainlink price oracle

4. **No Cost Caching**
   - Estimates recalculated on each request
   - TODO: Cache estimates for 30 seconds

### Production Improvements Needed

1. **Real-time Gas Estimation**
   ```typescript
   // Use provider.getFeeData() for current gas prices
   // Estimate gas limit for contract deployment
   // Calculate cost = gasLimit * gasPrice
   ```

2. **Price Oracle Integration**
   ```typescript
   // Fetch ETH/USD from Chainlink
   // Fetch AVAX/USD from Chainlink
   // Update estimates every 60 seconds
   ```

3. **Job Status Polling**
   ```typescript
   // Replace mock delay with:
   const response = await fetch(`/payments/job/${jobId}`);
   const status = response.data.status;
   // Update UI based on status
   ```

4. **Error Recovery**
   - Payment succeeded but deployment failed → Refund USDC
   - Network errors during polling → Retry with exponential backoff
   - Transaction pending too long → Show troubleshooting steps

---

## File Changes

### New Files

```
frontend/src/lib/web3/usdc.ts                          282 lines
frontend/src/lib/components/CreateBountyModalX402.svelte  1041 lines
backend/src/payments/dto/estimate-cost.dto.ts           9 lines
```

### Modified Files

```
backend/src/data-source.ts                            +2 lines (import Payment entity)
backend/src/payments/payments.service.ts              +53 lines (estimateDeploymentCosts)
backend/src/payments/payments.controller.ts           +53 lines (estimate + job endpoints)
```

### Total Lines

- **Frontend**: 1323 lines
- **Backend**: 115 lines
- **Total**: 1438 lines

---

## Next Steps

### Phase 5: Integration Testing

1. **Acquire Testnet USDC**
   - Sepolia: 100 USDC
   - Fuji: 100 USDC

2. **End-to-End Test**
   - Create bounty with USDC payment
   - Verify payment validation
   - Verify deployment queue processing
   - Verify contract deployment

3. **Load Testing**
   - Multiple concurrent payments
   - Queue processing performance
   - Redis connection stability

### Phase 6: Production Readiness

1. **Price Oracle Integration**
   - Chainlink for ETH/USD
   - Chainlink for AVAX/USD

2. **Real Gas Estimation**
   - Dynamic gas price fetching
   - Gas limit calculation

3. **Monitoring & Alerts**
   - Payment validation failures
   - Deployment failures
   - Low platform wallet balances

4. **Documentation**
   - User guide for USDC payments
   - Testnet USDC acquisition guide
   - Troubleshooting guide

---

## Deployment Checklist

### Backend

- [ ] Set `PLATFORM_ETH_PRIVATE_KEY` environment variable
- [ ] Set `PLATFORM_AVAX_PRIVATE_KEY` environment variable
- [ ] Set `PLATFORM_USDC_RECEIVER_ETHEREUM` environment variable
- [ ] Set `PLATFORM_USDC_RECEIVER_AVALANCHE` environment variable
- [ ] Verify Redis connection (Railway)
- [ ] Run database migrations
- [ ] Test POST /payments/estimate endpoint
- [ ] Test GET /payments/job/:jobId endpoint
- [ ] Verify platform wallet balances (>0.1 ETH, >1 AVAX)

### Frontend

- [ ] Set `PUBLIC_API_URL` to production backend
- [ ] Test USDC utilities (balance, transfer)
- [ ] Test CreateBountyModalX402 component
- [ ] Verify MetaMask integration
- [ ] Test network switching
- [ ] Deploy static build to hosting

### Testing

- [ ] Acquire testnet USDC (Sepolia + Fuji)
- [ ] Test USDC payment flow end-to-end
- [ ] Test deployment status polling
- [ ] Test error scenarios (insufficient balance, network errors)
- [ ] Verify contract deployment with platform wallet
- [ ] Test traditional deployment (backward compatibility)

---

## Support & Troubleshooting

### Common Issues

**Issue**: "MetaMask not installed"  
**Solution**: Install MetaMask extension, refresh page

**Issue**: "Insufficient USDC balance"  
**Solution**: Acquire testnet USDC from faucets (see Testing Guide)

**Issue**: "Wrong network"  
**Solution**: Click payment button, MetaMask will prompt network switch

**Issue**: "Transaction failed"  
**Solution**: Check gas balance (need ETH/AVAX for USDC transfer gas)

**Issue**: "Deployment stuck"  
**Solution**: Check backend logs, verify Redis connection, check platform wallet balance

---

## Summary

Phase 4 successfully implements:

✅ **USDC Utilities** - MetaMask integration, balance checks, transfers  
✅ **X402 Modal** - 4-step wizard with USDC payment flow  
✅ **Cost Estimation** - POST /payments/estimate endpoint  
✅ **Job Polling** - GET /payments/job/:jobId endpoint  
✅ **Payment Method Choice** - USDC vs Traditional deployment  
✅ **Error Handling** - Comprehensive user feedback  

**Ready for**: Integration testing with testnet USDC

**Branch**: `feature/x402-usdc-payment-integration`  
**Commit**: `410567a`  
**Date**: December 14, 2025

---

**Next**: Acquire testnet USDC and perform end-to-end integration testing
