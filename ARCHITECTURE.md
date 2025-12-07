# Escrow System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LIFFEY FOUNDERS CLUB                                 │
│                        BLOCKCHAIN ESCROW SYSTEM                              │
└─────────────────────────────────────────────────────────────────────────────┘


                                  FRONTEND LAYER
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Campaign   │  │ Contribution │  │   Campaign   │  │    Refund    │  │
│  │   Creation   │  │  Interface   │  │  Dashboard   │  │   Claiming   │  │
│  │      UI      │  │      UI      │  │      UI      │  │      UI      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │                  │           │
│         └──────────────────┴──────────────────┴──────────────────┘           │
│                                      │                                       │
│                              SvelteKit Frontend                              │
│                            (Static Site - Port 5173)                         │
│                                                                              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                    HTTP REST API + Web3 Direct Connection
                                       │
┌──────────────────────────────────────┴──────────────────────────────────────┐
│                                 BACKEND LAYER                                │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                      NESTJS API SERVER (Port 3000)                  │    │
│  │                                                                      │    │
│  │  ┌───────────────────────────────────────────────────────────┐    │    │
│  │  │              EscrowController (REST API)                   │    │    │
│  │  │                                                             │    │    │
│  │  │  POST   /escrow/create        → Deploy contracts          │    │    │
│  │  │  GET    /escrow/status/:id    → Get campaign status       │    │    │
│  │  │  POST   /escrow/sync/:id      → Sync with blockchain      │    │    │
│  │  │  GET    /escrow/company/:id   → List company escrows      │    │    │
│  │  │  GET    /escrow/health        → Check configuration       │    │    │
│  │  └────────────────────────┬──────────────────────────────────┘    │    │
│  │                            │                                       │    │
│  │  ┌────────────────────────┴──────────────────────────────────┐    │    │
│  │  │           EscrowContractService (Blockchain Logic)         │    │    │
│  │  │                                                             │    │    │
│  │  │  - deployEscrowContracts()   Deploy to ETH + AVAX         │    │    │
│  │  │  - getCampaignStatus()       Query on-chain data          │    │    │
│  │  │  - syncWithBlockchain()      Update database              │    │    │
│  │  │  - getCompanyEscrows()       List all campaigns           │    │    │
│  │  └─────────────────┬──────────────┬─────────────────────────┘    │    │
│  │                    │              │                               │    │
│  └────────────────────┼──────────────┼───────────────────────────────┘    │
│                       │              │                                     │
│         ┌─────────────┘              └─────────────┐                       │
│         │                                          │                       │
│         ▼                                          ▼                       │
│  ┌─────────────┐                          ┌──────────────┐                │
│  │  TypeORM    │                          │  ethers.js   │                │
│  │  Repository │                          │   Provider   │                │
│  └──────┬──────┘                          └──────┬───────┘                │
│         │                                         │                        │
└─────────┼─────────────────────────────────────────┼────────────────────────┘
          │                                         │
          ▼                                         ▼
