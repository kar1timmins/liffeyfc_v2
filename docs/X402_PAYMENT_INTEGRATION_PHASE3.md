# X402 USDC Payment Integration - Phase 3: Platform Wallet Service

## Overview

Phase 3 implements the Platform Wallet Service that manages platform-owned wallets for paying gas fees on contract deployments. Users pay in USDC via X402 payment system, and the platform uses its own wallets (loaded with ETH/AVAX) to pay for contract deployment gas costs.

## Architecture

### Payment Flow Comparison

**Before (User Wallet)**:
```
User → MetaMask wallet → Pay gas in ETH/AVAX → Deploy contract
       ↑ User needs testnet tokens
```

**After (Platform Wallet - X402)**:
```
User → Pay USDC to platform → Platform validates payment → Queue deployment
                                        ↓
Platform Wallet (ETH/AVAX balance) → Pay gas → Deploy contract
       ↑ Platform manages gas funds
```

### Key Benefits

1. **No Testnet Tokens Required**: Users don't need to acquire testnet ETH/AVAX
2. **Simplified UX**: Users only need USDC (can buy with fiat)
3. **Predictable Costs**: Platform calculates exact USDC cost upfront
4. **Centralized Gas Management**: Platform maintains gas balances
5. **Audit Trail**: All deployments logged with payment metadata

## Implementation Details

### 1. PlatformWalletService

**File**: `/backend/src/web3/platform-wallet.service.ts`

**Purpose**: Manages platform-owned wallets and signs transactions for contract deployments.

**Key Features**:
- Secure private key management from environment variables
- Automatic wallet address derivation
- RPC provider fallback system (5 Sepolia, 3 Fuji endpoints)
- Gas estimation with 20% safety buffer
- Balance checking before transactions
- Transaction submission and confirmation monitoring

**Core Methods**:

```typescript
// Get signer for specified chain
async getSigner(chain: 'ethereum' | 'avalanche'): Promise<ethers.Wallet>

// Get platform wallet address
getPlatformAddress(chain: 'ethereum' | 'avalanche'): string

// Get current balance
async getPlatformBalance(chain: 'ethereum' | 'avalanche'): Promise<{
  balanceWei: string;
  balanceEth: string;
  address: string;
}>

// Estimate gas cost for transaction
async estimateGasCost(
  chain: 'ethereum' | 'avalanche',
  to: string,
  data: string,
  value: bigint = 0n
): Promise<{
  gasLimit: bigint;
  gasPrice: bigint;
  estimatedCostWei: bigint;
  estimatedCostEth: string;
}>

// Check if sufficient gas available
async hasSufficientGas(
  chain: 'ethereum' | 'avalanche',
  requiredGasWei: bigint
): Promise<boolean>

// Send transaction
async sendTransaction(
  chain: 'ethereum' | 'avalanche',
  to: string,
  data: string,
  value: bigint = 0n
): Promise<ethers.TransactionResponse>

// Wait for confirmation
async waitForTransaction(
  chain: 'ethereum' | 'avalanche',
  txHash: string,
  confirmations: number = 1
): Promise<ethers.TransactionReceipt | null>
```

### 2. EscrowContractService Updates

**New Method**: `deployEscrowContractsWithPlatformWallet()`

**Purpose**: Deploy escrow contracts using platform wallet instead of user's wallet.

**Key Differences from Original `deployEscrowContracts()`**:

| Aspect | Original (User Wallet) | New (Platform Wallet) |
|--------|----------------------|---------------------|
| Signer | User's private key from DB | Platform's private key from env |
| Gas Payer | User's wallet | Platform's wallet |
| Payment Method | User has testnet tokens | User paid USDC to platform |
| User Requirement | MetaMask + testnet tokens | USDC only |
| Gas Validation | Check user balance | Check platform balance |
| Logging | User wallet deployment | Platform wallet + X402 metadata |

**Method Signature**:

