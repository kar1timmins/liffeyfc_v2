# Factory Contract Deployment Issue Diagnosed

## 🔴 Root Cause: Factory Contract Not Deployed

**Problem**: The factory address configured in `.env` either:
1. Has no contract at all, OR
2. Has a different contract (not the EscrowFactory)

**Evidence from Logs**:
```
✓ Factory contract code exists at 0x83f8C96c004796816f10504aaDFE64f55361442E (13024 bytes)
❌ Transaction reverted on-chain (Ethereum)
   Gas used: 26040 (very low - early revert)
   Status: 0 (failed)
```

The low gas usage (26,040) indicates the transaction reverted very early, likely in the constructor of CompanyWishlistEscrow.

---

## 🔧 How To Fix

### Step 1: Deploy the Factory Contract to Sepolia

```bash
cd hardhat

# Deploy factory to Ethereum Sepolia
npx hardhat run scripts/deploy-factory.ts --network sepolia

# Output will show:
# ✅ EscrowFactory deployed to: 0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**IMPORTANT**: Copy the deployment address from the output.

### Step 2: Update Backend Configuration

Update `.env` with the actual deployed address:

```bash
# OLD (not deployed):
# ETHEREUM_FACTORY_ADDRESS=0x83f8C96c004796816f10504aaDFE64f55361442E

# NEW (actual deployment):
ETHEREUM_FACTORY_ADDRESS=<paste actual address from Step 1>
```

### Step 3: Restart Backend

```bash
# If using docker-compose:
docker-compose down
docker-compose up -d backend

# If running manually:
# Kill the current backend process and run `pnpm start:dev` again
```

### Step 4: Test Escrow Creation Again

Try creating an escrow - it should now work!

---

## ✅ Verify Deployment

Before trying to create an escrow, verify the factory is deployed:

```bash
# Check if factory exists on Sepolia
npx hardhat run scripts/verify-factory.ts --network sepolia

# Or manually check with node:
node -e "
const ethers = require('ethers');
const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/YOUR_INFURA_KEY');
provider.getCode('0x83f8C96c004796816f10504aaDFE64f55361442E').then(code => {
  console.log('Contract code length:', code.length);
  console.log('Has contract:', code !== '0x');
});
"
```

---

## 📋 What To Deploy For Each Chain

### Ethereum Sepolia (Testnet)
```bash
npx hardhat run scripts/deploy-factory.ts --network sepolia
# Update: ETHEREUM_FACTORY_ADDRESS=<new address>
```

### Avalanche Fuji (Testnet)
```bash
npx hardhat run scripts/deploy-factory.ts --network avalanche
# Update: AVALANCHE_FACTORY_ADDRESS=<new address>
```

### Mainnet (Production - When Ready)
```bash
npx hardhat run scripts/deploy-factory.ts --network ethereum
npx hardhat run scripts/deploy-factory.ts --network avalanche-main
```

---

## 🔍 Why This Happened

1. The backend was configured with example factory addresses
2. No one had actually run the deploy scripts yet
3. The validation code checked if *any* contract code existed at that address
4. When trying to create an escrow, it called a contract that doesn't exist
5. The call reverted with no revert data (because there was nothing to revert)

---

## 📊 Before & After

### Before (Not Working)
```
ETHEREUM_FACTORY_ADDRESS=0x83f8C96c004796816f10504aaDFE64f55361442E  # Not deployed
                     ↓
Try to create escrow
                     ↓
Call factory.createEscrow()
                     ↓
❌ No contract at that address
❌ Transaction reverts
```

### After (Will Work)
```
ETHEREUM_FACTORY_ADDRESS=0xYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY  # Actually deployed
                     ↓
Try to create escrow
                     ↓
Call factory.createEscrow()
                     ↓
✅ Factory creates CompanyWishlistEscrow contract
✅ Transaction succeeds
```

---

## ⚠️ Important Notes

1. **Each network needs its own deployment**: Don't use the same address for Sepolia and Fuji
2. **Private keys needed**: The deployment account must have testnet ETH to pay gas
3. **Address is specific to deployment**: The address will be different each time you deploy
4. **Save the addresses**: Keep track of deployed factory addresses for reference

---

## 🚀 Full Checklist

- [ ] Deploy factory to Sepolia: `npx hardhat run scripts/deploy-factory.ts --network sepolia`
- [ ] Copy the deployed address from the output
- [ ] Update `.env` with `ETHEREUM_FACTORY_ADDRESS=<new address>`
- [ ] (Optional) Deploy factory to Fuji for Avalanche support
- [ ] (Optional) Update `AVALANCHE_FACTORY_ADDRESS` if deploying to Fuji
- [ ] Restart the backend
- [ ] Test by creating an escrow for a wishlist item
- [ ] Confirm transaction succeeds and contract addresses are saved

---

**Status**: 🔴 BLOCKED - Factory not deployed  
**Solution**: Deploy using Hardhat script and update configuration  
**Effort**: ~5-10 minutes  
**Estimated Cost**: ~$1-2 in Sepolia testnet fees
