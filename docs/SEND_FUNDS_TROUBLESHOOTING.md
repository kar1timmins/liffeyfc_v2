# SendFunds Balance Loading Troubleshooting Guide

## Recent Fixes Applied

### 1. ✅ FAQ Updated (Removed MetaMask References)
**File**: `/frontend/src/routes/send/+page.svelte`

The FAQ section previously mentioned MetaMask, but SendFunds uses a backend wallet system instead. Updated:
- "Do I need MetaMask installed?" → "How does the wallet work?"
- Explains secure wallet generation and encrypted key storage
- Clarifies no MetaMask is needed

### 2. ✅ Balance Fetch Timing Fixed
**File**: `/frontend/src/lib/components/SendFunds.svelte`

Added a 100ms delay before auto-fetching balance after wallet loads. This ensures:
- Wallet addresses are properly set in state
- `selectedChain` (defaults to 'ethereum') is reactive
- Balance fetch happens with correct chain selected

### 3. ✅ Enhanced Logging Added
**Locations**: Both files above

Now shows detailed console logs:
```
"Wallet addresses loaded: { ethereum: '0x...', avalanche: '0x...' }"
"Auto-fetching balance for chain: ethereum"
"Fetching balance from: http://localhost:3000/wallet-balance?address=0x...&chain=ethereum"
"Balance response: { chain: 'ethereum', address: '0x...', balanceEth: '0.000000', ... }"
"Updated ethereum balance to: 0.000000"
```

## If Balance Still Shows "0"

### Root Cause: The Wallet Is Actually Empty on Testnet

The balance shows "0" because:
1. ✅ The endpoint is working correctly
2. ✅ The balance fetch is succeeding
3. ✅ The display is accurate - the wallet literally has 0 balance

**Testnet wallets are empty by default.** You need to add funds.

### How to Add Funds to Your TestnetWallet

#### For Ethereum Sepolia:
```bash
# Visit the Sepolia faucet
https://www.alchemy.com/faucets/ethereum-sepolia

# Or use the Sepolia POW faucet
https://sepolia-faucet.pk910.de/

# Paste your wallet address (shown in SendFunds form)
# Click "Send Me 1 ETH" or similar
```

#### For Avalanche Fuji:
```bash
# Visit the Fuji faucet
https://faucets.avax.network/

# Select Fuji Network
# Paste your wallet address
# Click "Request 1 AVAX"
```

#### Check Your Wallet Address in SendFunds
1. Go to `/send` page
2. Component loads with "Check" state
3. Once wallet loads, you'll see:
   ```
   Your Wallet Address
   [Your address will appear here]
   On [Ethereum Sepolia / Avalanche Fuji]
   ```
4. Copy this address to the faucet

### Verify Balance Loaded

After adding funds to the faucet:

1. **Check Browser Console** (F12 → Console tab)
   ```
   "Updated ethereum balance to: 1.000000"  ✅ Shows new balance
   ```

2. **Check UI**
   ```
   Wallet Balance
   1.000000 ETH  ✅ Shows updated amount
   On Ethereum Sepolia
   ```

3. **Test Transaction** (if balance > 0.1 ETH for gas)
   - Enter recipient address
   - Enter amount (e.g., 0.01)
   - Click "Send Funds"
   - Review transaction details
   - Confirm to send

## Debugging Checklist

### ✅ Verify Component Loads
- Navigate to `/send`
- Should see "Check" state with loading spinner
- Should complete within 2 seconds

### ✅ Verify Wallet Addresses Load
Console should show:
```javascript
"Wallet addresses loaded: { ethereum: '0x...', avalanche: '0x...' }"
```

### ✅ Verify Balance Fetch Started
Console should show:
```javascript
"Auto-fetching balance for chain: ethereum"
"Fetching balance from: http://localhost:3000/wallet-balance?address=0x...&chain=ethereum"
```

### ✅ Verify API Response
Console should show:
```javascript
"Balance response: { chain: 'ethereum', address: '0x...', balanceEth: '0.000000', ... }"
```

