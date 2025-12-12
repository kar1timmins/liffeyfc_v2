# Contract Deployment Quick Start

## ⚡ Quick Fix for RPC 522 Error

The "server response 522" error was caused by the RPC endpoint being temporarily unavailable. **This is now fixed** with automatic fallback endpoints.

## What You Need to Do

### Option 1: Keep Current Setup (Recommended for Testing)
No action needed! The fallback mechanism is automatic.

```bash
# Just try deploying again
# The service will automatically find a working RPC endpoint
```

### Option 2: Use a Better RPC Provider (Recommended for Production)

Pick one and follow the setup:

#### **Infura** (Industry Standard)
```bash
# 1. Sign up: https://infura.io
# 2. Create project, get Project ID
# 3. Update .env:
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/<YOUR_PROJECT_ID>

# 4. Restart backend
docker-compose restart backend
# or: npm run start:dev
```

#### **Alchemy** (Good Free Tier)
```bash
# 1. Sign up: https://www.alchemy.com/
# 2. Create app, get API key
# 3. Update .env:
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<YOUR_API_KEY>

# 4. Restart backend
docker-compose restart backend
```

#### **QuickNode** (Best Support)
```bash
# 1. Sign up: https://www.quicknode.com/
# 2. Create endpoint
# 3. Update .env:
ETHEREUM_RPC_URL=https://weathered-aged-frog.ethereum-sepolia.quiknode.pro/<YOUR_TOKEN>/

# 4. Restart backend
docker-compose restart backend
```

## Test It Works

```bash
# 1. Try creating a bounty (contract deployment)
#    You should see success message

# 2. Check logs to see which RPC was used
docker-compose logs backend | grep -i "rpc\|escrow"

# Expected output:
# ✅ Using Ethereum RPC: https://sepolia.drpc.org
# ✅ Ethereum escrow deployed: 0x1234...
```

## If It Still Fails

### Check 1: Do you have testnet tokens?
```bash
# Ethereum Sepolia
https://faucet.quicknode.com/ethereum/sepolia

# Avalanche Fuji
https://faucet.avax.network/
```

### Check 2: Is the wallet address valid?
- Verify company has a wallet address set
- Must start with `0x` and be 42 characters

### Check 3: Check the backend logs
```bash
docker-compose logs backend | tail -50
```

### Check 4: Full troubleshooting guide
See `docs/RPC_CONFIGURATION_GUIDE.md`

## Key Changes Made

| What | Where | Why |
|------|-------|-----|
| Fallback RPC endpoints | `backend/src/web3/escrow-contract.service.ts` | Automatic switch if primary fails |
| Better error messages | `backend/src/web3/escrow.controller.ts` | Users see helpful errors, not raw RPC errors |
| RPC configuration docs | `backend/.env.example` | Know how to configure for production |
| Troubleshooting guide | `docs/RPC_CONFIGURATION_GUIDE.md` | Fix common issues quickly |

## What Happens Now

When you try to deploy a contract:

1. ✅ Try your configured RPC endpoint
2. ❌ If it fails...
3. ✅ Automatically try fallback: sepolia.drpc.org
4. ❌ If that fails...
5. ✅ Try fallback: sepolia-rpc.publicnode.com
6. ... continue until success or all fail
7. ✅ Use that endpoint and deploy contract

All automatically! No manual intervention needed.

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Blockchain service unavailable" | All RPC endpoints down - wait and retry |
| "Insufficient funds" | Get testnet tokens from faucet |
| "Invalid wallet address" | Update company wallet in settings |
| Service keeps trying fallbacks | Backend logs show which RPC is being tested |

## That's It! 🎉

Just deploy and it should work. The system handles the RPC complexity for you.

---

**Need more details?** See:
- [docs/RPC_CONFIGURATION_GUIDE.md](../docs/RPC_CONFIGURATION_GUIDE.md) - Full guide
- [docs/RPC_FIX_SUMMARY.md](../docs/RPC_FIX_SUMMARY.md) - Technical details
- [backend/.env.example](../backend/.env.example) - Configuration options
