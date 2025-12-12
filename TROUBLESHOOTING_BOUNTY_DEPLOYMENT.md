# Debugging: Stuck on "Contracts are being deployed..." - Action Items

## What to Check NOW

### 1. Are Factory Contracts Deployed?

```bash
cd hardhat
npx hardhat run scripts/deploy-factory.ts --network sepolia
```

**Expected output:**
```
Deploying EscrowFactory to Sepolia...
✅ EscrowFactory deployed to: 0x1234567890123456789012345678901234567890
```

**If you see this**, factory is already deployed. **Save the address**.

Repeat for Avalanche:
```bash
npx hardhat run scripts/deploy-factory.ts --network fuji
```

### 2. Are Factory Addresses Configured in Railway?

1. Go to https://railway.app
2. Select your Liffey Founders Club project
3. Click **Backend** service
4. Click **Variables** tab
5. Check if these exist:
   - `ETHEREUM_FACTORY_ADDRESS` = 0x...
   - `AVALANCHE_FACTORY_ADDRESS` = 0x...

**If missing**, they need to be added.

### 3. Do the Addresses Match Deployed Contracts?

Compare the addresses from Step 1 output with what's in Railway Variables. They should match.

---

## How to Fix

### If Factory Contracts Are NOT Deployed Yet

**Option A: Deploy Using Hardhat (Recommended)**
```bash
cd hardhat

# Deploy to Ethereum Sepolia
npx hardhat run scripts/deploy-factory.ts --network sepolia

# Save the output address. Example:
# ✅ EscrowFactory deployed to: 0xABC...

# Deploy to Avalanche Fuji
npx hardhat run scripts/deploy-factory.ts --network fuji

# Save this address. Example:
# ✅ EscrowFactory deployed to: 0xDEF...
```

**Option B: Use Existing Deployment**
If contracts were already deployed, get the addresses:
- Check your deployment history
- Look in Etherscan/Snowtrace
- Check previous git commits

### If Addresses Need to Be Added to Railway

1. **Get the two addresses** from Step 1 (or existing deployment)
2. **Go to Railway dashboard**:
   - Project → Backend Service
   - Click **Variables** tab
3. **Click Add Variable** (or edit existing):
   - Name: `ETHEREUM_FACTORY_ADDRESS`
   - Value: `0xABC...` (from Sepolia deployment)
   - Click Save
4. **Add second variable**:
   - Name: `AVALANCHE_FACTORY_ADDRESS`
   - Value: `0xDEF...` (from Fuji deployment)
   - Click Save
5. **Railway will auto-deploy** the backend with new env vars

### Verify Deployment

1. Check **Railway Logs** (Backend service → Logs tab):
   ```
   ✓ [AppModule] ETHEREUM_FACTORY_ADDRESS configured: 0xABC...
   ✓ [AppModule] AVALANCHE_FACTORY_ADDRESS configured: 0xDEF...
   ```

2. **Test the fix**:
   - Go to dashboard
   - Create a test bounty
   - Should deploy in 30-60 seconds with contract addresses

---

## Verification

After fix, you should see:

### In Database (Companies & Wishlist Items)
- Wishlist item with `isEscrowActive = true`
- `ethereumEscrowAddress` = 0x... (actual contract address)
- `avalancheEscrowAddress` = 0x... (actual contract address)
- `campaignDeadline` = future date

### On Blockchain
- [Etherscan Sepolia](https://sepolia.etherscan.io):
  - Search for the contract address
  - Should show "Contract Source Code" deployed
  
- [Snowtrace Fuji](https://testnet.snowtrace.io):
  - Search for the contract address
  - Should show "Contract Source Code" deployed

### In Frontend
- CompanyManager shows actual contract addresses
- Button to view on Etherscan/Snowtrace works
- No more "waiting..." message

---

## If Still Stuck

### Check Backend Logs

**In Railway**:
1. Click Backend service
2. Click "Logs" tab at the top
3. Look for errors containing:
   - `❌ Failed to deploy`
   - `RPC error`
   - `insufficient funds`
   - `factory`

### Check Frontend Console

Open browser DevTools (F12):
1. Click **Console** tab
2. Look for fetch errors when creating bounty
3. Error messages will show actual issue

### Common Errors

| Error | Solution |
|-------|----------|
| "factory contracts configured" | Add factory addresses to Railway variables |
| "No working RPC endpoint" | RPC services down, try again later |
| "insufficient funds" | User wallet needs gas funds |
| "User wallet not found" | User needs to generate Web3 wallet first |
| "No contracts were deployed" | At least one factory missing |

---

## Timeline

- **5 min**: Check if factories deployed
- **5 min**: Add env vars to Railway
- **5 min**: Verify in logs
- **5 min**: Test bounty creation
- **Total**: ~20 minutes

---

## Reference Files

📄 [docs/FACTORY_CONFIGURATION_CHECKLIST.md](./docs/FACTORY_CONFIGURATION_CHECKLIST.md) - Detailed step-by-step guide

📄 [docs/FACTORY_DEPLOYMENT_QUICK_FIX.md](./docs/FACTORY_DEPLOYMENT_QUICK_FIX.md) - Quick reference

📄 [docs/RPC_CONFIGURATION_GUIDE.md](./docs/RPC_CONFIGURATION_GUIDE.md) - RPC troubleshooting

---

## Questions?

If deployment still fails after this, check:
1. Factory contracts actually exist on blockchain (Etherscan)
2. Factory addresses are exactly correct (0x... format)
3. Factory addresses in Railway Variables match deployed addresses
4. Backend has been restarted (Railway should auto-deploy after env change)
5. User has generated wallet (Profile → Generate Web3 Wallet)

The validation code will now give clear error messages for any issues.
