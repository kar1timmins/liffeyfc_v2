# SendFunds Component - Wallet Transfer Feature

## Overview

The **SendFunds** component is a new dashboard feature that enables users to send cryptocurrency funds to any wallet address on supported networks (Ethereum Sepolia and Avalanche Fuji).

## Location

- **Component**: `frontend/src/lib/components/SendFunds.svelte`
- **Integrated into**: `frontend/src/routes/dashboard/+page.svelte`
- **Section**: Under "Transactions" heading on dashboard

## Features

### ✅ Network Support
- **Ethereum Sepolia** (testnet)
- **Avalanche Fuji** (testnet)
- Easy chain switching with button selection

### ✅ Real-Time Data
- **Balance Display**: Fetches wallet balance for selected chain
- **Gas Price**: Current gas price in Gwei
- **Gas Estimation**: Default 21,000 gas units (standard transfer)
- **Total Cost Calculation**: Automatically calculates amount + gas fees

### ✅ User-Friendly UI
- **Step-based UI States**:
  1. `connect` - Wallet not connected
  2. `form` - Main form for sending funds
  3. `submitting` - Loading state during transaction
  4. `success` - Transaction confirmation with hash and explorer link

- **Progressive Disclosure**: Shows cost breakdown only when amount entered
- **MAX Button**: Quick way to send entire balance minus gas
- **Recipient Validation**: Real-time validation of Ethereum addresses
- **Error Messages**: Clear, user-friendly error descriptions

### ✅ Transaction Handling
- Chain validation (switches network if needed)
- MetaMask integration for transaction signing
- Transaction hash display and copying
- Direct links to Etherscan (Ethereum) and Snowtrace (Avalanche)

## How It Works

### User Flow

1. **Connect Wallet**
   - User clicks "Connect Wallet" if not connected
   - MetaMask popup appears
   - Wallet status shows connected address

2. **Select Network**
   - Choose between Ethereum Sepolia or Avalanche Fuji
   - Balance auto-updates for selected chain
   - Gas price fetches automatically

3. **Enter Transaction Details**
   - Paste recipient address (0x...)
   - Enter amount to send
   - See real-time total cost calculation
   - Review gas fees breakdown

4. **Send Transaction**
   - Click "Send ETH/AVAX" button
   - MetaMask prompt for confirmation
   - Automatic network switching if needed
   - Transaction hash returned on success

5. **Confirmation**
   - Success screen shows transaction hash
   - Copy button for easy sharing
   - Direct link to blockchain explorer
   - Auto-redirect to form after 5 seconds

### Backend Integration

The component uses two existing backend endpoints:

**1. Get Wallet Balance**
```
GET /wallet-balance?address={walletAddress}&chain={chain}
Headers: Authorization: Bearer {token}

Response:
{
  "balanceWei": "1000000000000000000",
  "balanceEth": "1.0",
  "balanceAvax": "1.0",
  "rpcEndpoint": "https://..."
}
```

**2. Get Gas Price**
```
GET /wallet-balance/gas-price?chain={chain}
Headers: Authorization: Bearer {token}

Response:
{
  "gasPriceWei": "50000000000",
  "gasPriceGwei": "50"
}
```

### Frontend State Management

**Form State:**
```typescript
let selectedChain = 'ethereum' | 'avalanche'
let recipientAddress = string
let amount = number
let isSubmitting = boolean
let error = string | null
let success = boolean
let txHash = string | null
```

**Display State:**
```typescript
let balance = { ethereum: string, avalanche: string }
let gasPrice = { ethereum: string, avalanche: string }
let estimatedGas = 21000  // gas units
let totalCost = number    // amount + (gas * gasPrice)
```

## Validation

### Address Validation
- Must start with `0x`
- Must be exactly 40 hexadecimal characters
- Checked in real-time as user types

### Amount Validation
- Must be greater than 0
- Cannot exceed available balance
- Total cost (amount + gas) cannot exceed balance

### Chain Validation
- Checks if connected chain matches selected chain
- Prompts user to switch network via MetaMask
- Handles `wallet_switchEthereumChain` RPC call