```typescript
async deployEscrowContractsWithPlatformWallet(
  userId: string,              // For tracking, not wallet access
  wishlistItemId: string,      // Wishlist item to deploy for
  companyWalletAddress: string, // Company child wallet (recipient)
  masterWalletAddress: string,  // User master wallet (tracking)
  targetAmountEth: number,     // Campaign goal
  durationInDays: number,      // Campaign duration
  chains: ('ethereum' | 'avalanche')[], // Chains to deploy on
  campaignName: string | null, // Optional name
  campaignDescription: string | null // Optional description
): Promise<EscrowDeploymentResult>
```

**Deployment Flow**:

```typescript
// 1. Get platform signer (not user signer)
const signer = await this.platformWalletService.getEthereumSigner();

// 2. Check platform wallet balance
const balance = await this.platformWalletService.getPlatformBalance('ethereum');

// 3. Estimate gas cost
const gasEstimate = await this.platformWalletService.estimateGasCost(
  'ethereum',
  factoryAddress,
  encodedData
);

// 4. Validate sufficient balance
if (!await this.platformWalletService.hasSufficientGas('ethereum', gasEstimate.estimatedCostWei)) {
  throw new Error('Platform wallet has insufficient balance for gas');
}

// 5. Deploy contract
const tx = await factory.createEscrow(...params);
await tx.wait();

// 6. Log deployment with X402 metadata
await this.contractHistoryService.logAction({
  userId,
  companyId,
  wishlistItemId,
  contractAddress: escrowAddress,
  fromAddress: signer.address, // Platform wallet
  chain: 'ethereum',
  network: 'sepolia',
  action: ContractAction.DEPLOYED,
  transactionHash: tx.hash,
  metadata: {
    deploymentMethod: 'platform_wallet',
    paymentMethod: 'x402_usdc',
    targetAmountEth,
    durationInDays,
    campaignName,
    campaignDescription,
    factoryAddress,
  },
  notes: 'Platform wallet deployment via X402 USDC payment',
});
```

### 3. DeploymentWorkerService Integration

**Updated**: `/backend/src/jobs/deployment-worker.service.ts`

**Change**: Call `deployEscrowContractsWithPlatformWallet` instead of `deployEscrowContracts`

```typescript
// Before
const result = await this.escrowService.deployEscrowContracts(
  deploymentData.userId,
  deploymentData.wishlistItemId,
  // ...
);

// After
const result = await this.escrowService.deployEscrowContractsWithPlatformWallet(
  deploymentData.userId,
  deploymentData.wishlistItemId,
  // ...
);
```

This ensures all X402 USDC payment deployments use the platform wallet automatically.

### 4. Web3Module Integration

**Updated**: `/backend/src/web3/web3.module.ts`

**Changes**:
- Import PlatformWalletService
- Add to providers array
- Export for use in other modules

```typescript
import { PlatformWalletService } from './platform-wallet.service';

@Module({
  // ...
  providers: [
    // ...
    PlatformWalletService,
  ],
  exports: [
    // ...
    PlatformWalletService,
  ],
})
export class Web3Module {}
```

## Configuration

### Environment Variables

```bash
# Platform deployment wallets (private keys)
# These wallets pay gas fees for deploying contracts
# NEVER commit these to version control
PLATFORM_ETH_PRIVATE_KEY=0x...  # Wallet with ETH for Sepolia gas fees
PLATFORM_AVAX_PRIVATE_KEY=0x... # Wallet with AVAX for Fuji gas fees
```

### Private Key Format

