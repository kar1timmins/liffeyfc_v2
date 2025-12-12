# Escrow Integration & Balance Display - Implementation Guide

## Overview
This document describes the integrated escrow deployment system with real-time wallet balance display and gas fee estimation.

## Architecture Changes

### Database Tracking System
The backend now comprehensively tracks all escrow deployments and contributions through two new entities:

#### EscrowDeployment Entity
- **Purpose**: Track smart contract deployments for wishlist items
- **Key Fields**:
  - `contractAddress` (VARCHAR 42): Deployed contract address
  - `chain` (VARCHAR 20): 'ethereum' or 'avalanche'
  - `network` (VARCHAR 20): 'sepolia' or 'fuji' (testnet names)
  - `deploymentTxHash` (VARCHAR 66): Transaction hash of deployment
  - `targetAmountEth` (DECIMAL 18,8): Campaign goal in ETH
  - `durationInDays` (INTEGER): Campaign duration
  - `deadline` (TIMESTAMP): Campaign end date
  - `deployedById` (UUID): User who deployed the contract
  - `wishlistItemId` (UUID): Associated wishlist item
  - `status` (VARCHAR 20): 'active', 'funded', 'expired', 'failed'

#### Contribution Entity
- **Purpose**: Track individual contributions from investors
- **Key Fields**:
  - `contributorAddress` (VARCHAR 42): Wallet address of contributor
  - `userId` (UUID, nullable): Linked user account (if registered)
  - `escrowDeploymentId` (UUID): Associated deployment
  - `contractAddress` (VARCHAR 42): Contract address contributed to
  - `chain` (VARCHAR 20): Network used
  - `transactionHash` (VARCHAR 66): Contribution transaction
  - `amountWei` (VARCHAR): Precise amount in Wei
  - `amountEth` (DECIMAL 18,8): Amount in ETH/AVAX
  - `amountUsd` (DECIMAL 10,2): USD equivalent at contribution time
  - `isRefunded` (BOOLEAN): Refund status
  - `refundedAt`, `refundTxHash`: Refund tracking

### Wallet Balance Proxy API
To avoid CORS restrictions when calling public RPC endpoints from the browser, a backend proxy service was implemented:

**Controller**: `WalletBalanceController` (`backend/src/web3/wallet-balance.controller.ts`)

**Endpoints**:
1. `GET /wallet-balance?address=<address>&chain=<ethereum|avalanche>`
   - Returns: `{ chain, address, balanceWei, balanceEth/balanceAvax, rpcEndpoint }`
   - Features: Multiple RPC fallback, error handling, BigInt precision

2. `GET /wallet-balance/gas-price?chain=<ethereum|avalanche>`
   - Returns: `{ chain, gasPriceWei, gasPriceGwei }`
   - Used for: Gas cost estimation

**RPC Endpoints Used**:
- **Ethereum Sepolia**: 
  - Primary: `https://rpc.sepolia.org`
  - Fallback 1: `https://ethereum-sepolia-rpc.publicnode.com`
  - Fallback 2: `https://rpc2.sepolia.org`
- **Avalanche Fuji**: `https://api.avax-test.network/ext/bc/C/rpc`

### Enhanced Bounties Service
The bounties service now tracks contributors and provides full history:

**New Methods**:
- `getContributors(id)`: Fetches contributors from blockchain and syncs to database
- `syncContributorsToDatabase()`: Saves/updates contribution records
- `getBountyHistory(id)`: Returns deployments, contributions, and statistics

**Auto-Sync**: Contributors are automatically synced from blockchain when fetched, ensuring database always reflects current state.

## Frontend Integration

### WishlistForm Component
The wishlist creation form now includes escrow deployment as part of the flow:

**User Flow**:
1. User fills in wishlist title, description, category, priority, value
2. User checks "Enable Blockchain Crowdfunding" checkbox
3. Form reveals escrow configuration section with:
   - **Company Wallet Balances**: Real-time display of ETH (Sepolia) and AVAX (Fuji) balances
   - **Target Amount (ETH)**: Auto-converts from EUR value (1 ETH ≈ €3200)
   - **Campaign Duration**: Presets (1 week, 2 weeks, 1 month, 2 months, 3 months) or custom days
   - **Network Selection**: Checkboxes for Ethereum Sepolia and Avalanche Fuji
   - **Gas Estimates**: Real-time cost estimates per network (~0.005 ETH/AVAX for deployment)
   - **Total Cost Estimate**: Summary of deployment costs
