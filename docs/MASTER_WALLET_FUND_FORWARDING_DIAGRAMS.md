# Master Wallet Fund Forwarding - Visual Architecture & Diagrams

## System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         LIFFEY FC BOUNTY SYSTEM                       │
│                    with Master Wallet Fund Forwarding                 │
└──────────────────────────────────────────────────────────────────────┘

                            ┌─────────────────┐
                            │   User Account  │
                            │  (Authenticated)│
                            └────────┬────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
        ┌───────────▼──────────┐     │     ┌──────────▼──────────┐
        │   Master Wallet      │     │     │ Company Profiles    │
        │   (Fund Recipient)   │     │     │ (Company A, B, C..)|
        │  ─────────────────   │     │     └──────────┬──────────┘
        │  - ETH Sepolia       │     │                │
        │    0xBECE60A8...     │     │     ┌──────────▼──────────┐
        │                      │     │     │  Child Wallets      │
        │  - AVAX Fuji         │     │     │  ─────────────────  │
        │    0xABCD1234...     │     │     │  Company A:         │
        │                      │     │     │  0x1234567890...    │
        │  - Seed Phrase       │     │     │                     │
        │  (Encrypted & Backed │     │     │  Company B:         │
        │   up)                │     │     │  0x5678901234...    │
        │                      │     │     │                     │
        │  ⭐ ALL FUNDS GO HERE   │     │     │  Derived from:      │
        │                      │     │     │  Master Wallet +    │
        └──────────────────────┘     │     │  HD Derivation Path │
                                     │     └──────────┬──────────┘
                            ┌────────▼─────────┐      │
                            │  API Controller  │      │
                            └────────┬─────────┘      │
                                     │                │
                            ┌────────▼─────────────────┴────────┐
                            │   Bounty Campaigns                │
                            │  ────────────────────────────     │
                            │  Company A - Bounty 1             │
                            │  Company A - Bounty 2             │
                            │  Company B - Bounty 1             │
                            └────────┬────────────────────────┘
                                     │
                            ┌────────▼────────────────┐
                            │ Smart Contracts Deploy  │
                            │ ───────────────────────│
                            │ Escrow Contract Created │
                            │                        │
                            │ Parameters:            │
                            │ - Company Wallet:      │
                            │   0x1234567890... ✓   │
                            │ - Master Wallet:       │
                            │   0xBECE60A8... ⭐ (NEW)
                            │ - Target: 10 ETH       │
                            │ - Deadline: 30 days    │
                            └────────┬───────────────┘
                                     │
                            ┌────────▼────────────────┐
                            │  Campaign Execution    │
                            └────────┬────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
        ┌───────────▼──────────┐    │    ┌────────────▼────────────┐
        │  SUCCESS PATH        │    │    │  FAILURE PATH           │
        │  ─────────────────── │    │    │  ──────────────────────│
        │  Target Reached ✓    │    │    │  Deadline Passed ✗     │
        │         OR           │    │    │  Target Not Reached    │
        │  Deadline + Funds    │    │    │         OR             │
        │                      │    │    │  Contributors claim    │
        │  → finalize()        │    │    │    refund()            │
        │  → _releaseFunds()   │    │    │                        │
        │                      │    │    │  Refund = contrib.     │
        │  ⭐ FUNDS SENT TO:    │    │    │  - (prop. gas fee)     │
        │     Master Wallet    │    │    │                        │
        │     0xBECE60A8...    │    │    │  → Back to: Each       │
        │                      │    │    │     contributor        │
        │  ✅ User receives    │    │    │                        │
        │     consolidated     │    │    │  ✅ Contributors       │
        │     funds!           │    │    │     get partial refund │
        └──────────────────────┘    │    └────────────────────────┘
                                     │