- Must start with `0x`
- Must be exactly 66 characters (0x + 64 hex chars)
- Example: `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

### Wallet Setup

1. **Generate Platform Wallets**:

```bash
# Generate new wallet (one-time setup)
node -e "const ethers = require('ethers'); const wallet = ethers.Wallet.createRandom(); console.log('Address:', wallet.address); console.log('Private Key:', wallet.privateKey);"
```

2. **Fund Platform Wallets**:

   **Ethereum Sepolia**:
   - Get testnet ETH from faucet: https://sepoliafaucet.com/
   - Recommended balance: 0.1 ETH (~20-30 deployments)

   **Avalanche Fuji**:
   - Get testnet AVAX from faucet: https://core.app/tools/testnet-faucet/
   - Recommended balance: 1.0 AVAX (~50-100 deployments)

3. **Store Keys Securely**:

   **Development**: `.env` file (never commit)
   
   **Production**: Use secrets management:
   - AWS Secrets Manager
   - GCP Secret Manager
   - Azure Key Vault
   - Railway Secrets (for Railway deployments)

4. **Monitor Balances**:

```typescript
// Check platform balance
const balance = await platformWalletService.getPlatformBalance('ethereum');
console.log(`Platform Balance: ${balance.balanceEth} ETH`);

// Set up alerts when balance < threshold
if (parseFloat(balance.balanceEth) < 0.01) {
  // Send alert to admin
}
```

## Gas Cost Estimation

### Gas Buffer Strategy

Platform wallet service adds a 20% buffer to gas price to account for:
- Price fluctuations during transaction submission
- Network congestion spikes
- RPC estimation inaccuracies

```typescript
const gasPrice = feeData.gasPrice || 0n;
const bufferedGasPrice = (gasPrice * 120n) / 100n; // 20% buffer
const estimatedCostWei = gasLimit * bufferedGasPrice;
```

### Typical Gas Costs (Testnet)

| Operation | Ethereum Sepolia | Avalanche Fuji |
|-----------|-----------------|----------------|
| Deploy Escrow | ~0.001-0.003 ETH | ~0.01-0.03 AVAX |
| Gas Price (Avg) | 1-5 Gwei | 25-50 nAVAX |
| Gas Limit | ~500,000 gas | ~500,000 gas |

### Cost Calculation Example

```typescript
// Ethereum Sepolia
Gas Limit: 500,000
Gas Price: 2 Gwei (with 20% buffer = 2.4 Gwei)
Cost: 500,000 × 2.4 = 1,200,000 Gwei = 0.0012 ETH

// At USDC rate (1 ETH = $3000):
Cost in USDC: 0.0012 × $3000 = $3.60 USDC
```

## Security Considerations

### 1. Private Key Storage

**Development**:
- Store in `.env` file
- Add `.env` to `.gitignore`
- Never commit private keys

**Production**:
- Use secrets management service
- Rotate keys periodically
- Limit key access to CI/CD and production services
- Enable audit logging for key access

### 2. Wallet Permissions

Platform wallets should:
- Only have permission to deploy contracts
- NOT be admin on any contracts
- NOT hold significant funds (refill as needed)
- NOT be used for other purposes

### 3. Balance Monitoring

Implement alerts for:
- Balance below threshold (< 0.01 ETH/AVAX)
- Unusual transaction volume
- Failed transactions
- Gas price spikes

### 4. Rate Limiting

Platform wallet service includes:
- RPC fallback to prevent single-point failure
- Transaction throttling in deployment queue
- Gas price validation before submission

## Error Handling

### Common Errors

**1. Insufficient Platform Balance**:
```
Platform wallet has insufficient balance for gas.
Required: 0.0015 ETH, Available: 0.0003 ETH
```
**Solution**: Refill platform wallet from faucet

**2. Private Key Not Configured**:
```
Platform Ethereum wallet not configured (PLATFORM_ETH_PRIVATE_KEY missing)
```
**Solution**: Set environment variable

**3. Invalid Private Key Format**:
```
PLATFORM_ETH_PRIVATE_KEY has invalid format (should start with 0x and be 66 characters)
```
**Solution**: Check private key format (0x + 64 hex chars)

**4. RPC Endpoint Failure**:
```
No working Ethereum RPC endpoint available
```
**Solution**: Service automatically tries fallback endpoints, temporary issue

## Monitoring & Debugging

### Logging

Platform wallet service logs all operations:

```
🔑 Platform Ethereum wallet: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
📡 Platform using Ethereum RPC: https://sepolia.drpc.org
💰 Platform Ethereum balance: 0.0523 ETH
⛽ Estimated gas cost: 0.0012 ETH (500000 gas units)
📤 Sending transaction on ethereum
✅ Transaction sent: 0xabc123...
⏳ Waiting for transaction 0xabc123... (1 confirmations)
✅ Transaction confirmed: 0xabc123...
   Block: 12345678
   Gas Used: 487532
   Status: Success
