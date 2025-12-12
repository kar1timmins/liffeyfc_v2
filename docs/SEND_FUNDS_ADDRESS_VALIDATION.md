# SendFunds Address Validation & Bounty Selection Feature

## Overview

Added a safeguard feature to the SendFunds component that validates recipient wallet addresses against the company database and displays company information along with active bounties/wishlist items. This prevents users from sending funds to incorrect addresses.

## How It Works

### User Flow

1. **User enters recipient address** in the SendFunds form
2. **Debounced validation** starts after 300ms of inactivity (prevents excessive API calls)
3. **Address lookup API called** to check if address exists in database
4. **If address found**:
   - Company name, description, and industry display
   - Active bounties/wishlist items shown in dropdown
   - User can select which bounty to contribute to
   - Progress bar shows funding progress
5. **If address not found**:
   - Warning message: "Wallet address not found in system"
   - User can still send funds (in case it's a personal wallet)
6. **User proceeds** with amount and selected bounty (if applicable)

## Frontend Implementation

### New State Variables

```typescript
interface BountyOption {
  id: string;
  title: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  chain: 'ethereum' | 'avalanche';
  status: 'active' | 'funded' | 'expired';
}

interface WalletLookupResult {
  company: {
    id: string;
    name: string;
    description?: string;
    industry?: string;
  };
  bounties: BountyOption[];
}

let isLookingUpAddress = false;           // Loading state during lookup
let lookupError: string | null = null;    // Error message if lookup fails
let lookedUpCompany: WalletLookupResult | null = null;  // Lookup result
let selectedBountyId: string | null = null;  // User's selected bounty
let lookupDebounceTimer: NodeJS.Timeout | null = null; // Debounce timer
```

### Key Functions

**`lookupWalletAddress(address: string)`**
- Makes API call to `/wallet/lookup?address=0x...&chain=ethereum|avalanche`
- Handles errors and displays appropriate messages
- Auto-selects first active bounty if available
- Logs result to console for debugging

**`onAddressChange(newAddress: string)`**
- Debounced address validation (300ms delay)
- Clears previous lookup results
- Calls `lookupWalletAddress()` after debounce completes

### UI Components

**Address Input with Validation**
```svelte
<input
  type="text"
  placeholder="0x..."
  value={recipientAddress}
  onchange={(e) => onAddressChange((e.target as HTMLInputElement).value)}
  oninput={(e) => onAddressChange((e.target as HTMLInputElement).value)}
/>
```

**Loading State**
- Shows spinner with "Verifying address..." message while lookup in progress

**Lookup Error Message**
- Displays warning if address not found in system

**Company & Bounty Section** (conditionally rendered if address found)
```
┌─────────────────────────────────────┐
│ Recipient Company                   │
│ Company Name                        │
│ Company description...              │
│ [Industry Badge]                    │
│                                     │
│ Active Bounties / Wishlist Items    │
│ [Dropdown with bounty options]      │
│                                     │
│ ─── Selected Bounty Details ───     │
│ Bounty Title                        │
│ Description...                      │
│                                     │
│ Progress: 2.5 / 10 ETH ▓░░░░ 25%  │
└─────────────────────────────────────┘
```

## Backend Implementation

### New Endpoint

**GET `/wallet/lookup?address=0x...&chain=ethereum|avalanche`**

Protected by JWT authentication.

**Request:**
```javascript
fetch('http://localhost:3000/wallet/lookup?address=0x6A1bCd2e940e183b43AF85f4443bFdf8169Ab0D0&chain=ethereum', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "company": {
      "id": "uuid",
      "name": "Acme Corp",
      "description": "Building web3 solutions",
      "industry": "Technology"
    },
    "bounties": [
      {
        "id": "uuid",
        "title": "Marketing Campaign Funding",
        "description": "Need $5000 for Q1 marketing",
        "targetAmount": 5,
        "currentAmount": 2.5,
        "chain": "ethereum",
        "status": "active",
        "contractAddress": "0x...",
        "deadline": "2025-12-31T23:59:59Z"
      }
    ]
  }
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "message": "Wallet address not found in system. This address is not associated with any company."
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Invalid address or chain parameter"
}
```

### Implementation Details

**WalletGenerationService.lookupWalletAddress()**

1. **Normalizes address** to lowercase for case-insensitive matching
2. **Finds company** by matching ethAddress or avaxAddress based on chain
3. **Loads company relations** including wishlistItems
4. **Fetches active bounties** (EscrowDeployments):
   - Filters by wishlistIds from company
   - Filters by selected chain
   - Filters by deadline > now (excludes expired campaigns)
5. **Maps to response format** with all necessary bounty details

**Query Logic:**
```typescript
const deployments = await this.escrowDeploymentRepo.createQueryBuilder('ed')
  .where('ed.wishlistItemId IN (:...wishlistIds)', { wishlistIds })
  .andWhere('ed.chain = :chain', { chain })
  .leftJoinAndSelect('ed.wishlistItem', 'wi')
  .getMany();
```

## Safety Features

1. **Address Validation**
   - Checks for valid Ethereum address format (0x + 40 hex characters)
   - Only looks up valid addresses

2. **Debounced API Calls**
   - 300ms debounce prevents excessive API requests
   - Improves performance and server load

3. **Case-Insensitive Matching**
   - Converts addresses to lowercase for database comparison
   - Handles user input variations

4. **Error Handling**
   - Clear error messages if lookup fails
   - Graceful fallback if address not found
   - Users can still send to non-system addresses

5. **Expiration Filter**
   - Only shows active bounties (not expired)
   - Deadline comparison prevents contributing to closed campaigns

6. **Auto-Selection**
   - Automatically selects first active bounty if available
   - User can change selection if multiple bounties exist

## Database Integration

### Required Tables

- **companies** - Must have `ethAddress` and `avaxAddress` fields
- **wishlist_items** - Company's wishlist items
- **escrow_deployments** - Active bounties/campaigns
  - Links wishlistItem to contract address
  - Stores deadline, target amount, chain info

### Relationships

```
Company (1) ──→ (Many) WishlistItem
               ──→ (Many) EscrowDeployment
```

## Testing Checklist

- [x] Frontend compiles without errors
- [x] Address lookup debounces correctly
- [x] Company info displays when address found
- [x] Bounty dropdown populates with active bounties
- [x] Selected bounty shows progress bar
- [x] Error message displays when address not found
- [x] Loading spinner shows during lookup
- [x] Can proceed without selecting bounty
- [x] Address validation works for invalid formats
- [x] Case-insensitive address matching works

## Future Enhancements

1. **Real-time Progress Updates**
   - Fetch `currentAmount` from blockchain instead of assuming 0
   - Show live funding progress

2. **Bounty Search/Filter**
   - Filter by status, funding goal, deadline
   - Search bounty titles

3. **Company Preview Modal**
   - Show full company profile
   - See all wishlist items (not just bounties)
   - Company social links and contact info

4. **Contribution History**
   - Show user's past contributions to this company
   - Display any active investments

5. **Multi-Bounty Selection**
   - Allow contributing to multiple bounties in one transaction
   - Split fund allocation

6. **Notification System**
   - Notify when bounty reaches goal
   - Updates on fund releases
   - Company activity feeds

## Code Files

- **Frontend**: `/frontend/src/lib/components/SendFunds.svelte`
  - `lookupWalletAddress()` - Main lookup function
  - `onAddressChange()` - Debounced event handler
  - New UI section for company & bounty display

- **Backend**: `/backend/src/web3/wallet-generation.service.ts`
  - `lookupWalletAddress()` - Database lookup logic

- **Backend**: `/backend/src/web3/wallet.controller.ts`
  - `GET /wallet/lookup` endpoint - API route

## API Flow Diagram

```
User enters address
        ↓
Debounce timer starts (300ms)
        ↓
User stops typing
        ↓
[onAddressChange] calls lookupWalletAddress()
        ↓
API GET /wallet/lookup?address=...&chain=...
        ↓
WalletGenerationService.lookupWalletAddress()
        ↓
Query company by wallet address
        ↓
Get company wishlist items
        ↓
Query active escrow deployments
        ↓
Filter by deadline > now
        ↓
Return company + bounties
        ↓
Frontend displays company info & bounty dropdown
        ↓
User can select bounty to contribute to
        ↓
Proceed with send transaction
```

## Error Handling Examples

**Invalid Address Format:**
- Input: `0xInvalid`
- Display: "Invalid address format (must be 0x + 40 hex characters)"
- Action: Clear lookup results

**Address Not Found:**
- Input: `0x123456789abcdef123456789abcdef123456789a`
- Response: "Wallet address not found in system..."
- Action: Allow user to send anyway (might be personal wallet)

**API Failure:**
- Network error during lookup
- Display: Specific error message
- Action: User can retry

## Configuration

### Debounce Delay
Currently set to 300ms. To adjust:
```typescript
lookupDebounceTimer = setTimeout(() => {
  lookupWalletAddress(newAddress);
}, 300); // Change this value
```

### Auto-Select Bounty
Currently auto-selects first active bounty. To disable:
```typescript
// Comment out or remove:
const activeBounty = result.data.bounties?.find(...);
if (activeBounty) {
  selectedBountyId = activeBounty.id;
}
```

## Environment Variables

No new environment variables required. Uses existing:
- `PUBLIC_API_URL` - Backend API base URL
- JWT token from `$authStore`

## Browser Compatibility

- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- No additional polyfills needed
