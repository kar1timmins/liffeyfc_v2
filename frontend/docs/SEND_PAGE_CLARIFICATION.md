# Send Page Clarification - Wallet Types

## Overview

This document explains the clarification made to the SendFunds feature to distinguish between two different wallet types in the Liffey Founders Club application.

## The Two Wallet Types

### 1. **Liffey Account Wallet** (Database-Stored)
- **Where it comes from**: Generated automatically by the backend when a user registers
- **What it's used for**: 
  - Deploying escrow contracts for company bounties
  - Receiving funds from crowdfunding campaigns
  - Managing company assets on blockchain
- **Access**: Backend API only (not directly accessible to user)
- **Security**: Private key encrypted and stored in database
- **User visibility**: Users can see it exists but cannot directly interact with it

### 2. **MetaMask Wallet** (User's Personal Wallet)
- **Where it comes from**: User's own MetaMask browser extension or Web3 wallet
- **What it's used for**:
  - Signing transactions with user's own private key
  - Sending funds to other wallets
  - Contributing to bounties
  - Any blockchain interaction initiated by the user
- **Access**: User controls directly via MetaMask UI
- **Security**: Private key never leaves user's device
- **User visibility**: Wallet address shown in dashboard

## Why Both Are Needed

| Task | Wallet Type Needed | Reason |
|------|-------------------|--------|
| Deploy bounty contract | Liffey Account | Server-initiated, needs automated signing |
| Contribute to bounty | MetaMask | User signs with own key, proves ownership |
| Send funds to address | MetaMask | User explicitly signs this transaction |
| Receive bounty funds | Liffey Account | Backend deposits funds from escrow |

## Updated UI/UX

### Dashboard
- **Web3 Wallets Card**: Now redirects to dedicated `/send` page
- **Message**: Still shows if MetaMask is not connected
- **Purpose**: Clear separation between dashboard cards and active transactions

### Send Page (`/send`)
- **Location**: Dedicated route separate from dashboard
- **Header**: Clear explanation of what the page does
- **Connect Message**: Updated to clarify MetaMask requirement
  - **Old**: "You need to connect a Web3 wallet to send funds."
  - **New**: "You need MetaMask or another Web3 wallet to sign and send transactions. This is separate from your Liffey account wallet."
- **Info Section**: Explains supported networks and how the system works
- **FAQ**: Answers common questions about wallet types and security

## Code Changes

### SendFunds.svelte
**Updated alert message** (line ~96):
```svelte
<!-- BEFORE -->
<div class="font-semibold">Connect Your Wallet</div>
<div class="text-sm">You need to connect a Web3 wallet to send funds.</div>

<!-- AFTER -->
<div class="font-semibold">Connect MetaMask Wallet</div>
<div class="text-sm">You need MetaMask or another Web3 wallet to sign and send transactions. 
This is separate from your Liffey account wallet.</div>
```

### Dashboard Page
- SendFunds component removed from dashboard (was taking up too much space)
- Web3 Wallets card now links to `/send` page instead of showing form inline
- Cleaner dashboard with only quick action cards

### New Send Page
**Location**: `/frontend/src/routes/send/+page.svelte`
**Content**:
1. Header with back button to dashboard
2. SendFunds component (same functionality)
3. Supported Networks info card
4. How It Works step-by-step guide
5. FAQ with 5 common questions

## User Flow

### Before Changes
```
Dashboard 
  → See "Web3 Wallets" card 
  → SendFunds form appears below
  → Confusing if user already has Liffey wallet
```

### After Changes
```
Dashboard 
  → See "Send Funds" card 
  → Click "Send Funds"
  → Navigate to /send page
  → See clear explanation
  → SendFunds form with clarified MetaMask requirement
  → Can go back to dashboard
```

## FAQ Update

New questions added to Send page FAQ:

**Q: Do I already have a wallet to use SendFunds?**
- A: You have a Liffey account wallet (for bounties), but SendFunds requires connecting your personal MetaMask wallet.

**Q: Is my Liffey wallet the same as MetaMask?**
- A: No. Liffey wallet is server-managed for bounties. MetaMask is your personal wallet you control.

**Q: Why do I need to connect MetaMask?**
- A: MetaMask signs transactions with your private key to prove you own the funds you're sending.

## Testing Checklist

- [x] TypeScript builds with no errors
- [x] SendFunds component loads on `/send` page
- [x] Message clearly explains MetaMask requirement
- [x] Dashboard card links to `/send` page
- [x] Back button returns to dashboard
- [x] Info sections visible below SendFunds
- [x] FAQ questions answerable

## Next Steps

1. **User Testing**: Verify users understand the wallet distinction
2. **Feedback**: If users still confuse the wallets, consider additional help text
3. **Mobile Testing**: Ensure responsive layout works on small screens
4. **Documentation**: Update main README.md with wallet type explanation

## Git Commit

```
feat: Create dedicated /send page for wallet transfers with clarified MetaMask requirement
- New route: /frontend/src/routes/send/+page.svelte
- Updated SendFunds alert message to clarify MetaMask requirement
- Explains difference between Liffey wallet and MetaMask wallet
- Includes info sections and FAQ
- Dashboard card now links to /send instead of inline form
```
