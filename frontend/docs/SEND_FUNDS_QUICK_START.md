# SendFunds Component - Quick Start

## What It Does

A new **Transactions** section on the Dashboard that lets users send cryptocurrency to any wallet address.

## Key Features

✅ **Chain Support**: Ethereum Sepolia & Avalanche Fuji  
✅ **Real-time Data**: Live balance and gas price fetching  
✅ **Smart UI**: Step-based wizard with progressive disclosure  
✅ **Safe**: Address validation and balance checking  
✅ **Easy**: MAX button, auto-formatting, explorer links  

## User Journey

1. **Dashboard** → Scroll to "Transactions" section
2. **Connect Wallet** (if not already connected)
3. **Select Network** (Ethereum or Avalanche)
4. **Enter Details** (recipient address + amount)
5. **Review Costs** (see gas fees breakdown)
6. **Send** (MetaMask popup confirms)
7. **View Hash** (copy or view on explorer)

## UI States

### Connect State
```
🔗 Connect Your Wallet
   You need to connect a Web3 wallet to send funds.
   [Connect Wallet Button]
```

### Form State
```
⟠ Ethereum Sepolia    ▲ Avalanche Fuji
Balance: 1.5 ETH       Gas: 50 Gwei
[Recipient address input]
[Amount input with MAX button]
Fee calculation shown
[Send ETH Button]
```

### Success State
```
✅ Transaction Submitted!
   Transaction Hash: 0x...
   [Copy Button]
   View on Etherscan →
```

## Technical Details

**Component Location**: `frontend/src/lib/components/SendFunds.svelte`

**Backend APIs Used**:
- `GET /wallet-balance` - Fetches balance
- `GET /wallet-balance/gas-price` - Fetches gas price

**MetaMask Methods**:
- `eth_requestAccounts` - Connect wallet
- `eth_chainId` - Get current chain
- `wallet_switchEthereumChain` - Switch network
- `eth_sendTransaction` - Send crypto

## Chain IDs

| Network | Chain ID |
|---------|----------|
| Ethereum Sepolia | 0xaa36a7 |
| Avalanche Fuji | 0xa869 |

## Address Format Validation

✅ Must start with `0x`  
✅ Must be exactly 42 characters (0x + 40 hex chars)  
✅ Example: `0x1234567890123456789012345678901234567890`

## Gas Estimation

- **Estimated Gas**: 21,000 gas units (standard transfer)
- **Total Cost**: Amount + (Gas Units × Gas Price)
- **Formula**: `(21000 * gasPrice) / 1e9 = cost in ETH/AVAX`

## Error Scenarios

| Issue | Message | Fix |
|-------|---------|-----|
| Wallet not connected | "Please connect your wallet first" | Click Connect Wallet |
| Invalid address | "Invalid recipient address..." | Check 0x format |
| Amount too high | "Insufficient balance..." | Reduce amount |
| Gas fees too high | "Insufficient balance for gas..." | Add more funds or reduce amount |
| Network not added | "Not configured in MetaMask" | Add testnet to wallet |

## File Structure

```
frontend/
├── src/
│   ├── lib/
│   │   └── components/
│   │       └── SendFunds.svelte        (490 lines)
│   └── routes/
│       └── dashboard/
│           └── +page.svelte            (imports SendFunds)
└── docs/
    └── SEND_FUNDS_FEATURE.md           (full docs)
```

## Testing

Basic flow to test:
1. Go to Dashboard
2. Scroll to "Transactions"
3. Connect MetaMask
4. Select network
5. Enter test address: `0x0000000000000000000000000000000000000000`
6. Enter amount: `0.001`
7. Click Send
8. Confirm in MetaMask
9. See transaction hash

## Code Examples

### Accessing in Components

```svelte
<script>
  import SendFunds from '$lib/components/SendFunds.svelte';
</script>

<SendFunds />
```

### Balance Fetching

```typescript
const response = await fetch(
  `${PUBLIC_API_URL}/wallet-balance?address=${address}&chain=ethereum`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
const data = await response.json();
console.log(data.balanceEth); // "1.5"
```

## Future Enhancements

- [ ] Mainnet support
- [ ] Advanced gas settings
- [ ] Transaction history
- [ ] Address book
- [ ] QR code scanner
- [ ] Token transfers
- [ ] Batch transfers

---

**Status**: ✅ Live and integrated  
**Last Updated**: 2024  
**Build Status**: ✅ Passes TypeScript check