```

## Sequence Diagram - Bounty Deployment & Fund Flow

```
User              Frontend         Backend        Smart Contract    Blockchain
│                  │                │              │                 │
├─ Create Bounty ─►│                │              │                 │
│                  ├─ POST /bounty ►│              │                 │
│                  │                ├─ Get master  │                 │
│                  │                │  wallet      │                 │
│                  │                │ (from DB)    │                 │
│                  │                │              │                 │
│                  │                ├─ Check user  │                 │
│                  │                │  has wallet  │                 │
│                  │                │              │                 │
│                  │                ├─ Call        │                 │
│                  │                │  factory.    │                 │
│                  │                │  createEscrow│                 │
│                  │                ├──────────────►Escrow created    │
│                  │                │              │  with master    │
│                  │                │              │  wallet addr    │
│                  │                │              ├────────────────►│
│                  │                │              │  Contract       │
│                  │                │              │  deployed       │
│                  │                │◄─────────────┤                 │
│                  │                │  Contract    │                 │
│                  │                │  address     │                 │
│                  │◄─ Return ──────┤              │                 │
│                  │  response      │              │                 │
│◄─ Success ──────┤                │              │                 │
│   (Escrow addr) │                │              │                 │
│                 │                │              │                 │
│ ... Campaign Running ...                                           │
│                                                                    │
│ ◄─── Investors Contribute ETH/AVAX to Escrow ────────────────────►│
│                                                                    │
│ ... Target Reached / Deadline Passed ...                          │
│                                                                    │
├─ Finalize Campaign (auto or manual) ──────►│              │       │
│                                            ├──────────────►│       │
│                                            │ finalize()    │       │
│                                            │              ├──────►│
│                                            │              │ Exec  │
│                                            │              │       │
│                                            │ _releaseFunds()       │
│                                            │  to Master    │       │
│                                            │              ├──────►│
│                                            │              │ Send  │
│                                            │              │ funds │
│ ◄─ Funds sent to Master Wallet ────────────────────────────────────┤
│    0xBECE60A8fc74A3Ae7caD4b850c5Ac04051787257            │
│                                                                    │
│ ✅ User checks wallet & sees funds!                               │
```

## Data Model Relationships

```
┌──────────────────────────────────────────────────────────────┐
│                        DATABASE ENTITIES                      │
└──────────────────────────────────────────────────────────────┘

                          ┌─────────────┐
                          │    User     │
                          │  ────────── │
                          │  id         │
                          │  email      │
                          │  ownerId    │
                          └──────┬──────┘
                                 │
                  ┌──────────────┼──────────────┐
                  │              │              │
                  │              │              │
      ┌───────────▼────────┐ ┌───▼──────────────┐
      │   UserWallet       │ │   Company        │
      │  ──────────────    │ │  ────────────    │
      │  userId  (PK)      │ │  id (PK)         │
      │  ethAddress   ⭐    │ │  ownerId (FK)    │
      │  avaxAddress  ⭐    │ │  ethAddress      │
      │  encryptedMn*      │ │  avaxAddress     │
      │  encryptedPK       │ │  name            │
      │  nextChildIndex    │ │  description     │
      └────────────────────┘ └────┬─────────────┘
                                  │
                                  │ 1:N
                        ┌─────────▼─────────┐
                        │  WishlistItem     │
                        │ ────────────────  │
                        │ id (PK)           │
                        │ companyId (FK)    │
                        │ title             │
                        │ isEscrowActive    │
                        │ ethereumEscrowAddr│
                        │ avalancheEscrowAdr│
                        └────────┬──────────┘
                                 │
                                 │ 1:N
                        ┌────────▼──────────┐
                        │EscrowDeployment   │
                        │ ──────────────────│
                        │ id (PK)           │
                        │ contractAddress   │
                        │ chain             │
                        │ wishlistItemId    │
                        │ deployedById (FK) │
                        │ deploymentTxHash  │
                        │ status            │
                        └───────┬───────────┘
                                │
                                │ 1:N
                        ┌───────▼────────────┐
                        │ Contribution       │
                        │ ───────────────────│
                        │ id (PK)            │
                        │ escrowDeployment   │
                        │ contributorAddr    │
                        │ amountWei          │
                        │ transactionHash    │
                        │ isRefunded         │
                        └────────────────────┘

