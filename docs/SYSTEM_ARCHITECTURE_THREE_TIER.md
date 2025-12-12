# System Architecture - Address Hierarchy Visualization

## Current Complete Architecture (No Changes Needed!)

### Overview: Three-Tier Address System

```
┌────────────────────────────────────────────────────────────────┐
│                   COMPLETE SYSTEM VIEW                          │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    TIER 1: USER WALLET                           │
│                  (Investor's MetaMask)                           │
│                    0x5555...5555                                 │
│                          │                                       │
│                          ↓ (Sends funds TO →)                   │
│                                                                  │
│        ┌──────────────────────────────────────────┐             │
│        │ TIER 2: COMPANY WALLET (DB Stored)       │             │
│        │ ethAddress: 0x1234...abcd                │             │
│        │ avaxAddress: 0x9999...aaaa               │             │
│        │ Used for: Company operations              │             │
│        └──────────────────────────────────────────┘             │
│                          │                                       │
│                          ↓ (Company HAS →)                      │
│                                                                  │
│   ┌──────────────────────────────────────────────────────┐     │
│   │ TIER 3: BOUNTY ESCROW CONTRACTS (Per Bounty)         │     │
│   │                                                        │     │
│   │ Bounty 1: Marketing Fund                             │     │
│   │ └─ contractAddress: 0x7890...xyza                    │     │
│   │ └─ company address: 0x1234...abcd                    │     │
│   │ └─ Receives contributions from investors              │     │
│   │ └─ Releases to company if target met                 │     │
│   │                                                        │     │
│   │ Bounty 2: Infrastructure                             │     │
│   │ └─ contractAddress: 0x5678...vwxy                    │     │
│   │ └─ company address: 0x1234...abcd                    │     │
│   │ └─ Receives contributions from investors              │     │
│   │ └─ Releases to company if target met                 │     │
│   │                                                        │     │
│   │ Bounty 3: Hiring                                      │     │
│   │ └─ contractAddress: 0x1111...aaaa                    │     │
│   │ └─ company address: 0x1234...abcd                    │     │
│   │ └─ Receives contributions from investors              │     │
│   │ └─ Releases to company if target met                 │     │
│   │                                                        │     │
│   └──────────────────────────────────────────────────────┘     │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

---

## Database Structure (Already Implemented)

### Tables & Relationships

```
companies (TIER 2)
├─ id: uuid
├─ ethAddress: varchar(42)       ← Company wallet
├─ avaxAddress: varchar(42)      ← Company wallet
├─ name: varchar
├─ description: text
├─ ownerId: uuid
└─ 1:N relationship to wishlist_items

    wishlist_items (TIER 2→3 Link)
    ├─ id: uuid
    ├─ companyId: uuid (FK)
    ├─ title: varchar
    ├─ description: text
    ├─ category: varchar
    ├─ isEscrowActive: boolean
    └─ 1:N relationship to escrow_deployments
    
        escrow_deployments (TIER 3)
        ├─ id: uuid
        ├─ wishlistItemId: uuid (FK)
        ├─ contractAddress: varchar(42)  ← UNIQUE PER BOUNTY!
        ├─ chain: varchar                 ← 'ethereum' or 'avalanche'
        ├─ targetAmountEth: decimal
        ├─ deadline: timestamp
        ├─ status: varchar
        ├─ deploymentTxHash: varchar
        └─ 1:N relationship to contributions
        
            contributions (Audit Trail)
            ├─ id: uuid
            ├─ escrowDeploymentId: uuid (FK)
            ├─ contributorAddress: varchar(42)
            ├─ amountWei: varchar
            ├─ transactionHash: varchar
            ├─ blockNumber: integer
            ├─ isRefunded: boolean
            └─ timestamp: timestamp
```

**Key**: Each bounty (wishlist + escrow) has unique contractAddress!

---

## Data Flow: From Selection to Database

### Step 1: Frontend - User Selects Bounty

```
User Input
    ↓
SendFunds Component
├─ recipientAddress = "0x1234...abcd" (initial - company wallet)
├─ selectedBountyId = "bounty-123" (user selected)
└─ lookedUpCompany = {
     company: {...},
     bounties: [
       { id: "bounty-123", contractAddress: "0x7890...xyza", ... },
       { id: "bounty-456", contractAddress: "0x5678...vwxy", ... }
     ]
   }
    ↓
