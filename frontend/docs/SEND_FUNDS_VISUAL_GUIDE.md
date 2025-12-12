# SendFunds Feature - Visual Guide

## Dashboard Layout (Updated)

```
┌─────────────────────────────────────────────────────┐
│                    DASHBOARD                         │
├─────────────────────────────────────────────────────┤
│                                                       │
│  Welcome Back, [Username]!                           │
│                                                       │
│  ┌──────────────────┐  ┌──────────────────┐         │
│  │ 🏢 My Companies  │  │ 💰 My Bounties   │         │
│  │ View & Edit      │  │ View Progress    │         │
│  └──────────────────┘  └──────────────────┘         │
│                                                       │
│  ┌──────────────────┐  ┌──────────────────┐         │
│  │ 📤 Send Funds    │  │ 👤 My Profile    │         │
│  │ View → /send     │  │ Edit Settings    │         │
│  └──────────────────┘  └──────────────────┘         │
│                                                       │
│  NOTE: SendFunds form removed, card links to /send   │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Key Change
- **Before**: SendFunds form was embedded below cards
- **After**: "Send Funds" card links to dedicated `/send` page

## Send Page Layout (New)

```
┌─────────────────────────────────────────────────────────┐
│                     SEND FUNDS PAGE                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ← Back to Dashboard                                    │
│                                                           │
│  Send Funds                                             │
│  Transfer cryptocurrency to any wallet address on       │
│  supported blockchain networks                          │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ SendFunds Component                              │   │
│  │                                                   │   │
│  │ ℹ️ Connect MetaMask Wallet                        │   │
│  │ You need MetaMask or another Web3 wallet to      │   │
│  │ sign and send transactions. This is separate     │   │
│  │ from your Liffey account wallet.                 │   │
│  │                                                   │   │
│  │ [Connect Wallet Button]                          │   │
│  │                                                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ✅ Supported Networks                              │  │
│  │                                                    │  │
│  │ • Ethereum Sepolia (ETH) - Testnet               │  │
│  │   Chain ID: 0xaa36a7                             │  │
│  │   RPC: Sepolia public RPC                        │  │
│  │                                                    │  │
│  │ • Avalanche Fuji (AVAX) - Testnet                │  │
│  │   Chain ID: 0xa869                               │  │
│  │   RPC: Fuji public RPC                           │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🔄 How It Works                                    │  │
│  │                                                    │  │
│  │ 1. Connect MetaMask Wallet                       │  │
│  │    Click the button above to connect your        │  │
│  │    wallet using MetaMask or compatible           │  │
│  │    Web3 provider.                                │  │
│  │                                                    │  │
│  │ 2. Select Network & Enter Details                │  │
│  │    Choose a supported blockchain network,         │  │
│  │    enter recipient address and amount.           │  │
│  │                                                    │  │
│  │ 3. Review Transaction Costs                      │  │
│  │    See balance, gas price, and total cost        │  │
│  │    before confirming.                            │  │
│  │                                                    │  │
│  │ 4. Confirm & Send                                │  │
│  │    MetaMask will ask you to sign the             │  │
│  │    transaction with your private key.            │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ❓ Frequently Asked Questions                          │
│                                                           │
│  ▼ What is MetaMask?                                    │
│    MetaMask is a browser extension that lets you        │
│    manage cryptocurrency wallets and sign              │
│    transactions securely.                              │
│                                                           │
│  ▼ Do I already have a wallet?                          │
│    You have a Liffey account wallet (auto-created       │
│    for bounties), but SendFunds requires your          │
│    personal MetaMask wallet.                            │
│                                                           │
│  ▼ Is MetaMask wallet the same as Liffey wallet?       │
│    No. Liffey wallet is server-managed for             │
│    bounties. MetaMask is your personal wallet.         │
│                                                           │
│  ▼ Why do I need to connect MetaMask?                  │
│    MetaMask signs transactions with your private       │
│    key to prove you own the funds you're sending.      │
│                                                           │
│  ▼ What happens if I close the page?                   │
│    Your transaction continues on the blockchain.        │
│    You can check status using transaction hash         │
│    on block explorer.                                  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## SendFunds Component State Flow

