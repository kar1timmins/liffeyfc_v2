# Bounty Selection Architecture Diagram

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Svelte)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User Input                                                      │
│  ├─ Enters company wallet address                               │
│  └─ Selects bounty from dropdown                                │
│                                                                  │
│  State Management                                                │
│  ├─ recipientAddress: string                                    │
│  ├─ selectedBountyId: string | null                             │
│  ├─ lookedUpCompany: WalletLookupResult | null                  │
│  └─ BountyOption[] { ..., contractAddress }  ← NEW FIELD        │
│                                                                  │
│  Reactive Binding  ← NEW EFFECT                                 │
│  ┌─────────────────────────────────────────────┐               │
│  │ $effect(() => {                             │               │
│  │   if (selectedBountyId && bounties) {       │               │
│  │     bounty = find(bounties, id)             │               │
│  │     recipientAddress = bounty.contractAddr  │               │
│  │   }                                         │               │
│  │ })                                          │               │
│  └─────────────────────────────────────────────┘               │
│                                                                  │
│  UI Display                                                      │
│  ├─ Address field: Auto-set from bounty [badge]                │
│  ├─ Bounty card: Shows contract address                         │
│  └─ Form: Ready to send                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
         ↑                                      ↓
    API Call                              Submit Transaction
         │                                      │
         ↓                                      ↓
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (NestJS API)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GET /wallet/lookup?address=0x...&chain=ethereum                │
│  ├─ Find company by wallet address                              │
│  ├─ Find all active bounties (EscrowDeployments)                │
│  └─ Return with contractAddress for each bounty                 │
│                                                                  │
│  POST /wallet/send                                              │
│  ├─ recipient: 0x7890...xyza (escrow contract)                  │
│  ├─ amount: user input                                          │
│  ├─ chain: ethereum/avalanche                                   │
│  └─ Sign and send transaction                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                ↑                              ↓
          SQL Query                      Blockchain Tx
                │                              │
                ↓                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  companies                                                       │
│  ├─ id, ethAddress, avaxAddress                                 │
│  └─ (One main wallet per company)                               │
│                                                                  │
│  escrow_deployments                                              │
│  ├─ id, companyId, contractAddress  ← UNIQUE PER BOUNTY         │
│  ├─ chainId, status, deadline                                   │
│  └─ (Multiple contracts per company)                            │
│                                                                  │
│  contributions (optional, for tracking)                          │
│  ├─ id, escrowDeploymentId, contributorAddress                 │
│  ├─ amountWei, transactionHash                                  │
│  └─ (Proves contribution to specific bounty)                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                ↑                              ↓
          Query Results              Escrow Contracts
                │                              │
                └──────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                    BLOCKCHAIN (Ethereum)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CompanyWishlistEscrow @ 0x7890...xyza                           │
│  ├─ Receives ETH from investor                                  │
│  ├─ Holds in escrow until deadline                              │
│  ├─ Releases to company or refunds to investors                 │
│  └─ Escrow logs prove bounty attribution                        │
│                                                                  │
│  CompanyWishlistEscrow @ 0x5678...vwxy                           │
│  ├─ Different bounty (different escrow)                         │
│  └─ Separate from above                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## State Diagram: Bounty Selection Flow

```
┌─────────────────────┐
│  User Enter Address │
│  (Company Wallet)   │
└──────────┬──────────┘
           │
           ↓ Address Valid
┌─────────────────────┐
│   API Lookup Call   │
│  /wallet/lookup     │
└──────────┬──────────┘
           │
           ↓ Success
┌─────────────────────────────────────────┐
│  lookedUpCompany = {                    │
│    company: {...},                      │
│    bounties: [                          │
│      { id, title, contractAddress },    │
│      { id, title, contractAddress },    │
│      { id, title, contractAddress }     │
│    ]                                    │
│  }                                      │
│  Display bounties in dropdown           │
└──────────┬──────────────────────────────┘
           │
           ↓ User Selects Bounty
┌─────────────────────────────────────────┐
│  selectedBountyId = "bounty-123"        │
└──────────┬──────────────────────────────┘
           │
           ↓ Reactive Effect Fires
┌─────────────────────────────────────────┐
│  $effect detects:                       │
│  - selectedBountyId changed             │
│  - lookedUpCompany has bounties         │
│                                         │
│  Find bounty in array:                  │
│  bounty = bounties.find(id == sel...)   │
│                                         │
│  Extract contract address:              │
│  contractAddress = bounty.contractAddr  │
│                                         │
│  Update state:                          │
│  recipientAddress = contractAddress     │
└──────────┬──────────────────────────────┘
           │
           ↓ Svelte Re-renders
┌─────────────────────────────────────────┐
│  Address Field Updates                  │
│  ├─ Input value = 0x7890...xyza         │
│  ├─ Badge shows "Auto-set from bounty"  │
│  └─ Card shows contract address         │
│                                         │
│  User Sees:                             │
│  ✓ Which contract will receive funds    │
│  ✓ Clear indication it's auto-set       │
│  ✓ Exact escrow address displayed       │
└──────────┬──────────────────────────────┘
           │
           ↓ User Reviews & Submits
┌─────────────────────────────────────────┐
│  User Confidence:                       │
│  ✓ Funds going to correct bounty        │
│  ✓ On-chain proof via contract address  │
│  ✓ No ambiguity about target            │
│                                         │
│  Submit Transaction:                    │
│  TO: 0x7890...xyza (escrow contract)    │
│  VALUE: user amount                     │
│  DATA: contribution calldata             │
└──────────┬──────────────────────────────┘
           │
           ↓ Blockchain Execution
┌─────────────────────────────────────────┐
│  Escrow Contract Receives Funds          │
│  ├─ Records contributor                 │
│  ├─ Updates totalRaised                 │
│  └─ Emits ContributionReceived event    │
│                                         │
│  Backend Observes:                      │
│  ├─ Transaction confirmed               │
│  ├─ Creates Contribution record         │
│  └─ Attributes to correct bounty        │
│                                         │
│  Result:                                │
│  ✓ Bounty shows increased progress      │
│  ✓ Contributor listed in bounty         │
│  ✓ Data permanently on blockchain       │
└─────────────────────────────────────────┘
```

