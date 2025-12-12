# Master Wallet Fund Forwarding - Quick Reference Guide

## Fund Flow Chart

```
┌─────────────────────────────────────────────────────────────────┐
│                      BOUNTY CAMPAIGN LIFECYCLE                   │
└─────────────────────────────────────────────────────────────────┘

1. CREATION
   User creates bounty for company
          ↓
   System fetches master wallet (0xBECE...)
          ↓
   Deploys escrow with:
   - Company: 0x1234... (child wallet - for identification)
   - Master: 0xBECE... (master wallet - for funds)
          ↓

2. CAMPAIGN ACTIVE
   Investors contribute ETH/AVAX
          ↓
   Funds held in escrow contract
          ↓
   Campaign tracks total raised vs. target
          ↓

3a. SUCCESS PATH
    Target reached OR deadline + sufficient funds
           ↓
    _releaseFunds() executes
           ↓
    Transfer totalRaised → Master Wallet (0xBECE...)
           ↓
    ✅ USER RECEIVES FUNDS IN MASTER WALLET
           ↓

3b. FAILURE PATH
    Deadline passed without reaching target
           ↓
    Contributors call claimRefund()
           ↓
    Calculate: refund = contribution - (proportional gas fee)
           ↓
    Transfer refund → Individual Contributor
           ↓
    ✅ CONTRIBUTORS GET REFUNDS
    ⚠️ MASTER WALLET DOES NOT RECEIVE FUNDS
           ↓

4. CLEANUP
   Gas reserve remains in escrow (covers refund gas costs)
   Contract marked as finalized
```

## Address Mapping

```
USER ACCOUNT
│
├─ Master Wallet (User's Primary Key)
│  │
│  ├─ Address (Ethereum): 0xBECE60A8fc74A3Ae7caD4b850c5Ac04051787257
│  ├─ Address (Avalanche): 0xABCD...
│  └─ Mnemonic: Encrypted in database
│
├─ Company A (Child Wallet 1)
│  ├─ Address (Ethereum): 0x1234567890ABCDEF...
│  ├─ Address (Avalanche): 0x5678ABCDEF...
│  │
│  └─ Bounties
│     ├─ Bounty 1: Escrow 0xABC123...
│     │  ├─ Company: 0x1234... (for ID)
│     │  └─ Master: 0xBECE... ⭐ (funds go here on success)
│     │
│     └─ Bounty 2: Escrow 0xDEF456...
│        ├─ Company: 0x1234... (for ID)
│        └─ Master: 0xBECE... ⭐ (funds go here on success)
│
└─ Company B (Child Wallet 2)
   ├─ Address (Ethereum): 0x9876FEDCBA...
   ├─ Address (Avalanche): 0xFEDC...
   │
   └─ Bounties
      └─ Bounty 1: Escrow 0xGHI789...
         ├─ Company: 0x9876... (for ID)
         └─ Master: 0xBECE... ⭐ (funds go here on success)
```

## Code Changes Summary

### Smart Contract Changes

```solidity
// BEFORE (old version)
constructor(
    address _company,
    uint256 _targetAmount,
    uint256 _durationInDays
)

// AFTER (new version)
constructor(
    address _company,
    address _masterWallet,    // ← NEW
    uint256 _targetAmount,
    uint256 _durationInDays
)

// BEFORE (fund release)
function _releaseFunds() private {
    (bool success, ) = company.call{value: totalRaised}("");
    emit FundsReleased(company, totalRaised);
}

// AFTER (fund release to master)
function _releaseFunds() private {
    (bool success, ) = masterWallet.call{value: totalRaised}("");
    emit FundsReleased(masterWallet, totalRaised);
    //                 ^^^^^^^^^^^^ CHANGED
}
```

### Backend Changes

```typescript
// BEFORE (deployment call)
await this.escrowService.deployEscrowContracts(
  user.sub,
  wishlistItemId,
  companyWalletAddress,
  targetAmountEth,
  durationInDays,
  chains
);

// AFTER (deployment call with master wallet)
const masterWallet = user_.userWallet.ethAddress;
await this.escrowService.deployEscrowContracts(
  user.sub,
  wishlistItemId,
  companyWalletAddress,
  masterWallet,                 // ← NEW
  targetAmountEth,
  durationInDays,
  chains
);

// BEFORE (contract call to factory)
await factory.createEscrow(
  companyWalletAddress,
  targetAmountWei,
  durationInDays
);

// AFTER (contract call with master wallet)
await factory.createEscrow(
  companyWalletAddress,
  masterWalletAddress,      // ← NEW
  targetAmountWei,
  durationInDays
);
```

## Deployment Commands

### Deploy Smart Contracts
```bash
# Ethereum Sepolia
cd hardhat
npx hardhat run scripts/deploy-factory.ts --network sepolia
# Note: ETHEREUM_FACTORY_ADDRESS=0x...

# Avalanche Fuji
npx hardhat run scripts/deploy-factory.ts --network fuji
# Note: AVALANCHE_FACTORY_ADDRESS=0x...
```

### Update Environment
```bash
# .env file
ETHEREUM_FACTORY_ADDRESS=0x<address-from-deployment>
AVALANCHE_FACTORY_ADDRESS=0x<address-from-deployment>
```