```
┌─────────────────────────────────────────────────────┐
│         SendFunds Component State Machine             │
└─────────────────────────────────────────────────────┘

                    START
                      ↓
        ┌─────────────────────────┐
        │   currentStep = 'connect'│
        │                          │
        │  ℹ️ Connect MetaMask     │
        │  Wallet                  │
        │                          │
        │  [Connect Button]        │
        └──────────┬──────────────┘
                   │ User clicks Connect
                   ↓
        ┌─────────────────────────┐
        │ currentStep = 'form'     │
        │                          │
        │ 🔗 Select Chain         │
        │ 💰 Enter Amount         │
        │ 📍 Enter Address        │
        │ 💸 Review Cost          │
        │                          │
        │ [Submit Button]         │
        └──────────┬──────────────┘
                   │ User submits
                   ↓
        ┌─────────────────────────┐
        │ currentStep = 'submitting'
        │                          │
        │ ⏳ Processing...         │
        │ Please confirm in        │
        │ MetaMask                 │
        │                          │
        │ [Disabled Button]        │
        └──────────┬──────────────┘
                   │ MetaMask signed
                   │ TX submitted
                   ↓
        ┌─────────────────────────┐
        │ currentStep = 'success'  │
        │                          │
        │ ✅ Transaction Sent!     │
        │ Hash: 0x...             │
        │                          │
        │ [New Transaction Button] │
        └─────────────────────────┘
```

## Wallet Type Comparison

```
┌─────────────────────────────┬─────────────────────────┐
│     LIFFEY WALLET           │    METAMASK WALLET      │
├─────────────────────────────┼─────────────────────────┤
│ Generated by: Backend       │ Generated by: User      │
│ Stored in: Database         │ Stored in: Browser ext. │
│ Private key: Encrypted DB   │ Private key: Local only │
│                             │                         │
│ Used for:                   │ Used for:               │
│ • Deploy bounties           │ • Sign transactions     │
│ • Receive funds             │ • Send funds            │
│ • Contract automation       │ • Contribute to bounties│
│                             │                         │
│ User access: View-only      │ User access: Full ctrl. │
│ Visible in: Dashboard info  │ Visible in: Connected   │
│ Automatic: Yes              │ Automatic: No           │
│                             │                         │
│ Security: Server protected  │ Security: User private  │
│                             │                         │
│ Example use:                │ Example use:            │
│ "Company bounty deployed"   │ "Send 1 ETH to 0x..."  │
└─────────────────────────────┴─────────────────────────┘
```

## Navigation Diagram

```
┌──────────────────┐
│   Home Page      │
│  /              │
└────────┬─────────┘
         │ Click "Dashboard"
         ↓
┌──────────────────┐
│   Dashboard      │
│  /dashboard     │
│                  │
│ [Send Funds]◄────┼─── User can see this card
└────────┬─────────┘
         │ Click "Send Funds" card
         ↓
┌──────────────────────────────┐
│   Send Funds Page            │
│  /send                      │
│                              │
│ ← Back to Dashboard          │
│ SendFunds Form               │
│ Info Sections                │
│ FAQ                          │
└──────────┬───────────────────┘
           │ Click "Back" button
           ↓
┌──────────────────┐
│   Dashboard      │
│  /dashboard     │
└──────────────────┘
```

## Updated Component Structure

```
frontend/
├── src/
│   ├── routes/
│   │   ├── dashboard/
│   │   │   └── +page.svelte
│   │   │       └── imports: SendFunds component
│   │   │       └── uses: goto('/send') for navigation
│   │   │
│   │   └── send/  ← NEW ROUTE
│   │       └── +page.svelte
│   │           ├── imports: SendFunds component
│   │           ├── imports: AuthStore for verification
│   │           ├── imports: ArrowLeft icon
│   │           ├── shows: SendFunds component
│   │           ├── shows: Info sections
│   │           └── shows: FAQ
│   │
│   └── lib/
│       └── components/
│           ├── SendFunds.svelte (UPDATED)
│           │   └── Updated MetaMask message
│           │
│           └── ... other components
│
└── docs/
    ├── SEND_FUNDS_FEATURE.md
    ├── SEND_FUNDS_QUICK_START.md
    ├── SEND_PAGE_CLARIFICATION.md
    └── SEND_FUNDS_IMPLEMENTATION_SUMMARY.md
```

## Key Improvements

✅ **Clarity**: Clear separation between dashboard and send page
✅ **Messaging**: Updated to clarify MetaMask requirement  
✅ **UX**: Dedicated page with supporting information
✅ **Information**: FAQ explains wallet distinction
✅ **Navigation**: Easy back button to dashboard
✅ **Mobile**: Responsive layout works on all devices
✅ **Security**: No changes to transaction security
✅ **Validation**: TypeScript checks pass

## Testing Checklist for Users

- [ ] Dashboard shows "Send Funds" card
- [ ] Clicking card navigates to `/send` page
- [ ] Send page shows back button to dashboard
- [ ] MetaMask alert message is clear
- [ ] SendFunds form works on `/send` page
- [ ] Info sections are readable
- [ ] FAQ questions are helpful
- [ ] Page is responsive on mobile
- [ ] Form validation works (address, amount)
- [ ] Transaction flow completes successfully
