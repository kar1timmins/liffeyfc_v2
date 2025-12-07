# Company Wishlist Escrow System

## Overview

The Company Wishlist Escrow System is a blockchain-based solution for managing fundraising campaigns on both Ethereum and Avalanche networks. It implements a time-bound, all-or-nothing escrow mechanism where funds are held securely until the target amount is reached.

## Architecture

### Smart Contracts

#### 1. CompanyWishlistEscrow.sol
The main escrow contract that holds funds for a single fundraising campaign.

**Features:**
- ✅ Time-bound fundraising (configurable duration in days)
- ✅ All-or-nothing funding (refund if target not met)
- ✅ Transparent contribution tracking
- ✅ Automatic fund release when target is reached
- ✅ Refund mechanism if campaign fails
- ✅ Multiple contributor support

**Key Functions:**
- `contribute()` - Accept contributions from investors
- `finalize()` - Finalize campaign after deadline
- `claimRefund()` - Claim refund if campaign failed
- `getCampaignStatus()` - Get current campaign state
- `getProgressPercentage()` - Calculate funding progress

#### 2. EscrowFactory.sol
Factory contract for deploying and tracking multiple escrow contracts.

**Features:**
- ✅ Deploy new escrow contracts
- ✅ Track all escrows by company
- ✅ Query escrow details
- ✅ Event emissions for indexing

### Backend Services

#### 1. EscrowContractService
Service for interacting with deployed smart contracts.

**Capabilities:**
- Deploy escrow contracts to Ethereum/Avalanche
- Query campaign status from blockchain
- Sync database with on-chain state
- Get company escrow history

#### 2. EscrowController
REST API endpoints for escrow operations.

**Endpoints:**
- `POST /escrow/create` - Create new escrow contracts
- `GET /escrow/status/:wishlistItemId` - Get campaign status
- `POST /escrow/sync/:wishlistItemId` - Sync with blockchain
- `GET /escrow/company/:companyId` - Get company escrows
- `GET /escrow/health` - Check system configuration

## Setup & Deployment

### 1. Install Dependencies

```bash
# In hardhat directory
cd hardhat
pnpm install

# In backend directory  
cd ../backend
# ethers is already installed
```

### 2. Configure Environment Variables

Create `hardhat/.env`:
```bash
# Private key for deploying contracts (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# Ethereum RPC URLs
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
ETHEREUM_MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY

# Avalanche RPC URLs
AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc

# Block explorer API keys
ETHERSCAN_API_KEY=your_etherscan_api_key
SNOWTRACE_API_KEY=your_snowtrace_api_key
```

Update `backend/.env` and root `.env`:
```bash
# Web3 Configuration
WEB3_PRIVATE_KEY=your_private_key_here
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc

# Factory contract addresses (after deployment)
ETHEREUM_FACTORY_ADDRESS=0x...
AVALANCHE_FACTORY_ADDRESS=0x...
```

### 3. Compile Contracts

```bash
cd hardhat
npx hardhat compile
```

### 4. Deploy Factory Contracts

#### Deploy to Ethereum Sepolia (Testnet)
```bash
npx hardhat run scripts/deploy-factory.ts --network sepolia
```

#### Deploy to Avalanche Fuji (Testnet)
```bash
npx hardhat run scripts/deploy-factory.ts --network fuji
```

#### Deploy to Production
```bash
# Ethereum Mainnet
npx hardhat run scripts/deploy-factory.ts --network ethereum

# Avalanche C-Chain
npx hardhat run scripts/deploy-factory.ts --network avalanche
```

### 5. Update Environment with Factory Addresses

After deployment, update the factory addresses in your `.env` files.

### 6. Run Database Migration

The wishlist entity has been updated with new escrow fields. Run a migration:

```bash
cd backend
pnpm run migration:generate -- src/migrations/add-escrow-fields
pnpm run migration:run
```

Or with synchronization enabled (development only):
```bash
# Just restart the backend - TypeORM will auto-sync
docker compose restart backend
```

## Usage

### 1. Create a Wishlist Item

First, create a wishlist item through the existing API:

```bash
POST /companies/:companyId/wishlist
{
  "title": "Series A Funding",
  "description": "Seeking $500K for product development",
  "value": 500000,
  "category": "funding",
  "priority": "high"
}
```

### 2. Deploy Escrow Contracts

Create escrow contracts for the wishlist item:

```bash
POST /escrow/create
Authorization: Bearer <jwt_token>
{
  "wishlistItemId": "uuid-of-wishlist-item",
  "targetAmountEth": 0.5,  // 0.5 ETH target
  "durationInDays": 30,    // 30-day campaign
  "chains": ["ethereum", "avalanche"]  // Deploy to both chains
}
```

**Response:**
```json
{
  "success": true,
  "message": "Escrow contracts deployed successfully",
  "data": {
    "ethereumAddress": "0x1234...",
    "avalancheAddress": "0x5678...",
    "transactionHashes": {
      "ethereum": "0xabcd...",
      "avalanche": "0xef01..."
    }
  }
}
```

### 3. Monitor Campaign Status