### ✅ Verify Balance Updated
Console should show:
```javascript
"Updated ethereum balance to: 0.000000"
```

## If Logs Don't Appear

### Issue 1: Console Logs Not Visible
**Solution**: Check you're looking at the right console
1. Press F12 to open DevTools
2. Click "Console" tab
3. Refresh page (F5)
4. Navigate to `/send`
5. Watch for logs

### Issue 2: Wallet Not Loading
**Check**: Are you authenticated?
- Should see user profile info
- JWT token should be valid
- Network tab should show `/wallet/addresses` succeeding

**If failing**: Check Network tab (F12 → Network)
```
Request: GET /wallet/addresses
Response: 200 OK with { success: true, data: { ethereum: '0x...', ... } }
```

### Issue 3: Balance API Failing
**Check**: Network tab for `/wallet-balance` request
```
Request: GET /wallet-balance?address=0x...&chain=ethereum
Response: 200 OK with { balanceEth: '0.000000', ... }
```

If response is 5xx error:
- Backend might be down
- Check backend logs: `docker-compose logs backend`
- RPC endpoints might be down (check Ethereum/Avalanche status)

## Working State Checklist

After applying fixes, verify:
- ✅ FAQ mentions "How does the wallet work?" (no MetaMask)
- ✅ Component shows 3 states: check → form → success
- ✅ Balance auto-loads when wallet addresses fetch
- ✅ Console shows detailed logs for all steps
- ✅ Balance displays in UI (even if "0.000000")
- ✅ Switching chains updates balance instantly
- ✅ "Insufficient balance" only shows when true

## Common Questions

### Q: Why is my balance always 0.000000?
**A**: Testnet wallets start empty. You need to use a faucet to add test funds.

### Q: Do I need MetaMask to send funds?
**A**: **No!** SendFunds uses backend wallet signing. MetaMask is not required.

### Q: How are my private keys stored?
**A**: Encrypted with AES-256-GCM. Only authenticated users can access their wallet.

### Q: Can I import an existing wallet?
**A**: Currently, a new wallet is generated for each account. This prevents private key exposure.

### Q: Why is the loading state called "Check"?
**A**: It "checks" that your wallet exists and loads your wallet addresses for both chains.

### Q: What happens if wallet-balance endpoint fails?
**A**: You'll see a toast error with the specific error message. Balance defaults to "0", preventing accidental over-sending.

## Code Changes Summary

### SendFunds.svelte Updates

**Before**:
```typescript
// Immediately fetch balance (selectedChain might not be set)
await fetchUserBalance();
```

**After**:
```typescript
// Wait 100ms to ensure state is reactive, then fetch
setTimeout(async () => {
    console.log('Auto-fetching balance for chain:', selectedChain);
    await fetchUserBalance();
}, 100);
```

### Page FAQ Updates

**Before**: "Do I need MetaMask installed? Yes..."
**After**: "How does the wallet work? A secure wallet is automatically generated..."

## Files Modified

1. `/frontend/src/lib/components/SendFunds.svelte`
   - Added setTimeout for balance fetch timing
   - Added console.log for wallet address load
   
2. `/frontend/src/routes/send/+page.svelte`
   - Updated "How It Works" section (no MetaMask)
   - Updated FAQ questions to match backend wallet approach

## Next Steps

1. **Reload frontend** to get updated component
2. **Navigate to `/send`** and watch console logs
3. **If balance shows 0**: Use testnet faucet to add funds
4. **Test transaction** once you have testnet balance
5. **Report any issues** with specific error messages from console

## Support

If balance still won't load after following this guide:

1. **Collect debug info**:
   - Screenshot of console logs
   - Network tab screenshot of `/wallet-balance` request/response
   - User's wallet address
   - Selected chain (ethereum or avalanche)

2. **Check backend logs**:
   ```bash
   docker-compose logs backend | grep -i "balance\|wallet"
   ```

3. **Verify RPC connectivity**:
   ```bash
   curl "https://ethereum-sepolia-rpc.publicnode.com" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
   ```
