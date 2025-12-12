# Master Wallet Fund Forwarding System

## Overview

The Master Wallet Fund Forwarding system automatically routes all bounty campaign funds to the user's master wallet when a campaign completes successfully. This eliminates the risk of funds being trapped in company child wallets and provides a centralized location for fund management.

## Why This Matters

### Problem
- Users create company profiles with unique child wallet addresses
- When bounties/campaigns are created, they receive funds at the **company child wallet**
- If a user loses access to child wallet private keys or wants to consolidate funds, those funds could be at risk
- Multiple child wallets across different companies make fund management complicated

### Solution
- All successful campaign funds are automatically sent to the **master wallet**
- Users only need to secure their master wallet's seed phrase/private key
- Centralized fund management across all companies
- Reduced operational complexity

## Architecture

### Three-Wallet Hierarchy

```
┌─────────────────────────────────────────┐
│  User's Master Wallet (Fund Recipient)   │  ◄─── All funds forwarded here
│  0xBECE60A8fc74A3Ae7caD4b850c5Ac...     │
└─────────────────────────────────────────┘
           ▲                    ▲
           │                    │
  ┌────────┴──────────┬─────────┴────────────┐
  │                   │                      │
  │      Company 1    │     Company 2        │
  │     (Child 1)     │    (Child 2)         │
  │ 0x1234567890ab... │ 0x5678901234ab...   │
  │                   │                      │
  │ [Bounty 1]        │  [Bounty 1]          │
  │ [Bounty 2]        │  [Bounty 2]          │
  │ [Bounty 3]        │  [Bounty 3]          │
  │                   │                      │
  │ Escrow Contract   │  Escrow Contract     │
  │ 0xABCDef12...     │  0xEF0123ABCD...     │
  │                   │                      │
  │ Funds collected   │  Funds collected     │
  │ ──(on success)──► Master Wallet         │
  │                   ◄──(on success)───    │
  └───────────────────┴────────────────────┘
```

## Smart Contract Changes

### CompanyWishlistEscrow.sol

**New Constructor Parameter:**
```solidity
constructor(
    address _company,           // Child wallet (for identification)
    address _masterWallet,      // NEW: Master wallet for fund forwarding
    uint256 _targetAmount,
    uint256 _durationInDays
)
```

**Fund Release Logic:**
```solidity
function _releaseFunds() private {
    // Send funds to MASTER WALLET, not company wallet
    (bool success, ) = masterWallet.call{value: totalRaised}("");
    if (!success) revert TransferFailed();
    
    emit FundsReleased(masterWallet, totalRaised);
}
```

### EscrowFactory.sol

**Updated createEscrow Method:**
```solidity
function createEscrow(
    address _company,           // Child wallet
    address _masterWallet,      // NEW: Master wallet address
    uint256 _targetAmount,
    uint256 _durationInDays
) external returns (address escrowAddress)
```

## Backend Integration

### Escrow Controller (`escrow.controller.ts`)

When creating escrow contracts:

```typescript
// Get user's master wallet
const user_ = await this.userRepo.findOne({
  where: { id: user.sub },
  relations: ['userWallet'],
});

const masterWalletAddress = user_.userWallet.ethAddress || user_.userWallet.avaxAddress;

// Deploy with master wallet as recipient
const result = await this.escrowService.deployEscrowContracts(
  user.sub,
  dto.wishlistItemId,
  companyWalletAddress,     // Company child wallet
  masterWalletAddress,      // NEW: Master wallet for funds
  dto.targetAmountEth,
  dto.durationInDays,
  dto.chains
);
```

### Escrow Contract Service (`escrow-contract.service.ts`)

Updated deployment to pass master wallet:

```typescript
async deployEscrowContracts(
  userId: string,
  wishlistItemId: string,
  companyWalletAddress: string,
  masterWalletAddress: string,    // NEW parameter
  targetAmountEth: number,
  durationInDays: number,
  chains: ('ethereum' | 'avalanche')[] = ['ethereum', 'avalanche']
)

// When calling factory:
const tx = await factory.createEscrow(
  companyWalletAddress,
  masterWalletAddress,      // Pass master wallet
  targetAmountWei,
  durationInDays
);
```

## Fund Flow Diagram

### Successful Campaign

```
Contributor sends ETH/AVAX
        ↓
  [Escrow Contract]
  (holds funds in escrow)
        ↓
Campaign deadline reached / target met
        ↓
finalize() called
        ↓
_releaseFunds() executes
        ↓
Funds automatically sent to:
  ▼▼▼ MASTER WALLET ▼▼▼
  (0xBECE60A8fc74...)
```

### Failed Campaign