$effect() Watches for Changes
├─ selectedBountyId changed → true
├─ lookedUpCompany exists → true
├─ Find: bounties.find(b => b.id === "bounty-123")
├─ Extract: bounty.contractAddress = "0x7890...xyza"
└─ Update: recipientAddress = "0x7890...xyza"
    ↓
UI Re-renders
├─ Address field shows: 0x7890...xyza
├─ Badge shows: "Auto-set from bounty"
└─ Card displays: Contract address with explanation
```

### Step 2: User Sends Transaction

```
User clicks "Send"
    ↓
Transaction Details:
├─ From: 0x5555...5555 (investor's MetaMask)
├─ To: 0x7890...xyza (Marketing bounty escrow)
├─ Value: 1 ETH
└─ Data: contribute() call
    ↓
Blockchain Processes:
├─ Marketing Escrow @ 0x7890...xyza receives 1 ETH
├─ Updates: contributions[0x5555...5555] = 1 ETH
├─ Adds: 0x5555...5555 to contributors[]
├─ Emits: ContributionReceived(0x5555...5555, 1 ETH)
└─ Increases: totalRaised from 2.5 to 3.5 ETH
```

### Step 3: Backend Records Attribution

```
Backend Listener
    ↓
Detects: ContributionReceived event from 0x7890...xyza
    ↓
Database Lookup:
├─ Query: SELECT * FROM escrow_deployments WHERE contractAddress = '0x7890...xyza'
└─ Result: Found! (wishlistItemId = "marketing-item", companyId = "acme-corp")
    ↓
Create Contribution Record:
├─ id: new-uuid
├─ escrowDeploymentId: "bounty-123"
├─ wishlistItemId: "marketing-item"
├─ companyId: "acme-corp"
├─ contributorAddress: "0x5555...5555"
├─ amountWei: "1000000000000000000"
├─ transactionHash: "0x..."
├─ blockNumber: 123456
└─ timestamp: now
    ↓
Update EscrowDeployment:
├─ totalRaised: 3.5 ETH
├─ status: "active" (still below target)
└─ lastUpdated: now
    ↓
Frontend Updates:
├─ Marketing bounty progress: 3.5 / 5 ETH
├─ Contributor count: +1
└─ Last contribution: just now
```

---

## Comparison: Before vs After Frontend Fix

### BEFORE: Bounty Selection Ignored

```
┌─────────────────────────────────┐
│ Backend Ready                    │
├─────────────────────────────────┤
│ ✅ Multiple bounties per company │
│ ✅ Each has contractAddress      │
│ ✅ API returns all of them       │
│ ✅ Smart contracts deployed      │
│ ✅ Database tracking ready       │
└─────────────────────────────────┘
            ↑
            │
        NOT USED! ❌
            │
┌─────────────────────────────────┐
│ Frontend Broken                  │
├─────────────────────────────────┤
│ ❌ No type for contractAddress    │
│ ❌ No effect to auto-bind         │
│ ❌ Selection didn't update address │
│ ❌ All funds → company wallet     │
│ ❌ No UI confirmation             │
└─────────────────────────────────┘
```

### AFTER: Complete Integration

```
┌─────────────────────────────────┐
│ Backend Ready                    │
├─────────────────────────────────┤
│ ✅ Multiple bounties per company │
│ ✅ Each has contractAddress      │
│ ✅ API returns all of them       │
│ ✅ Smart contracts deployed      │
│ ✅ Database tracking ready       │
└─────────────────────────────────┘
            ↓
          USED! ✅
            ↓
┌─────────────────────────────────┐
│ Frontend Fixed                   │
├─────────────────────────────────┤
│ ✅ Type for contractAddress      │
│ ✅ Effect auto-binds selection   │
│ ✅ Selection updates address     │
│ ✅ Funds → bounty escrow         │
│ ✅ Clear UI confirmation         │
└─────────────────────────────────┘
            ↓
        Proper Flow! ✅
            ↓
┌─────────────────────────────────┐
│ Complete Chain                   │
├─────────────────────────────────┤
│ ✅ User selects bounty            │
│ ✅ Address auto-updates          │
│ ✅ Transaction to bounty contract │
│ ✅ Smart contract tracks it      │
│ ✅ Backend attributes correctly  │
│ ✅ Database has full record      │
└─────────────────────────────────┘
```

---

## Smart Contract Behavior (Unchanged - Already Correct)

### Each Bounty Has Independent Contract

```
┌──────────────────────────────────┐
│ Marketing Escrow Contract        │
│ @ 0x7890...xyza                  │
├──────────────────────────────────┤
│ company = 0x1234...abcd          │
│ targetAmount = 5 ETH              │
│ deadline = Dec 31, 2025           │
│ totalRaised = 3.5 ETH            │
│ isSuccessful = false              │
│                                   │
│ contributions:                    │
│ ├─ investor1: 1.5 ETH            │
│ ├─ investor2: 1 ETH              │
│ └─ investor3: 1 ETH              │
│                                   │
│ Functions:                        │
│ ├─ contribute() ← Receives funds  │
│ ├─ releaseFunds() ← If successful │
│ └─ claimRefund() ← If failed      │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Infrastructure Escrow Contract   │
│ @ 0x5678...vwxy                  │
├──────────────────────────────────┤
│ company = 0x1234...abcd (same!)  │
│ targetAmount = 10 ETH             │
│ deadline = Dec 31, 2025           │
│ totalRaised = 7.8 ETH            │
│ isSuccessful = false              │
│                                   │
│ contributions:                    │
│ ├─ investor1: 3 ETH              │
│ ├─ investor2: 2 ETH              │
│ └─ investor4: 2.8 ETH            │
│                                   │
│ Functions:                        │
│ ├─ contribute() ← Receives funds  │
│ ├─ releaseFunds() ← If successful │
│ └─ claimRefund() ← If failed      │
└──────────────────────────────────┘
```

**Key Insight**: Same company, different contracts, independent tracking!

---

## The Complete Picture

### What Each Component Does

```
FRONTEND
├─ Displays company with bounties
├─ User selects bounty
├─ Auto-updates recipient address ← NEW (Your Fix)
└─ Shows confirmation

BLOCKCHAIN
├─ Receives fund transaction
├─ Tracks contribution per contract
├─ Emits events with proof
└─ Independent per bounty

BACKEND
├─ Listens to events
├─ Maps address to bounty
├─ Records attribution
└─ Queries update UI

DATABASE
├─ Stores multiple bounties per company
├─ Tracks unique contract per bounty
├─ Records each contribution
└─ Enables full audit trail
```

### Data Ownership

```
User/Investor
  → Owns: MetaMask wallet (private key)
  → Can send funds to: Any bounty contract they choose
  
Company
  → Owns: ethAddress / avaxAddress
  → Receives: Funds from successful bounties
  → Controls: Bounty creation (wishlists)
  
Bounty/Wishlist
  → Owns: escrow contract at contractAddress
  → Receives: Contributions from multiple investors
  → Tracks: Progress toward target
  → Releases: Funds to company if successful
  
Backend
  → Tracks: Which bounty received which contribution
  → Maintains: Attribution and audit trail
  → Updates: UI with current progress
```

---

## Why No Changes Needed

### Architectural Proof

```
Requirement: Multiple bounties per company
    ↓
Design: One company → Many wishlist items → Many escrow contracts
    ↓
Database: ✅ escrow_deployments stores multiple per company
    ↓
API: ✅ Returns array of bounties with addresses
    ↓
Smart Contracts: ✅ Each deployed to unique address
    ↓
Backend Logic: ✅ Handles multiple addresses per company
    ↓
Frontend: ❌ Wasn't using the addresses (BEFORE)
         ✅ Now uses them properly (AFTER)
    ↓
Result: Complete system alignment! ✅
```

---

## Summary: Three-Tier System Complete

| Tier | Address | Stored In | Purpose | Unique Per |
|------|---------|-----------|---------|-----------|
| User | MetaMask | Not stored | Investor identity | Investor |
| Company | ethAddress / avaxAddress | `companies` table | Company operations | Company |
| Bounty | contractAddress | `escrow_deployments` table | Specific fundraising | Bounty/WishlistItem |

**All three tiers exist, all properly connected, all working together!**

Your frontend fix simply made the UI layer properly use what the backend was already providing.

✅ **NO CHANGES NEEDED** - System is complete and correct!