## Error Handling

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid recipient address" | Wrong format | Check address starts with 0x, is 42 chars |
| "Insufficient balance" | Not enough funds | Add more testnet funds |
| "Insufficient balance for gas" | Can't cover transaction fees | Reduce amount or add funds |
| "MetaMask not found" | MetaMask not installed | Install MetaMask extension |
| "Network not configured in MetaMask" | Chain not added to wallet | Add testnet RPC in MetaMask |
| "Transaction failed" | RPC error or rejected | Check network, try again |

## UI Components Used

- **Lucide Svelte Icons**: Send, Wallet, AlertCircle, Loader, CheckCircle, Copy, ArrowRight
- **DaisyUI Elements**: 
  - `card` - Main container
  - `form-control` - Form fields
  - `input` - Text and number inputs
  - `btn` - Buttons
  - `alert` - Messages
  - `stat` - Balance/gas display
  - `divider` - Visual separators
  - `skeleton` - Loading states

## Styling

- **Gradient backgrounds**: Primary/secondary colors
- **Responsive grid**: 1 column on mobile, 2 on desktop
- **Smooth transitions**: Hover effects, animations
- **Color coding**: 
  - Success (green) - Connected, confirmed
  - Error (red) - Problems, warnings
  - Info (blue) - Status, help text
  - Warning (orange) - Insufficient balance

## Accessibility Features

- Form labels properly associated with inputs
- ARIA labels and roles
- Disabled states for buttons
- Clear error messages
- Keyboard accessible buttons
- High contrast text

## Testing Checklist

- [ ] Connect MetaMask wallet
- [ ] Switch between Ethereum and Avalanche
- [ ] Verify balance loads for both chains
- [ ] Verify gas price loads for both chains
- [ ] Enter valid recipient address
- [ ] Check validation message for invalid address
- [ ] Calculate total cost correctly
- [ ] Use MAX button to populate amount
- [ ] Submit transaction with MetaMask
- [ ] Verify network switching if needed
- [ ] Check transaction hash displays
- [ ] Verify explorer link works
- [ ] Test error scenarios (insufficient balance, etc.)
- [ ] Verify form resets after success
- [ ] Check responsive design on mobile

## Development Notes

### Key Features Implementation

1. **Reactive Balance Fetching**
   ```typescript
   $effect(() => {
     if (selectedChain) {
       fetchBalance();
       fetchGasPrice();
     }
   });
   ```

2. **Dynamic Cost Calculation**
   ```typescript
   $effect(() => {
     updateTotalCost();
   });
   ```

3. **Chain Switching**
   ```typescript
   const chainId = selectedChain === 'ethereum' ? '0xaa36a7' : '0xa869';
   await window.ethereum.request({
     method: 'wallet_switchEthereumChain',
     params: [{ chainId }]
   });
   ```

4. **Transaction Sending**
   ```typescript
   const txParams = {
     from: $formattedAddress,
     to: recipientAddress,
     value: '0x' + (BigInt(Math.floor(amount * 1e18)).toString(16)),
     gas: '0x' + estimatedGas.toString(16),
     gasPrice: '0x' + (BigInt(Math.floor(parseFloat(gasPrice[selectedChain]) * 1e9)).toString(16))
   };
   const hash = await window.ethereum.request({
     method: 'eth_sendTransaction',
     params: [txParams]
   });
   ```

## Future Enhancements

- [ ] Support mainnet networks (Ethereum mainnet, Avalanche C-Chain)
- [ ] Advanced gas settings (manual gas price, custom gas limit)
- [ ] Transaction history display
- [ ] Recipient address book
- [ ] QR code scanner for addresses
- [ ] Multiple wallet support
- [ ] Token transfers (not just native coins)
- [ ] Transaction scheduling
- [ ] Batch transfers

## Files Modified

- `frontend/src/lib/components/SendFunds.svelte` - New component (490 lines)
- `frontend/src/routes/dashboard/+page.svelte` - Added component import and section

## Git Commit

```
commit ad25491
feat: Add SendFunds component for wallet transfers on dashboard
```

---

**Status**: ✅ Complete and integrated  
**Build**: ✅ No TypeScript errors  
**Testing**: Ready for QA