```
Campaign deadline passed / target not met
        ↓
finalize() called
        ↓
Contributors call claimRefund()
        ↓
Refund = contribution - (proportional gas fee)
        ↓
Funds sent back to individual contributors
        ↓
Remaining gas reserve stays in contract
```

## User Benefits

1. **Security**: Master wallet is the single point of control
2. **Convenience**: No need to manage funds across multiple child wallet addresses
3. **Consolidation**: All campaign revenue flows to one location
4. **Simplicity**: Users only need to secure their master wallet seed phrase
5. **Auditability**: Easy to track all bounty contributions going to one address

## Deployment Requirements

### Environment Variables
No new environment variables needed. The system automatically retrieves the master wallet from the user's database record when deploying contracts.

### Database
- User must have a `UserWallet` record with `ethAddress` or `avaxAddress` set
- Error handling: If user lacks a master wallet, deployment will fail with clear error message

### Smart Contracts
- Deploy new versions of `CompanyWishlistEscrow.sol` and `EscrowFactory.sol`
- Both contracts now require master wallet address as parameter

## Migration Path

### For New Bounties
- All new bounties automatically use master wallet fund forwarding
- No additional user action required

### For Existing Bounties
- Existing bounties continue to work as before (funds to child wallet)
- Users can re-deploy bounties to activate master wallet forwarding
- Database records are preserved; historical data remains intact

## Example Scenario

1. **User Setup**:
   - User generates master wallet: `0xBECE60A8fc74...`
   - User creates Company A with child wallet: `0x1234567890ab...`
   - User creates Company B with child wallet: `0x5678901234ab...`

2. **Campaign Creation**:
   - Company A creates Bounty 1: "Need $5000 for marketing"
   - System deploys escrow contract with:
     - Company wallet: `0x1234567890ab...` (for identification)
     - Master wallet: `0xBECE60A8fc74...` ⭐

3. **Funding**:
   - Investors contribute ETH to bounty
   - Funds held in escrow contract

4. **Campaign Success**:
   - Target reached or deadline with sufficient funds
   - Contract calls `_releaseFunds()`
   - Funds automatically sent to: `0xBECE60A8fc74...` (master wallet)

5. **Result**:
   - User checks master wallet balance
   - Sees $5000 (plus any additional bounties) in single location
   - No need to check child wallet addresses

## Technical Details

### Wallet Address Selection

The system selects wallet addresses with this priority:

**For Company Wallet:**
1. Use `company.ethAddress` if available
2. Fallback to `company.avaxAddress`

**For Master Wallet:**
1. Use `userWallet.ethAddress` if available
2. Fallback to `userWallet.avaxAddress`

This allows flexibility for users with only one chain configured or preference for one network.

### Error Handling

If master wallet is not configured:

```
Error: User does not have a master wallet configured
HTTP Status: 400 Bad Request
```

Solution: User must generate or restore wallet through profile page first.

## Logging

Backend logs fund forwarding clearly:

```
📝 Deploying escrow contracts for wishlist item: [id]
   Company Wallet: 0x1234567890ab...
   Master Wallet (funds recipient): 0xBECE60A8fc74...
```

## Future Enhancements

1. **Multi-chain Consolidation**: Forward Ethereum AND Avalanche funds to single address
2. **Custom Recipient**: Allow users to specify alternative fund recipient
3. **Batch Withdrawals**: Accumulate funds and batch-transfer to reduce gas costs
4. **Fund Distribution**: Allow users to split funds among multiple addresses
5. **Automated Disbursement**: Release funds to sub-accounts after campaign completion

## FAQ

**Q: What if I only configured a master wallet on Ethereum?**
A: The system will use your Ethereum address. If you have a bounty on Avalanche, funds will go to your Avalanche address if configured; otherwise, campaign deployment will fail with clear error.

**Q: Can I change my master wallet after creating bounties?**
A: Future bounties will use the new master wallet. Existing bounties continue to the original configuration. If you need to change, re-deploy the bounty.

**Q: Are funds safer in master wallet?**
A: Master wallet is your primary private key location. Secure it as carefully as your seed phrase. Best practice: backup seed phrase, use hardware wallet if possible.

**Q: What happens to child wallet addresses?**
A: Child wallets still exist for company identification and receive no funds now. They're useful for linking bounties to specific companies while master wallet holds the value.

## References

- Smart Contracts: `/hardhat/contracts/CompanyWishlistEscrow.sol`, `/hardhat/contracts/EscrowFactory.sol`
- Backend: `/backend/src/web3/escrow.controller.ts`, `/backend/src/web3/escrow-contract.service.ts`
- Entities: `User`, `UserWallet`, `Company`, `EscrowDeployment`