4. User submits form → Backend creates item, bounty record, and deploys contracts
5. Success toast shows contract addresses
6. Page refreshes after 1-second delay (ensures backend has saved addresses)

**Key Implementation Details**:
- Uses `tick()` to ensure DOM renders before fetching balances
- Balances fetch triggered by `onchange` handler (not reactive `$effect`)
- Warnings (not errors) shown if insufficient gas balance
- Parallel fetching of ETH and AVAX balances
- 6 decimal precision for balance display (testnet amounts often very small)

### Balance Display Logic
```typescript
async function handleEscrowToggle() {
  if (formData.enableEscrow && companyWallet) {
    await tick(); // Wait for DOM update
    updateBalances(); // Fetch via backend proxy
    estimateGasCosts(); // Get current gas prices
  }
}

async function updateBalances() {
  const [ethResponse, avaxResponse] = await Promise.all([
    fetch(`${apiUrl}/wallet-balance?address=${companyWallet}&chain=ethereum`),
    fetch(`${apiUrl}/wallet-balance?address=${companyWallet}&chain=avalanche`)
  ]);
  
  // Process responses and update $state variables
  ethBalance = ethData.balanceEth;
  avaxBalance = avaxData.balanceAvax;
}
```

### Gas Estimation Logic
```typescript
async function estimateGasCosts() {
  const gasPriceResponse = await fetch(
    `${apiUrl}/wallet-balance/gas-price?chain=ethereum`
  );
  const gasPriceData = await gasPriceResponse.json();
  const gasPriceGwei = parseFloat(gasPriceData.gasPriceGwei);
  const estimatedGas = 500000; // Conservative estimate
  const gasCostEth = (gasPriceGwei * estimatedGas) / 1e9;
  estimatedGasCost.ethereum = gasCostEth.toFixed(6);
}
```

### CompanyManager Component
Displays deployed contract information for company owners:

**Features**:
- Shows contract addresses for Ethereum and Avalanche
- Blockchain explorer links (Etherscan for Sepolia, Snowtrace for Fuji)
- Warning message if contracts still deploying
- Truncated address display with full address in code block

## API Integration Flow

### Wishlist Item Creation with Escrow
```
1. POST /wishlist-items
   → Creates wishlist item
   → Returns created item with ID

2. POST /bounties
   → Creates bounty record
   → Links to wishlist item
   → Sets deadline based on duration

3. POST /escrow/create
   → Deploys contracts to selected networks
   → Saves EscrowDeployment records
   → Updates wishlist item with contract addresses
   → Returns deployment result
```

### Contribution Tracking
```
1. User contributes via MetaMask on company page
   → Transaction sent to escrow contract

2. GET /bounties/:id/contributors
   → Fetches contributors from blockchain
   → Auto-syncs to contributions table
   → Returns contributor list with amounts

3. GET /bounties/:id/history
   → Returns full audit trail:
     - Deployment records
     - Contribution records
     - Statistics (total raised, contributor count)
```

## Configuration

### Environment Variables
**Backend (.env)**:
```bash
# Ethereum RPC (use fallback array in code)
ETHEREUM_RPC_URL=https://rpc.sepolia.org

# Avalanche RPC
AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc

# Factory Contract Addresses (testnet)
ETHEREUM_FACTORY_ADDRESS=0x...
AVALANCHE_FACTORY_ADDRESS=0x...

# Private keys for deployment (TESTNET ONLY)
ETHEREUM_PRIVATE_KEY=0x...
AVALANCHE_PRIVATE_KEY=0x...
```

**Frontend (.env)**:
```bash
# API URL for balance proxy
VITE_API_URL=http://localhost:3000  # Dev
VITE_API_URL=https://api.liffeyfc.com  # Prod
```

## Security Considerations

