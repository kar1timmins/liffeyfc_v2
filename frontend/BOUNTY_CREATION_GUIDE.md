# Bounty Creation Feature - User Guide

## Overview
The bounty creation feature allows companies to enable blockchain-backed crowdfunding for their wishlist items. This creates escrow contracts on Ethereum Sepolia and/or Avalanche Fuji testnets.

## How It Works

### For Company Owners

1. **Prerequisites**
   - You must be logged in
   - You must have a registered company in your profile
   - Your company must have at least one wallet address (Ethereum or Avalanche)
   - You must have wishlist items with target values

2. **Creating a Bounty**
   
   a. Navigate to your Profile page
   
   b. Go to the "Companies" tab
   
   c. Expand the wishlist for your company
   
   d. Find a wishlist item that:
      - Has a target value set
      - Does NOT already have an active bounty
      - Your company has wallet address(es) configured
   
   e. Click the "Create Bounty Campaign" button
   
   f. In the modal, configure:
      - **Target Amount**: Enter in EUR (fiat), automatically converts to ETH/AVAX
      - **Duration**: Select campaign length (7, 14, 30, 60, or 90 days)
      - **Networks**: Choose which blockchain(s) to deploy on:
        * ✅ Ethereum Sepolia Testnet
        * ✅ Avalanche Fuji Testnet
        * You can select both!
   
   g. Review the summary showing:
      - Wishlist item details
      - Target amount in both EUR and crypto
      - Campaign end date
      - Selected networks
   
   h. Click "Create Bounty"

3. **What Happens Next**
   
   The system will:
   - Create a bounty record in the database
   - Deploy smart contracts to your selected networks
   - Mark the wishlist item as having an active escrow
   - Display the contract addresses with explorer links
   
   The modal will show:
   - ✅ Success message
   - 📜 Contract address(es) on each network
   - 🔗 Links to view contracts on Etherscan/Snowtrace
   - Auto-close after a few seconds

4. **After Creation**
   
   - The wishlist item will show "Active Bounty Campaign" badge
   - The bounty appears on the public `/bounties` page
   - Investors can browse and contribute via the company page
   - You can track contributions in real-time

### For Investors

1. **Finding Bounties**
   - Visit `/bounties` page to see all active campaigns
   - Filter by status, search by company/description
   - Click on a bounty to see details

2. **Contributing**
   - Bounty detail page shows campaign info
   - Click "Go to Company Page to Contribute"
   - On company page, find the wishlist item
   - Connect MetaMask wallet
   - Select network (must match contract network)
   - Enter contribution amount
   - Confirm transaction in MetaMask

## Technical Details

### Smart Contracts
- **Contract Type**: CompanyWishlistEscrow.sol
- **Deployment**: Via EscrowFactory pattern
- **Networks**: 
  - Ethereum Sepolia (Chain ID: 11155111, 0xaa36a7)
  - Avalanche Fuji (Chain ID: 43113, 0xa869)

### Features
- **Time-Bound Campaigns**: Automatic deadline enforcement
- **Multi-Contributor**: Anyone can contribute any amount
- **Gas Fee Distribution**: Fair 0.1% fee split on failed campaigns (0.001-0.1 ETH cap)
- **Refund Mechanism**: Contributors can claim refunds if goal not met by deadline
- **Fund Release**: Company owner claims funds when goal reached

### EUR to Crypto Conversion
- Uses approximate exchange rate: 1 ETH ≈ €3,200
- For accurate pricing, check current rates before creating bounty
- Rate is static in UI, actual on-chain amounts use ETH/AVAX values

## Navigation

### Accessing the Feature
- **Profile Page** → Companies Tab → Expand Wishlist → "Create Bounty Campaign"
- **FAB Menu** → Bounties (only visible if you have a registered company)

### Visibility Rules
- "Create Bounty" button shows ONLY if:
  - Wishlist item has a target value
  - No active bounty exists for this item
  - Company has wallet address configured
- "Active Bounty Campaign" badge shows if bounty already created

## API Endpoints Used

### Frontend → Backend
1. **POST /bounties**
   - Creates bounty database record
   - Links to wishlist item
   - Sets initial status and metadata

2. **POST /escrow/create**
   - Deploys smart contracts to blockchain(s)
   - Returns contract addresses
   - Stores contract addresses in bounty record

### Authentication
- Both endpoints require JWT authentication
- Only company owners can create bounties for their wishlist items
- User ID verified against company ownership

## Troubleshooting

### Button Not Showing
- Ensure wishlist item has a target value set
- Check that company has wallet address (ETH or AVAX)
- Verify item doesn't already have active bounty

### Modal Not Opening
- Check browser console for errors
- Ensure you're logged in
- Verify company ownership

### Deployment Fails
- Check backend logs for contract deployment errors
- Verify wallet addresses are valid
- Ensure testnet RPC endpoints are accessible
- Check if company has sufficient permissions

### Network Issues
- Testnets can be slow or congested
- Contract deployment may take 30-60 seconds
- If timeout occurs, check backend logs for transaction hash
- Manually verify on block explorer if needed

## Files Modified

### Frontend Components
- `CompanyManager.svelte`: Added "Create Bounty" button integration
- `CreateBountyModal.svelte`: New modal component (480 lines)
- `+layout.svelte`: Event listener for company refresh (already existed)
- `profile/+page.svelte`: Event dispatch on company fetch (already existed)

### Backend APIs (Already Existed)
- `bounties.controller.ts`: POST /bounties endpoint
- `escrow.controller.ts`: POST /escrow/create endpoint
- `bounties.service.ts`: Business logic for bounty creation
- `escrow-contract.service.ts`: Smart contract deployment logic

## Next Steps

### Future Enhancements
- [ ] Real-time exchange rate API integration
- [ ] Milestone-based fund release (partial payments)
- [ ] Contributor badges and recognition system
- [ ] Email notifications for bounty milestones
- [ ] Mainnet deployment (Ethereum, Avalanche)
- [ ] Multi-currency support (USDC, USDT)

### Testing Checklist
- [x] TypeScript compilation: ✅ 0 errors
- [x] Production build: ✅ Success
- [ ] End-to-end manual test: Create bounty flow
- [ ] Verify contract deployment on Etherscan
- [ ] Verify contract deployment on Snowtrace
- [ ] Test investor contribution flow
- [ ] Verify bounty appears on /bounties page
- [ ] Test refund mechanism (after deadline)
- [ ] Test fund release (after goal met)

## Support

For issues or questions:
1. Check backend logs: `docker-compose logs -f backend`
2. Check frontend console: Browser DevTools
3. Verify contract on explorer using provided links
4. Review this guide for prerequisites and steps