LEGEND:
- (PK) = Primary Key
- (FK) = Foreign Key
- ⭐ = Master Wallet Address
- * = Encrypted Field
```

## Wallet Address Hierarchy with Indexes

```
┌─────────────────────────────────────────────────────────────┐
│  MASTER WALLET (User's Root Wallet)                         │
│  ═════════════════════════════════════════════════════════  │
│                                                             │
│  Ethereum Address: 0xBECE60A8fc74A3Ae7caD4b850c5Ac04051... │
│  Avalanche Address: 0xABCD1234567890ABCDEF1234567890AB... │
│  Mnemonic: [24-word phrase] (ENCRYPTED)                   │
│  Derivation Path: m/44'/60'/0'/0/[index]                   │
│                                                             │
│  ✅ SECURED: Seed phrase backed up                         │
│  ✅ CONTROLS: All companies and bounties                   │
│  ✅ RECEIVES: All successful campaign funds                │
└─────────────────────────────────────────────────────────────┘
                         │
            ┌────────────┼────────────┐
            │            │            │
            ▼            ▼            ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ COMPANY A    │ │ COMPANY B    │ │ COMPANY C    │
    │ (Child 0)    │ │ (Child 1)    │ │ (Child 2)    │
    │ ──────────── │ │ ──────────── │ │ ──────────── │
    │ ETH: 0x1234..│ │ ETH: 0x5678..│ │ ETH: 0x9ABC..│
    │ AVAX: 0xABCD│ │ AVAX: 0xEF01 │ │ AVAX: 0x2345 │
    │              │ │              │ │              │
    │ Derivation:  │ │ Derivation:  │ │ Derivation:  │
    │ ...path/0    │ │ ...path/1    │ │ ...path/2    │
    │              │ │              │ │              │
    │ nextChildIdx:│ │ nextChildIdx:│ │ nextChildIdx:│
    │   3 (Bounty )│ │   2 (Bounty )│ │   1 (Bounty )│
    └────┬─────────┘ └────┬─────────┘ └────┬─────────┘
         │                │                │
    ┌────┴────┐       ┌────┴────┐     ┌────┴─────┐
    │          │       │         │     │          │
    ▼          ▼       ▼         ▼     ▼          ▼
  Bounty1   Bounty2  Bounty1   Bounty2 Bounty1  Bounty2
  Escrow1   Escrow2  Escrow3   Escrow4 Escrow5  Escrow6
    │          │       │         │     │          │
    └──────────┴───────┴─────────┴─────┴──────────┘
               │
    ALL FUNDS SENT TO:
    Master Wallet (0xBECE60A8...)  ⭐⭐⭐
```

## State Transition Diagram

```
┌──────────────────────────────────────────────────────────────┐
│              BOUNTY CAMPAIGN STATE MACHINE                    │
└──────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │  UNDEPLOYED     │
                    │  (Wishlist item,│
                    │   no escrow)    │
                    └────────┬────────┘
                             │
         ┌───────────────────┘
         │ deploy escrow
         │
         ▼
    ┌──────────────────────┐
    │ ACTIVE               │
    │ ──────────────────── │
    │ - Escrow deployed    │
    │ - Accepting funds    │
    │ - Deadline pending   │
    │ - isFinalized: false │
    │ - isSuccessful: null │
    └──────┬──────┬────────┘
           │      │
    ┌──────┘      └─────────┐
    │  target reached       │  deadline passed
    │  (auto finalize)      │  + finalize() call
    │                       │
    ▼                       ▼
┌────────────┐         ┌─────────────────┐
│ SUCCESS    │         │ PENDING FINALIZE│
│ ────────── │         │ (awaiting call) │
│ isSuccess: │         └────────┬────────┘
│   true     │                  │
│ isFinalized│                  │
│   true     │                  │
└──────┬─────┘    ┌─────────────┘
       │          │ finalize() called
       │          │
       │          ▼
       │     ┌──────────────┐
       │     │ FAILED       │
       │     │ ──────────── │
       │     │ isSuccess:   │
       │     │   false      │
       │     │ isFinalized: │
       │     │   true       │
       │     └──────┬───────┘
       │            │
       │            │ claimRefund()
       │            │ (per contributor)
       │            ▼
       └─►    ┌──────────────┐
              │ REFUNDED     │
              │ ──────────── │
              │ Funds sent   │
              │ back to      │
              │ contributors │
              │ (minus gas)  │
              └──────────────┘

FUNDS FLOW:
┌────────────────────────────────────────────────────┐
│ SUCCESS PATH: All Funds → Master Wallet ⭐         │
│                                                    │
│ _releaseFunds() called                            │
│ │                                                 │
│ └──► masterWallet.call{value: totalRaised}        │
│      0xBECE60A8fc74A3Ae7caD4b850c5Ac04051...     │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│ FAILURE PATH: Funds → Individual Contributors     │
│                                                    │
│ claimRefund() called (per user)                   │
│ │                                                 │
│ └──► Calculate refund:                           │
│      refund = contribution - (prop. gas fee)      │
│      │                                            │
│      └──► contributor.call{value: refund}        │
└────────────────────────────────────────────────────┘
```

## Deployment & Configuration Flow

```
┌───────────────────────────────────────────────────────┐
│         DEPLOYMENT SEQUENCE & CONFIGURATION           │
└───────────────────────────────────────────────────────┘

PHASE 1: SMART CONTRACTS
┌────────────────────────────────────┐
│ 1. Deploy Factory (Ethereum)       │
│    → Get: ETHEREUM_FACTORY_ADDRESS │
└────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────┐
│ 2. Deploy Factory (Avalanche)      │
│    → Get: AVALANCHE_FACTORY_ADDRESS│
└────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────┐
│ 3. Verify Contract (Etherscan)     │
│    Verify Contract (Snowtrace)     │
└────────────────────────────────────┘

PHASE 2: ENVIRONMENT CONFIGURATION
              │
              ▼
┌────────────────────────────────────┐
│ Update .env:                       │
│                                    │
│ ETHEREUM_FACTORY_ADDRESS=0x...     │
│ AVALANCHE_FACTORY_ADDRESS=0x...    │
└────────────────────────────────────┘

PHASE 3: BACKEND DEPLOYMENT
              │
              ▼
┌────────────────────────────────────┐
│ 1. pnpm install                    │
│ 2. pnpm build                      │
│ 3. pnpm test                       │
│ 4. docker-compose up -d backend    │
└────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────┐
│ Verify: Check logs                 │
│ docker-compose logs backend        │
│ grep "Master Wallet"               │
└────────────────────────────────────┘

PHASE 4: TESTING
              │
              ▼
┌────────────────────────────────────┐
│ 1. Create test user                │
│ 2. Generate master wallet          │
│ 3. Create test company             │
│ 4. Deploy test bounty              │
│ 5. Make test contribution          │
│ 6. Verify funds in master wallet   │
└────────────────────────────────────┘
              │
              ▼
         ✅ READY FOR PRODUCTION
```

## Error Handling Flow

```
┌──────────────────────────────────────────────────────────┐
│            ERROR DETECTION & HANDLING FLOW               │
└──────────────────────────────────────────────────────────┘

USER ACTION: Create Bounty
│
├─► Check: User authenticated?
│   ├─ NO:  → HTTP 401 Unauthorized
│   └─ YES: Continue
│
├─► Check: Wishlist item exists?
│   ├─ NO:  → HTTP 404 Not Found
│   └─ YES: Continue
│
├─► Check: User owns company?
│   ├─ NO:  → HTTP 403 Forbidden
│   └─ YES: Continue
│
├─► Check: Company has wallet addresses?
│   ├─ NO:  → HTTP 400 Bad Request
│   │         "Company must have wallet addresses"
│   └─ YES: Continue
│
├─► Check: User has master wallet?
│   ├─ NO:  → HTTP 400 Bad Request
│   │         "User does not have master wallet
│   │          configured. Please generate or
│   │          restore wallet first."
│   └─ YES: Continue
│
├─► Check: Factory addresses configured?
│   ├─ NO:  → HTTP 500 Internal Server Error
│   │         "Factory addresses not configured"
│   └─ YES: Continue
│
├─► Deploy contract with:
│   ├─ Company Wallet: 0x1234...
│   ├─ Master Wallet:  0xBECE... ⭐
│   ├─ Target Amount:  10 ETH
│   └─ Duration:       30 days
│
├─► Check: Deployment successful?
│   ├─ NO:  → HTTP 500 Internal Server Error
│   │         "Failed to deploy contract on {chain}"
│   │         (with detailed error message)
│   │
│   │         ⚠️ Check:
│   │         - RPC endpoints accessible
│   │         - Signer has gas
│   │         - Factory address valid
│   │         - Network correct
│   │
│   └─ YES: Continue
│
└─► ✅ Return escrow address to user
    With success message and contract details
```

---

These diagrams provide visual representation of:
- Overall system architecture
- Data relationships and flow
- State transitions during campaign lifecycle
- Deployment sequence and configuration
- Error handling paths
- Wallet hierarchy and fund forwarding