### RPC Proxy Benefits
- **CORS Avoidance**: Browser can't call public RPCs directly due to CORS
- **Centralized Control**: Can implement rate limiting, caching, monitoring
- **Fallback Management**: Automatically tries multiple endpoints
- **Error Handling**: Consistent error responses

### Data Validation
- Address format validation (`/^0x[a-fA-F0-9]{40}$/`)
- Chain validation (only 'ethereum' or 'avalanche')
- Amount validation (positive numbers, max precision)
- Duration validation (1-365 days)

### Private Key Management
- Never exposed to frontend
- Stored in backend environment variables
- Used only for contract deployment
- **Testnet keys only** (no mainnet deployment yet)

## Testing Guide

### Manual Testing Checklist
1. **Create Wishlist with Escrow**:
   - [ ] Create wishlist item without escrow (should work as before)
   - [ ] Enable escrow checkbox
   - [ ] Verify balance display appears
   - [ ] Check gas estimates update
   - [ ] Submit form
   - [ ] Verify contract addresses shown in toast
   - [ ] Refresh page and check contract addresses appear

2. **Balance Display**:
   - [ ] Balances show immediately after checkbox toggle
   - [ ] Balances show 6 decimal places
   - [ ] Refresh button updates balances
   - [ ] Shows correct address (company wallet)

3. **Gas Estimation**:
   - [ ] Estimates appear when networks selected
   - [ ] Unchecking network removes estimate
   - [ ] Shows warnings if insufficient balance

4. **Deployment Tracking**:
   - [ ] Check database for escrow_deployments record
   - [ ] Verify contract address, chain, network correct
   - [ ] Check wishlist_items table updated with contract addresses

5. **Contribution Tracking**:
   - [ ] Make contribution via MetaMask
   - [ ] Call GET /bounties/:id/contributors
   - [ ] Verify contribution saved to contributions table
   - [ ] Check amounts (Wei, ETH, USD) correct

### Database Verification
```sql
-- Check escrow deployments
SELECT * FROM escrow_deployments ORDER BY "createdAt" DESC;

-- Check contributions
SELECT * FROM contributions ORDER BY "contributedAt" DESC;

-- Check wishlist items with escrow
SELECT id, title, "ethereumEscrowAddress", "avalancheEscrowAddress", "isEscrowActive"
FROM wishlist_items
WHERE "isEscrowActive" = true;
```

## Troubleshooting

### Balance Shows 0 or "..."
**Cause**: RPC endpoint unreachable or CORS issue
**Solution**:
1. Check browser console for errors
2. Verify backend is running and accessible
3. Test RPC endpoints directly: `curl https://rpc.sepolia.org`
4. Check backend logs for RPC errors

### Gas Estimates Show Errors
**Cause**: Gas price endpoint unavailable
**Solution**:
1. Check backend logs
2. Verify RPC endpoints accessible
3. Use fallback estimate (0.005 ETH/AVAX)

### Contracts Not Appearing
**Cause**: Database save timing or backend error
**Solution**:
1. Check browser network tab for failed POST requests
2. Check backend logs for deployment errors
3. Verify private keys configured
4. Wait 1-2 seconds and refresh page

### Insufficient Gas Balance Warning
**Expected**: This is a warning, not an error
**Action**: User can:
1. Fund company wallet with testnet tokens
2. Proceed anyway (may fail on-chain)
3. Uncheck expensive networks

## Future Enhancements
1. **Email Notifications**: Alert when new contribution received
2. **Real-time Updates**: WebSocket for live balance/contribution updates
3. **Contribution History UI**: Timeline component showing full history
4. **Mainnet Support**: Production deployment to Ethereum/Avalanche mainnets
5. **Multi-Currency**: Support for other ERC-20 tokens
6. **Refund UI**: Interface for claiming refunds on failed campaigns
7. **Milestone Tracking**: Break campaigns into milestones with partial releases

## References
- Smart Contract Architecture: `/hardhat/TEST_RESULTS.md`
- Escrow System Documentation: `/frontend/docs/ESCROW_SYSTEM.md`
- API Documentation: `/backend/docs/BOUNTIES_API.md`
- Project Instructions: `/.github/instructions/lfc_project_instructions.instructions.md`