```bash
GET /escrow/status/:wishlistItemId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "wishlistItemId": "uuid",
    "ethereum": {
      "totalRaised": "0.25",
      "targetAmount": "0.5",
      "deadline": "2025-01-15T00:00:00.000Z",
      "timeRemaining": 1296000,
      "isFinalized": false,
      "isSuccessful": false,
      "contributorCount": 5,
      "progressPercentage": 50,
      "isActive": true
    },
    "avalanche": { /* same structure */ }
  }
}
```

### 4. Investors Contribute

Investors can contribute directly to the contract address using:
- MetaMask
- Hardware wallets
- Any Web3-enabled wallet

```javascript
// Example: Contributing with ethers.js
const escrowContract = new ethers.Contract(
  escrowAddress,
  ESCROW_ABI,
  signer
);

// Contribute 0.1 ETH
await escrowContract.contribute({ value: ethers.parseEther("0.1") });
```

### 5. Sync Database with Blockchain

Periodically sync the database to reflect on-chain state:

```bash
POST /escrow/sync/:wishlistItemId
```

This updates:
- `amountRaised`
- `isEscrowActive`
- `isEscrowFinalized`
- `isFulfilled`

### 6. Campaign Completion

**If Target Reached:**
- Funds are automatically released to company wallet
- `isSuccessful = true`
- `isFulfilled = true`

**If Target Not Reached:**
- Contributors can claim refunds
- `isSuccessful = false`
- Refunds processed individually

## API Reference

### POST /escrow/create
Create new escrow contracts for a wishlist item.

**Authentication:** Required (JWT)

**Body:**
```typescript
{
  wishlistItemId: string;
  targetAmountEth: number;
  durationInDays: number;
  chains?: ('ethereum' | 'avalanche')[];
}
```

### GET /escrow/status/:wishlistItemId
Get current campaign status from blockchain.

**Response:** Campaign status for all deployed chains

### POST /escrow/sync/:wishlistItemId
Sync wishlist item with blockchain state.

**Response:** Updated wishlist item

### GET /escrow/company/:companyId
Get all escrow contracts for a company.

**Response:** Array of escrow addresses by chain

### GET /escrow/health
Check if escrow system is configured.

**Response:** Configuration status

## Database Schema

### WishlistItem Entity (Updated)

New fields added:
```typescript
// Smart contract escrow fields
ethereumEscrowAddress?: string;      // Ethereum escrow contract address
avalancheEscrowAddress?: string;     // Avalanche escrow contract address
campaignDeadline?: Date;             // Campaign end date
campaignDurationDays?: number;       // Duration in days
isEscrowActive: boolean;             // Is campaign currently active
isEscrowFinalized: boolean;          // Has campaign been finalized
```

## Security Considerations

### Smart Contract Security
- ✅ Reentrancy protection (Checks-Effects-Interactions pattern)
- ✅ Custom errors for gas optimization
- ✅ Immutable critical variables
- ✅ Time-based access control
- ✅ Failed transfer handling

### Backend Security
- ✅ JWT authentication for contract deployment
- ✅ Ownership verification
- ✅ Input validation
- ✅ Private key management via environment variables

### Best Practices
1. **Never commit private keys** - Use environment variables
2. **Test on testnets first** - Sepolia, Fuji before mainnet
3. **Verify contracts** - Use Etherscan/Snowtrace verification
4. **Audit before production** - Get smart contracts audited
5. **Monitor gas prices** - Optimize deployment timing
6. **Use hardware wallets** - For production deployments

## Testing

### Unit Tests (Smart Contracts)
```bash
cd hardhat
npx hardhat test
```

### Integration Tests (Backend)
```bash
cd backend
pnpm test
```

### Manual Testing Flow
1. Deploy factory to testnet
2. Create test company with wallet
3. Create wishlist item
4. Deploy escrow contracts
5. Make test contributions
6. Verify status updates
7. Test finalization (success/failure)
8. Test refunds

## Troubleshooting

### Contract Deployment Fails
- Check private key is set correctly
- Verify sufficient ETH/AVAX for gas
- Confirm RPC URL is accessible
- Check network configuration

### Status Not Updating
- Run manual sync: `POST /escrow/sync/:wishlistItemId`
- Verify RPC URLs are working
- Check contract addresses are correct

### Contributions Not Showing
- Blockchain confirmations may take time
- Run sync to update database
- Verify transaction on block explorer

## Roadmap

### Phase 1 (Current)
- ✅ Basic escrow contracts
- ✅ Factory deployment
- ✅ Backend integration
- ✅ Status tracking

### Phase 2 (Next)
- 🔄 Frontend integration
- 🔄 Contribution UI
- 🔄 Campaign dashboard
- 🔄 Real-time updates

### Phase 3 (Future)
- ⏭️ Multi-currency support
- ⏭️ Partial refunds
- ⏭️ Milestone-based releases
- ⏭️ Governance features
- ⏭️ NFT rewards for contributors

## Support

For issues or questions:
1. Check this documentation
2. Review smart contract comments
3. Check backend service logs
4. Open GitHub issue

---

**Built with:**
- Solidity ^0.8.20
- Hardhat
- ethers.js v6
- NestJS
- TypeORM
