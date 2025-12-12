# Smart Contract Factory Configuration Checklist

## Problem: "Contracts are being deployed..." stuck without addresses

If you see:
- "⏳ Contracts are being deployed..." message that doesn't clear
- Empty `transactionHashes` in API response: `{"ethereumAddress": null, "avalancheAddress": null}`
- No contract addresses saved to the database

**Root Cause**: Factory contracts not deployed or factory addresses not configured in environment

---

## Step 1: Check If Factory Contracts Are Deployed

### Verify Hardhat Deployment Scripts
```bash
cd hardhat
ls -la scripts/deploy*.ts
```

You should see:
- `scripts/deploy-factory.ts` - Deploys EscrowFactory.sol
- `scripts/deploy-escrow.ts` - (Optional) Deploys individual escrows

### Deploy Factory Contracts

**For Ethereum Sepolia (Testnet):**
```bash
cd hardhat
npx hardhat run scripts/deploy-factory.ts --network sepolia
```

**Expected Output:**
```
Deploying EscrowFactory to Sepolia...
✅ EscrowFactory deployed to: 0xabc123...
```

**For Avalanche Fuji (Testnet):**
```bash
npx hardhat run scripts/deploy-factory.ts --network fuji
```

**Expected Output:**
```
Deploying EscrowFactory to Fuji...
✅ EscrowFactory deployed to: 0xdef456...
```

---

## Step 2: Configure Factory Addresses in Environment

### Get the Deployed Addresses
From the output above, note down:
- `ETHEREUM_FACTORY_ADDRESS=0xabc123...` (from Sepolia)
- `AVALANCHE_FACTORY_ADDRESS=0xdef456...` (from Fuji)

### Local Development (docker-compose)

**Edit `.env`:**
```bash
# Smart Contract Factories (REQUIRED for deployments)
ETHEREUM_FACTORY_ADDRESS=0xabc123def456...
AVALANCHE_FACTORY_ADDRESS=0xdef456abc123...
```

**Restart services:**
```bash
docker-compose down
docker-compose up
```

### Production Deployment (Railway)

1. Go to Railway dashboard
2. Navigate to Backend service
3. Click "Variables"
4. Add environment variables:
   ```
   ETHEREUM_FACTORY_ADDRESS=0xabc123...
   AVALANCHE_FACTORY_ADDRESS=0xdef456...
   ```
5. Click "Deploy" to redeploy with new config

---

## Step 3: Verify Factory Configuration

### Check Backend Logs
```bash
# Docker-compose
docker-compose logs -f backend | grep -i factory

# Should show:
# ✓ [AppModule] ETHEREUM_FACTORY_ADDRESS configured
# ✓ [AppModule] AVALANCHE_FACTORY_ADDRESS configured
```

### Test Escrow Creation Endpoint
```bash
# Get JWT token first (from login response)
TOKEN="your_jwt_token"

curl -X POST http://localhost:3000/escrow/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "wishlistItemId": "item_id_here",
    "targetAmountEth": 0.5,
    "durationInDays": 30,
    "chains": ["ethereum", "avalanche"]
  }'
```

**Expected Response (success):**
```json
{
  "success": true,
  "message": "Escrow contracts deployed successfully",
  "data": {
    "ethereumAddress": "0x...",
    "avalancheAddress": "0x...",
    "transactionHashes": {
      "ethereum": "0x...",
      "avalanche": "0x..."
    }
  }
}
```

**Expected Response (missing factory):**
```json
{
  "statusCode": 500,
  "message": "Smart contract deployment is not yet configured on this network. Please contact support.",
  "error": "DeploymentFailed"
}
```

---

## Step 4: Test the Full Flow

### Create a Wishlist Item
1. Go to Dashboard → Companies
2. Create/select a company (must have wallet address)
3. Add a wishlist item with:
   - Title: "Test bounty"
   - Value: €1000
4. Click "Create Bounty Campaign"

### Verify Deployment
In the modal, you should see:
- ✓ "Creating bounty record..."
- ✓ "Deploying to Ethereum Sepolia..." (with loading spinner)
- ✓ Success page showing contract addresses

**If stuck on "Deploying..." after 60 seconds:**
1. Check backend logs: `docker-compose logs backend`
2. Look for error: "factory contracts configured"
3. Go back to Step 2 and verify factory addresses are set

---

## Step 5: Troubleshooting

### Error: "Smart contract deployment is not yet configured"
**Solution**: Factory addresses not set in environment variables
- [ ] Verify `ETHEREUM_FACTORY_ADDRESS` is set
- [ ] Verify `AVALANCHE_FACTORY_ADDRESS` is set
- [ ] Restart backend service after changing env vars

### Error: "Network not configured on this network" (only Ethereum or only Avalanche deployed)
**Solution**: One of the factory addresses is missing
- [ ] Run `npx hardhat run scripts/deploy-factory.ts --network sepolia`
- [ ] Run `npx hardhat run scripts/deploy-factory.ts --network fuji`
- [ ] Set both addresses in environment

### Empty response: `{"transactionHashes": {}}`
**Solution**: Deployment silently skipped (fixed in latest code)
- [ ] Update to latest backend code
- [ ] This should now return clear error message instead

### "No working RPC endpoint found"
**Solution**: RPC providers are down or network unreachable
- [ ] Check internet connection
- [ ] Try again (RPC providers may be temporarily unavailable)
- [ ] See `docs/RPC_CONFIGURATION_GUIDE.md` for alternative RPC endpoints

### "User wallet not found"
**Solution**: User doesn't have a wallet generated in database
- [ ] Go to Profile page
- [ ] Click "Generate Web3 Wallet"
- [ ] Try creating bounty again

---

## Step 6: Verify on Blockchain Explorers

After successful deployment, verify contracts exist:

**Ethereum Sepolia:**
```
https://sepolia.etherscan.io/address/0xabc123...
```

**Avalanche Fuji:**
```
https://testnet.snowtrace.io/address/0xabc123...
```

You should see:
- Contract code deployed
- Verified factory contract
- Transaction history

---

## Key Information

| Item | Value |
|------|-------|
| Factory Contract | `EscrowFactory.sol` |
| Escrow Contract | `CompanyWishlistEscrow.sol` |
| Networks | Ethereum Sepolia, Avalanche Fuji (testnet) |
| Env Var (Ethereum) | `ETHEREUM_FACTORY_ADDRESS` |
| Env Var (Avalanche) | `AVALANCHE_FACTORY_ADDRESS` |
| Format | `0x...` (42 character hex address) |

---

## Next Steps

Once factories are deployed and configured:
1. ✅ Users can create bounty campaigns
2. ✅ Investors can contribute to campaigns
3. ✅ Smart contracts hold funds in escrow
4. ✅ Refunds work on deadline failure
5. ✅ Company receives funds on success

See [BOUNTIES_API.md](./BOUNTIES_API.md) for API documentation.