```

### Database Tracking

All deployments logged to `contract_deployment_history`:

```sql
SELECT 
  action,
  chain,
  network,
  from_address,
  transaction_hash,
  metadata->>'deploymentMethod' as deployment_method,
  metadata->>'paymentMethod' as payment_method,
  created_at
FROM contract_deployment_history
WHERE metadata->>'deploymentMethod' = 'platform_wallet'
ORDER BY created_at DESC;
```

## Testing

### Manual Testing

1. **Set up platform wallets**:

```bash
# Generate wallets (development only)
node -e "const ethers = require('ethers'); const wallet = ethers.Wallet.createRandom(); console.log('ETH Address:', wallet.address); console.log('ETH Private Key:', wallet.privateKey);"

# Fund from faucets
# Ethereum Sepolia: https://sepoliafaucet.com/
# Avalanche Fuji: https://core.app/tools/testnet-faucet/
```

2. **Configure environment**:

```bash
# backend/.env
PLATFORM_ETH_PRIVATE_KEY=0x...
PLATFORM_AVAX_PRIVATE_KEY=0x...
```

3. **Check platform balance**:

```typescript
const ethBalance = await platformWalletService.getPlatformBalance('ethereum');
const avaxBalance = await platformWalletService.getPlatformBalance('avalanche');

console.log('ETH Balance:', ethBalance.balanceEth);
console.log('AVAX Balance:', avaxBalance.balanceEth);
```

4. **Test deployment**:

```bash
# Create USDC payment (Phase 1)
curl -X POST http://localhost:3000/payments/create \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "wishlistItemId": "uuid",
    "usdcTxHash": "0x...",
    "usdcAmount": 10.5,
    "chain": "ethereum",
    "targetAmountEth": 5.0,
    "durationInDays": 30,
    "deploymentChains": ["ethereum", "avalanche"]
  }'

# Job queued (Phase 2)
# Worker processes job (Phase 3 - uses platform wallet)
# Check logs for deployment success
```

### Unit Testing

Mock platform wallet service:

```typescript
const mockPlatformWallet = {
  getSigner: jest.fn().mockResolvedValue(mockSigner),
  getPlatformBalance: jest.fn().mockResolvedValue({
    balanceWei: '100000000000000000',
    balanceEth: '0.1',
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  }),
  estimateGasCost: jest.fn().mockResolvedValue({
    gasLimit: 500000n,
    gasPrice: 2000000000n,
    estimatedCostWei: 1000000000000000n,
    estimatedCostEth: '0.001',
  }),
  hasSufficientGas: jest.fn().mockResolvedValue(true),
};
```

## Next Steps

- [x] Phase 1: Payment Infrastructure
- [x] Phase 2: Deployment Queue System
- [x] Phase 3: Platform Wallet Service (Current)
- [ ] Phase 4: Frontend Integration
- [ ] Phase 5: Cost Estimation Service
- [ ] Phase 6: Refund System
- [ ] Phase 7: Testing & Production Deployment

## Related Documentation

- [Phase 1: Payment Infrastructure](./X402_PAYMENT_INTEGRATION_PHASE1.md)
- [Phase 2: Deployment Queue](./X402_PAYMENT_INTEGRATION_PHASE2.md)
- [Quick Reference Guide](./X402_QUICK_REFERENCE.md)
- [Escrow System Overview](./ESCROW_SYSTEM.md)

---

**Status**: Phase 3 ✅ Complete  
**Next**: Phase 4 - Frontend Integration (USDC payment UI)