## Component Hierarchy

```
SendFunds
├─ Receive: userWalletAddress, selectedChain, amount
│
├─ State
│  ├─ recipientAddress (UPDATES when bounty selected)
│  ├─ selectedBountyId
│  ├─ lookedUpCompany
│  │  └─ bounties[] (BountyOption[])
│  │     └─ contractAddress (NEW FIELD)
│  └─ isLookingUpAddress
│
├─ Effects
│  └─ $effect() (NEW)
│     ├─ Watches: selectedBountyId, lookedUpCompany
│     └─ Updates: recipientAddress to bounty.contractAddress
│
├─ Functions
│  ├─ onAddressChange() - debounced lookup
│  ├─ lookupWalletAddress() - calls /wallet/lookup
│  └─ handleSubmit() - sends transaction
│
└─ Render
   ├─ Recipient Address Field
   │  └─ Badge: "Auto-set from bounty" (conditional)
   │
   ├─ Bounty Selection
   │  ├─ Dropdown: Select bounty
   │  └─ Details Card: Show contract address (NEW)
   │     └─ "Escrow Contract (Auto-set)"
   │        └─ Display contractAddress
   │        └─ Explain funds go to escrow
   │
   └─ Submit Button: Send transaction
```

## Integration Points

```
Frontend            Backend             Database            Blockchain
  │                   │                    │                    │
  ├─ Enter address ──→│                    │                    │
  │                   ├─ Query company ───→│                    │
  │                   │                    ├─ Find by addr      │
  │                   │←─ Company data ────│                    │
  │                   │                    │                    │
  │                   ├─ Query bounties ──→│                    │
  │                   │                    ├─ Find active       │
  │                   │                    ├─ + contractAddr    │
  │                   │←─ Bounty array ────│                    │
  │                   │                    │                    │
  │←─ API response ───│                    │                    │
  │  (with contracts) │                    │                    │
  │                   │                    │                    │
  ├─ Select bounty    │                    │                    │
  │  (Svelte effect) │                    │                    │
  │                   │                    │                    │
  ├─ Submit form ────→│                    │                    │
  │                   ├─ Sign tx ────────────────────────────→ Escrow Contract
  │                   │                                          │
  │                   │←─────── Tx submitted ──────────────────│
  │                   │                                          │
  │                   ├─ Record in DB ─→│                       │
  │                   │                  ├─ Create record       │
  │                   │                  ├─ Link to bounty      │
  │                   │←─ Confirmed ────│                       │
  │                   │                  │                      │
  │←─ Success ────────│                  │                  Contribution received
  │                   │                  │                  Escrow tracking
```

---

## Key Insights

### Before Fix
```
Company Address (Main Wallet) → All bounties from same address → No distinction
```

### After Fix
```
Company Address → Lookup Bounties → Bounty A Contract
                                 → Bounty B Contract
                                 → Bounty C Contract
                                 
User selects A → Send to A's contract ✓
User selects B → Send to B's contract ✓
```

### Security Model
```
Bounty ID (Frontend)
    ↓ (User selects)
Contract Address (Stored in DB)
    ↓ (Auto-bound by effect)
Recipient Address (Updated in UI)
    ↓ (User submits)
Blockchain Transaction (On-chain proof)
    ↓ (Immutable)
Permanent Attribution (Forever recorded)
```

---

## Database Schema Relationships

```
companies
├─ id: uuid
├─ ethAddress: string ← Main wallet
├─ avaxAddress: string ← Main wallet
└─ HAS MANY: wishlistItems

wishlistItems
├─ id: uuid
├─ companyId: fk → companies
└─ HAS MANY: escrowDeployments

escrowDeployments
├─ id: uuid
├─ wishlistItemId: fk → wishlistItems
├─ companyId: fk → companies
├─ contractAddress: string ← UNIQUE PER BOUNTY
├─ chain: enum
├─ status: enum
└─ deadline: timestamp

contributions (optional)
├─ id: uuid
├─ escrowDeploymentId: fk → escrowDeployments
├─ wishlistItemId: fk → wishlistItems
├─ companyId: fk → companies
├─ contributorAddress: string
├─ transactionHash: string
└─ amountWei: string
```

---

## User Experience Timeline

```
T0: User visits SendFunds page
T1: User enters company address (0x1234...abcd)
T2: System looks up company and bounties
T3: User sees multiple bounties with dropdown
T4: User selects "Marketing Fund"
T5: EFFECT FIRES → recipientAddress = 0x7890...xyza
T6: UI updates → Badge appears, contract address shown
T7: User reviews and sees clear confirmation
T8: User sends funds
T9: Blockchain receives 1 ETH at 0x7890...xyza (marketing escrow)
T10: Backend records contribution attributed to marketing bounty
T11: Marketing fund progress bar updates
T12: All parties have on-chain + off-chain proof of correct bounty

Result: Clear, trustless, provable bounty funding ✓
```

---

This architecture ensures that bounty selection is not just a UI choice, but a functional binding that routes funds to bounty-specific escrow contracts with full on-chain transparency.
