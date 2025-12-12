# Backend Support for Bounty-Specific Contract Addresses

## Overview

The backend API **already returns bounty-specific contract addresses** in the wallet lookup response. This fix simply ensures the frontend properly types and uses this data.

## API Endpoint

### GET `/wallet/lookup`

**Purpose**: Look up a company by wallet address and retrieve all associated bounties with their escrow contract addresses

**URL**: `GET /wallet/lookup?address={address}&chain={chain}`

**Parameters**:
- `address` (required): Ethereum wallet address (0x + 40 hex chars)
- `chain` (required): `ethereum` or `avalanche`

**Response Example**:

```json
{
  "company": {
    "id": "comp-550e8400-e29b-41d4-a716-446655440000",
    "name": "Acme Corporation",
    "description": "Leading innovation company",
    "industry": "Technology",
    "logo": "https://..."
  },
  "bounties": [
    {
      "id": "bounty-uuid-1",
      "title": "Marketing Campaign Fund",
      "description": "Support for Q1 2024 marketing initiatives",
      "targetAmount": 5,
      "currentAmount": 2.3,
      "chain": "ethereum",
      "status": "active",
      "contractAddress": "0x7890abc1def2345678901234567890abcdef5678"
    },
    {
      "id": "bounty-uuid-2",
      "title": "Infrastructure Upgrade",
      "description": "Server infrastructure and DevOps improvements",
      "targetAmount": 10,
      "currentAmount": 7.8,
      "chain": "ethereum",
      "status": "active",
      "contractAddress": "0x1234def5abc6789012345678901234567890abc1"
    },
    {
      "id": "bounty-uuid-3",
      "title": "Hiring Bounty",
      "description": "Bounty for hiring senior engineers",
      "targetAmount": 15,
      "currentAmount": 0,
      "chain": "ethereum",
      "status": "active",
      "contractAddress": "0x5678abc1def2345678901234567890abcdef1234"
    }
  ]
}
```

## What the Backend is Doing

### WalletGenerationService.lookupWalletAddress()

**File**: `backend/src/web3/wallet-generation.service.ts`

**Code**:
```typescript
async lookupWalletAddress(address: string, chain: 'ethereum' | 'avalanche') {
  // Find company by wallet address
  const company = await this.companiesService.findByWalletAddress(
    address,
    chain
  );
  
  if (!company) {
    throw new BadRequestException('Company not found');
  }

  // Get all active bounties (EscrowDeployments) for this company
  const deployments = await this.escrowDeploymentRepository.find({
    where: {
      company: { id: company.id },
      deadline: MoreThan(new Date()),  // Only active bounties
      status: 'active'
    },
    relations: ['wishlistItem']
  });

  // Map deployments to bounty format
  const bounties = deployments.map(d => ({
    id: d.id,
    title: d.wishlistItem.title,
    description: d.wishlistItem.description,
    targetAmount: d.targetAmountEth,
    currentAmount: d.totalRaised,  // From blockchain sync
    chain: d.chain,
    status: d.status,
    contractAddress: d.contractAddress  // ← ESCROW CONTRACT ADDRESS!
  }));

  return {
    company: {
      id: company.id,
      name: company.name,
      description: company.description,
      industry: company.industry,
      logo: company.logo
    },
    bounties
  };
}
```

### Key Points

1. **EscrowDeployment Entity**: Already has `contractAddress` column
2. **Query Filters**: Only returns active bounties (deadline in future)
3. **Data Mapping**: Maps database fields to API response format
4. **Contract Address**: Included in response for each bounty

## How Frontend Uses This

### Before Fix
- Backend returned `contractAddress` ✅
- Frontend received it ✅
- Frontend **ignored it** ❌
- Bounty selection didn't use it ❌

### After Fix
- Backend returns `contractAddress` ✅
- Frontend types it in BountyOption interface ✅
- Frontend receives it ✅
- Frontend **uses it** ✅
- Bounty selection updates recipient address ✅

## Database Schema

### EscrowDeployment Table