┌─────────────────────┐              ┌──────────────────────────────┐
│   DATABASE LAYER    │              │      BLOCKCHAIN LAYER        │
│                     │              │                              │
│  ┌───────────────┐  │              │  ┌────────────────────────┐ │
│  │  PostgreSQL   │  │              │  │   ETHEREUM NETWORK     │ │
│  │               │  │              │  │                        │ │
│  │  Tables:      │  │              │  │  ┌──────────────────┐ │ │
│  │  - users      │  │              │  │  │ EscrowFactory    │ │ │
│  │  - companies  │  │              │  │  │   (Singleton)    │ │ │
│  │  - wishlist   │  │              │  │  └────────┬─────────┘ │ │
│  │    items      │  │              │  │           │           │ │
│  │  - wallets    │  │              │  │      creates          │ │
│  │               │  │              │  │           │           │ │
│  │  New Fields:  │  │              │  │  ┌────────▼─────────┐ │ │
│  │  - ethereum   │  │              │  │  │ Escrow Contract  │ │ │
│  │    _escrow    │  │              │  │  │   Campaign #1    │ │ │
│  │    _address   │  │              │  │  │                  │ │ │
│  │  - avalanche  │  │              │  │  │ - Company: 0x..  │ │ │
│  │    _escrow    │  │              │  │  │ - Target: 1 ETH  │ │ │
│  │    _address   │  │              │  │  │ - Deadline: +7d  │ │ │
│  │  - campaign   │  │              │  │  │ - Raised: 0 ETH  │ │ │
│  │    _deadline  │  │              │  │  └──────────────────┘ │ │
│  │  - is_escrow  │  │              │  │                        │ │
│  │    _active    │  │              │  │  ┌──────────────────┐ │ │
│  │  - is_escrow  │  │              │  │  │ Escrow Contract  │ │ │
│  │    _finalized │  │              │  │  │   Campaign #2    │ │ │
│  └───────────────┘  │              │  │  └──────────────────┘ │ │
│                     │              │  │          ...           │ │
└─────────────────────┘              │  └────────────────────────┘ │
                                     │                              │
                                     │  ┌────────────────────────┐ │
                                     │  │   AVALANCHE NETWORK    │ │
                                     │  │                        │ │
                                     │  │  ┌──────────────────┐ │ │
                                     │  │  │ EscrowFactory    │ │ │
                                     │  │  │   (Singleton)    │ │ │
                                     │  │  └────────┬─────────┘ │ │
                                     │  │           │           │ │
                                     │  │      creates          │ │
                                     │  │           │           │ │
                                     │  │  ┌────────▼─────────┐ │ │
                                     │  │  │ Escrow Contract  │ │ │
                                     │  │  │   Campaign #1    │ │ │
                                     │  │  └──────────────────┘ │ │
                                     │  │          ...           │ │
                                     │  └────────────────────────┘ │
                                     └──────────────────────────────┘


════════════════════════════════════════════════════════════════════════════════
                                  DATA FLOW
════════════════════════════════════════════════════════════════════════════════

1. CREATE CAMPAIGN FLOW
   ─────────────────────
   
   Company → Frontend → POST /escrow/create → EscrowContractService
                                               │
                                               ├─> Deploy to Ethereum
                                               │   (Factory.createEscrow())
                                               │   Contract Address: 0xAAA...
                                               │
                                               ├─> Deploy to Avalanche
                                               │   (Factory.createEscrow())
                                               │   Contract Address: 0xBBB...
                                               │
                                               └─> Update Database
                                                   (Save addresses, deadline)
   
   Frontend ← Success Response ← API
   { ethereum: "0xAAA...", avalanche: "0xBBB..." }


2. CONTRIBUTION FLOW
   ─────────────────
   
   Investor → Frontend → Web3 Wallet (MetaMask) → Blockchain
                         │
                         └─> escrow.contribute({ value: 0.1 ETH })
                             │
                             └─> Smart Contract Updates:
                                 - totalRaised += 0.1 ETH
                                 - contributions[investor] += 0.1 ETH
                                 - contributorCount++
                                 - If target reached: finalize()
   
   Backend ← Event Listener ← Blockchain
   (ContributionReceived event)
   │
   └─> Sync Database
       POST /escrow/sync/:id


3. CAMPAIGN SUCCESS FLOW
   ──────────────────────
   
   Last Contribution → Target Reached → Smart Contract Auto-Finalize
                                        │
                                        ├─> isFinalized = true
                                        ├─> isSuccessful = true
                                        └─> Transfer funds to company
                                            (company.transfer(totalRaised))
   
   Company Wallet Balance += totalRaised


4. CAMPAIGN FAILURE & REFUND FLOW
   ───────────────────────────────
   
   Deadline Passes → Target Not Met → Anyone calls finalize()
                                       │
                                       ├─> isFinalized = true
                                       ├─> isSuccessful = false
                                       └─> Enable refunds
   
   Investor → Frontend → Web3 Wallet → Blockchain
              │
              └─> escrow.claimRefund()
                  │
                  └─> Smart Contract:
                      - Check contribution > 0
                      - Set contribution = 0
                      - Transfer refund to investor


5. STATUS QUERY FLOW
   ─────────────────
   
   User → Frontend → GET /escrow/status/:id → EscrowContractService
                                               │
                                               ├─> Query Ethereum Contract
                                               │   escrow.getCampaignStatus()
                                               │
                                               └─> Query Avalanche Contract
                                                   escrow.getCampaignStatus()
   
   User ← Frontend ← JSON Response ← API
   {
     ethereum: { raised: 0.75, target: 1.0, progress: 75% },
     avalanche: { raised: 0.75, target: 1.0, progress: 75% }
   }


