# Production Deployment Stuck on "Contracts are being deployed..."

## What's Happening?

Users see:
```
⏳ Contracts are being deployed... This may take a few moments. 
Refresh the page to see contract addresses.
```

But after refreshing, the message persists and no contract addresses appear.

## Why This Happens

The bounty record is created in the database with `isEscrowActive = true`, but the actual smart contracts are **not being deployed** because:

1. **Factory contracts haven't been deployed yet** to the blockchain
2. **OR factory addresses aren't configured** in the Railway environment variables

When this happens:
- The bounty record exists but has `null` for `ethereumEscrowAddress` and `avalancheEscrowAddress`
- The frontend shows "waiting for addresses" message
- API returns `"success": true` but with empty contract addresses

## Solution: 3-Step Fix

### Step 1: Deploy Factory Contracts (One-Time Setup)

Run this command once to deploy the factories:

```bash
cd hardhat

# Deploy to Ethereum Sepolia
npx hardhat run scripts/deploy-factory.ts --network sepolia

# Save the output address, e.g.: "✅ EscrowFactory deployed to: 0xabc123..."
```

Repeat for Avalanche:

```bash
# Deploy to Avalanche Fuji
npx hardhat run scripts/deploy-factory.ts --network fuji

# Save this address too: "✅ EscrowFactory deployed to: 0xdef456..."
```

### Step 2: Configure Factory Addresses in Railway

1. Go to your Railway dashboard
2. Click on the **Backend** service
3. Click the **Variables** tab
4. Add two new environment variables:
   ```
   ETHEREUM_FACTORY_ADDRESS=0xabc123...    (from step 1)
   AVALANCHE_FACTORY_ADDRESS=0xdef456...   (from step 1)
   ```
5. Click **Deploy** (Railway will rebuild and restart)

### Step 3: Test the Fix

1. Go to dashboard and create a new bounty
2. Should see proper deployment progress
3. After ~30-60 seconds, should see contract addresses

---

## Verify the Deployment

After deploying, check that your factory contracts exist:

**Ethereum Sepolia:**
```
https://sepolia.etherscan.io/address/0xabc123...
```

**Avalanche Fuji:**
```
https://testnet.snowtrace.io/address/0xdef456...
```

Should show contract code and transactions.

---

## If Still Stuck After Fix

Check backend logs:

```bash
# View Railway logs
# In Railway dashboard: Backend → Logs

# Look for messages like:
# - "✓ [AppModule] ETHEREUM_FACTORY_ADDRESS configured"
# - "✓ [AppModule] AVALANCHE_FACTORY_ADDRESS configured"
```

If you don't see these messages, restart the backend from Railway dashboard.

---

## For Development (Local Testing)

If testing locally with docker-compose:

```bash
# After deploying contracts, edit .env
ETHEREUM_FACTORY_ADDRESS=0x...
AVALANCHE_FACTORY_ADDRESS=0x...

# Restart docker
docker-compose down
docker-compose up
```

---

## Reference

See [FACTORY_CONFIGURATION_CHECKLIST.md](./FACTORY_CONFIGURATION_CHECKLIST.md) for detailed troubleshooting.