```sql
CREATE TABLE "escrow_deployments" (
  "id" uuid PRIMARY KEY,
  "wishlistItemId" uuid NOT NULL REFERENCES wishlist_items(id),
  "companyId" uuid NOT NULL REFERENCES companies(id),
  "contractAddress" varchar NOT NULL,  -- Escrow contract address
  "chain" varchar NOT NULL,             -- 'ethereum' | 'avalanche'
  "network" varchar NOT NULL,           -- 'sepolia' | 'fuji'
  "targetAmountEth" decimal NOT NULL,
  "totalRaised" decimal DEFAULT 0,
  "durationInDays" integer NOT NULL,
  "deadline" timestamp NOT NULL,
  "status" varchar DEFAULT 'active',
  "deploymentTxHash" varchar,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
);
```

### Contribution Table (For Attribution)

```sql
CREATE TABLE "contributions" (
  "id" uuid PRIMARY KEY,
  "escrowDeploymentId" uuid NOT NULL REFERENCES escrow_deployments(id),
  "wishlistItemId" uuid NOT NULL REFERENCES wishlist_items(id),
  "companyId" uuid NOT NULL REFERENCES companies(id),
  "contributorAddress" varchar NOT NULL,
  "amountWei" varchar NOT NULL,        -- Large number as string
  "amountEth" decimal,
  "amountUsd" decimal,
  "transactionHash" varchar NOT NULL,
  "blockNumber" integer,
  "timestamp" timestamp,
  "isRefunded" boolean DEFAULT false,
  "refundedAt" timestamp,
  "refundTxHash" varchar,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
);
```

### Data Relationship

```
Company
  ├─ Wallet Address (ethAddress / avaxAddress)
  └─ WishlistItem[0..N]
     └─ EscrowDeployment (has contractAddress)
        └─ Contribution[0..N] (tracks each investor)
```

## API Response Flow

### Step 1: Frontend sends lookup request
```javascript
GET /wallet/lookup?address=0x1234...abcd&chain=ethereum
```

### Step 2: Backend queries database
```
1. Find company by ethAddress = 0x1234...abcd
2. Get all active bounties (EscrowDeployment) for this company
3. For each bounty, include contractAddress
```

### Step 3: Backend returns response
```json
{
  "company": { ... },
  "bounties": [
    { ..., "contractAddress": "0x7890...xyza" },
    { ..., "contractAddress": "0x5678...vwxy" }
  ]
}
```

### Step 4: Frontend receives and uses data
```svelte
// Before fix: bounties received but contractAddress ignored
bounties = response.bounties;  // contractAddress here but unused

// After fix: bounties with contractAddress properly used
lookedUpCompany = response;
$effect(() => {
  const bounty = lookedUpCompany.bounties.find(b => b.id === selectedBountyId);
  recipientAddress = bounty.contractAddress;  // ← USE IT!
});
```

## Why This Works

### Trust Chain

```
1. User selects bounty from dropdown
   ↓
2. Frontend updates recipientAddress to bounty.contractAddress
   ↓
3. contractAddress came from database (set at contract deployment)
   ↓
4. Database has deploymentTxHash proving contract was deployed
   ↓
5. Investor can verify:
   - Contract deployed at that address ✅
   - Contract belongs to that bounty ✅
   - Their funds go to correct contract ✅
```

### No Manual Mapping Needed

Backend handles all mapping:
- Company lookup from wallet ✓
- Bounty discovery ✓
- Contract address retrieval ✓
- Data formatting ✓

Frontend just needs to:
- Type the data correctly ✓
- Use the contractAddress when user selects bounty ✓

## Verification

### Check Backend API
To verify the endpoint returns contract addresses:

```bash
curl "http://localhost:3000/wallet/lookup?address=0xcompanyaddress&chain=ethereum" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Look for `contractAddress` in each bounty object.

### Check Frontend Type Matching
Verify that BountyOption interface in SendFunds.svelte includes:
```typescript
contractAddress: string;
```

### Check Reactive Effect
Verify that $effect updates recipientAddress when selectedBountyId changes.

## Production Readiness

✅ Backend API ready (no changes needed)  
✅ Database schema ready (no migrations needed)  
✅ Frontend types updated  
✅ Frontend reactive binding added  
✅ Frontend UI indicators added  
✅ Ready for deployment  

## Summary

The backend was **already** returning bounty-specific contract addresses through the `/wallet/lookup` API endpoint. This fix ensures the frontend:

1. **Types** the data correctly
2. **Uses** the data when user selects a bounty
3. **Shows** the user which contract address will receive their funds
4. **Maintains** trust by sending funds directly to escrow contracts

No backend changes, no database changes, no API changes needed. Just frontend improvements to use existing backend functionality.