════════════════════════════════════════════════════════════════════════════════
                            SECURITY BOUNDARIES
════════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                          PUBLIC (No Auth Required)                           │
│                                                                              │
│  - GET  /escrow/status/:id     (Anyone can check campaign status)          │
│  - GET  /escrow/health         (Anyone can check system health)            │
│  - Blockchain Contributions    (Anyone can contribute to campaigns)        │
│  - Blockchain Refund Claims    (Contributors can claim their refunds)      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                       AUTHENTICATED (JWT Required)                           │
│                                                                              │
│  - POST /escrow/create         (Only company owners can create campaigns)  │
│  - POST /escrow/sync/:id       (Requires authentication)                   │
│  - GET  /escrow/company/:id    (Only company owners can see their escrows) │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      SMART CONTRACT PROTECTIONS                              │
│                                                                              │
│  - Reentrancy Guard            (Prevents recursive calls)                  │
│  - Immutable Variables         (Company, target, deadline cannot change)   │
│  - Access Control              (Only company receives funds)               │
│  - State Validation            (Cannot contribute after finalization)      │
│  - Double-Spend Prevention     (Refunds can only be claimed once)          │
└─────────────────────────────────────────────────────────────────────────────┘


════════════════════════════════════════════════════════════════════════════════
                              NETWORK TOPOLOGY
════════════════════════════════════════════════════════════════════════════════

  DEVELOPMENT                    TESTNET                      PRODUCTION
  ───────────                    ───────                      ──────────

┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   Hardhat     │           │    Sepolia    │           │   Ethereum    │
│   Network     │           │   (Testnet)   │           │   Mainnet     │
│               │           │               │           │               │
│ localhost:    │           │ Chain ID: 11  │           │ Chain ID: 1   │
│   8545        │           │ │155          │           │               │
└───────────────┘           └───────────────┘           └───────────────┘

┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   Hardhat     │           │     Fuji      │           │   Avalanche   │
│   Network     │           │   (Testnet)   │           │    C-Chain    │
│               │           │               │           │               │
│ localhost:    │           │ Chain ID:     │           │ Chain ID:     │
│   8545        │           │ 43113         │           │ 43114         │
└───────────────┘           └───────────────┘           └───────────────┘

   Instant          Free Test Tokens           Real ETH/AVAX Required
   Mining           From Faucets                Multi-Sig Wallets
   No Costs         ~30s Block Time             Production Monitoring


════════════════════════════════════════════════════════════════════════════════
                              TECHNOLOGY STACK
════════════════════════════════════════════════════════════════════════════════

Smart Contracts:       Solidity 0.8.20
Development:           Hardhat 2.22+
Blockchain Library:    ethers.js v6
Backend:               NestJS 11 (Node.js + TypeScript)
Database:              PostgreSQL 15 + TypeORM
Frontend:              SvelteKit 2 (Svelte 5 runes)
Styling:               Tailwind CSS v4
Package Manager:       pnpm
Container:             Docker Compose


════════════════════════════════════════════════════════════════════════════════
                         KEY DESIGN DECISIONS
════════════════════════════════════════════════════════════════════════════════

1. FACTORY PATTERN
   Why: Allows deploying unlimited escrow contracts from single factory
   Benefit: Each campaign is independent, no shared state vulnerabilities

2. DUAL-NETWORK DEPLOYMENT
   Why: Support both Ethereum and Avalanche simultaneously
   Benefit: Reach more users, lower costs on Avalanche

3. ALL-OR-NOTHING FUNDING
   Why: Only release funds if target is met
   Benefit: Protects investors and ensures company gets sufficient funding

4. AUTOMATIC FINALIZATION
   Why: Smart contract handles success/failure logic
   Benefit: No trusted third party needed, trustless execution

5. IMMUTABLE CAMPAIGN PARAMETERS
   Why: Target, deadline, company address cannot change after creation
   Benefit: Investors know exactly what they're contributing to

6. EVENT-DRIVEN ARCHITECTURE
   Why: Backend syncs with blockchain via events
   Benefit: Real-time updates without constant polling


════════════════════════════════════════════════════════════════════════════════

Legend:
  →  Data flow direction
  ├  Branch/Fork in process
  └  Final step/endpoint
  ▼  Downward connection
  ┌─┐  Container/boundary
  │  │  Vertical connection
  ─  ─  Horizontal connection

═══════════════════════════════════════════════════════════════════════════════