### Deploy Backend
```bash
cd backend
pnpm install
pnpm build
pnpm start:dev
# OR
docker-compose up -d backend
```

## Verification Checklist

### Database
```sql
-- Verify user has master wallet
SELECT * FROM user_wallets WHERE userId = '<user-id>';
-- Should show: ethAddress and/or avaxAddress populated

-- Verify bounty deployment
SELECT 
  ed.contractAddress,
  ed.chain,
  ed.status
FROM escrow_deployments ed
WHERE ed.wishlistItemId = '<bounty-id>';
-- Should show: contractAddress filled for each chain
```

### Blockchain
```bash
# Check contract storage (Ethereum Sepolia)
cast call 0x<escrow-address> "masterWallet()" --rpc-url $SEPOLIA_RPC
# Should return: 0xBECE60A8fc74A3Ae7caD4b850c5Ac04051787257

# Check company address (for reference)
cast call 0x<escrow-address> "company()" --rpc-url $SEPOLIA_RPC
# Should return: 0x1234567890ABCDEF...
```

### Logs
```bash
# Check deployment logs
docker-compose logs backend | grep "Master Wallet"
# Should show: "Master Wallet (funds recipient): 0xBECE..."
```

## Error Messages & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "User does not have a master wallet configured" | User wallet not created | User must generate/restore wallet on profile page |
| "InvalidAddress" (from contract) | Master wallet is 0x0... | Verify user wallet in database |
| "Factory addresses are not configured" | ENV vars not set | Set ETHEREUM_FACTORY_ADDRESS and AVALANCHE_FACTORY_ADDRESS |
| "Company must have at least one wallet address configured" | Company wallet generation failed | Create company and verify child wallets created |
| "No contracts were deployed" | Factory not working | Verify factory contract addresses and RPC endpoints |

## Testing Workflow

### 1. Setup Test User
```
1. Go to /auth
2. Register new account
3. Go to /profile
4. Click "Generate New Wallet"
5. ✅ Master wallet created (save seed phrase!)
```

### 2. Create Test Company
```
1. Go to /companies
2. Click "Create Company"
3. Fill form and submit
4. ✅ Company created with child wallet (unique address)
```

### 3. Create Test Bounty
```
1. Click company card
2. Click "Create Bounty"
3. Select wishlist item
4. Set amount (use test value)
5. Click "Deploy to Blockchain"
6. ✅ Escrow deployed
```

### 4. Verify Fund Forwarding
```
1. Open blockchain explorer
2. Search escrow address
3. Click "Contract" tab
4. Check state variables
5. ✅ masterWallet should show your master address
```

### 5. Test Campaign Success
```
1. Contribute small amount
2. Reach target
3. Wait for finalization
4. ✅ Funds appear in master wallet
```

## Environment Variable Reference

```bash
# Production Smart Contracts
ETHEREUM_FACTORY_ADDRESS=0x<deployed-factory-address>
AVALANCHE_FACTORY_ADDRESS=0x<deployed-factory-address>

# RPC Providers (fallbacks already configured)
# These are optional - system has built-in fallbacks
# ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/...
# AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc

# User keys (for deployment signer - already in database)
# Do NOT set these - system uses database
```

## Feature Flags

Currently no feature flags - fund forwarding is always enabled for new bounties.

### If Rollback Needed
1. Revert smart contract changes
2. Redeploy factory
3. Update `ETHEREUM_FACTORY_ADDRESS` and `AVALANCHE_FACTORY_ADDRESS`
4. Backend automatically uses new factory

## Performance Impact

- **Database**: 1 additional query per bounty creation (fetch master wallet)
- **Smart Contract**: 1 additional parameter in constructor
- **Gas Cost**: No difference in deployment or execution
- **Network**: No additional RPC calls

## Security Checklist

- ✅ Master wallet address validated (non-zero)
- ✅ Master wallet address immutable after deployment
- ✅ Master wallet address stored safely in smart contract
- ✅ Only authenticated users can deploy bounties
- ✅ Users must have master wallet configured
- ✅ Clear error messages for misconfiguration
- ✅ Existing bounties unaffected (backward compatible)

## FAQ

**Q: Can I change my master wallet after creating a bounty?**  
A: No. Once deployed, the contract's master wallet is immutable. New bounties will use your current master wallet.

**Q: What if I have different master wallets on Ethereum vs Avalanche?**  
A: The system uses whichever is available (prefers ETH). Both work if configured.

**Q: Do old bounties still work?**  
A: Yes, old bounties continue to send funds to company wallet. Only new bounties use master wallet.

**Q: Is this mandatory?**  
A: Yes for new bounties, optional for users (master wallet still required, but not forced to create bounties).

**Q: What happens to child wallets?**  
A: Child wallets still exist and are used for company identification. They no longer receive funds but don't need to be managed.

## Quick Links

- 📖 [Full Documentation](./MASTER_WALLET_FUND_FORWARDING.md)
- 🚀 [Deployment Guide](./MASTER_WALLET_FUND_FORWARDING_DEPLOYMENT.md)
- 📋 [Implementation Details](./MASTER_WALLET_FUND_FORWARDING_IMPLEMENTATION.md)
- 🔗 Smart Contracts: `/hardhat/contracts/`
- 🖥️ Backend Services: `/backend/src/web3/`
