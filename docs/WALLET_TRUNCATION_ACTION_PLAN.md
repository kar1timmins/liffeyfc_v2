# Wallet Address Truncation - User Action Plan

## 🎯 Quick Summary

Your company's wallet address is malformed (missing 1 character), causing factory contract rejection. The backend now has validation to catch this and provide clear error messages.

**Build Status**: ✅ Backend successfully compiles with enhanced address validation  
**What Changed**: Added character-length checks before contract calls  
**What To Do**: Regenerate your company wallet

---

## ⚠️ What You'll See When This Happens

**Error Message**:
```
Company ETH wallet address has incorrect length (41 chars instead of 42). 
This indicates data corruption. Please regenerate the company wallet.
```

**In Logs**:
```
❌ ETH address has wrong length: 41 chars for company <company-id>
```

---

## 🔧 How To Fix It

### Immediate Action: Regenerate Company Wallet

**Option 1: Via Dashboard (When Implemented)**
```
1. Go to Dashboard → Companies → Edit Company
2. Click "Regenerate Wallet"
3. Wait for new wallet to be created
4. Try creating escrow again
```

**Option 2: Via API (For Now)**
```bash
# DELETE the existing company wallet
curl -X DELETE \
  http://localhost:3000/companies/{companyId}/wallet \
  -H "Authorization: Bearer {jwt_token}"

# This will orphan the wallet; company can auto-generate new one
# Try creating escrow next - it will auto-generate
```

**Option 3: Manual Database Fix (Development Only)**
```sql
-- Set wallet addresses to NULL to force regeneration
UPDATE companies
SET ethAddress = NULL, avaxAddress = NULL
WHERE id = '{company_id}';

-- Next time you create escrow, it will auto-generate
```

### Then: Create Escrow Again

After regenerating the wallet:
```
1. Navigate to your company page
2. Add/select a wishlist item
3. Click "Create Bounty"
4. Should succeed now with valid 42-character address
```

---

## 🔍 How To Verify The Fix

After regenerating wallet, check that the address is correct:

**In Backend Logs**:
```
✅ Auto-generated company wallet: ETH=0x... (42 chars), AVAX=0x... (42 chars)
✅ Verified company addresses - ETH: 0x... (42 chars), AVAX: 0x... (42 chars)
```

**In Database** (if you have access):
```sql
SELECT 
  id, name,
  ethAddress,
  LENGTH(ethAddress) as eth_len,
  avaxAddress,
  LENGTH(avaxAddress) as avax_len
FROM companies
WHERE ethAddress IS NOT NULL
LIMIT 5;

-- Both should show: eth_len = 42, avax_len = 42
```

---

## 🚀 What's Been Done To Prevent This

### Backend Validation Added ✅

**Two levels of validation now guard against malformed addresses**:

1. **In Escrow Controller** (`backend/src/web3/escrow.controller.ts`):
   - Checks if address is valid Ethereum address format
   - Checks if address is exactly 42 characters
   - Reports exact character count if wrong

2. **In Escrow Contract Service** (`backend/src/web3/escrow-contract.service.ts`):
   - Double-checks address validity before deployment
   - Reports character count and suggests wallet regeneration
   - Throws error BEFORE calling smart contract (saves gas)

### Error Messages Improved ✅

Before:
```
❌ Transaction reverted: require(false)
   (mysterious, unhelpful)
```

After:
```
❌ Company ETH wallet address has incorrect length (41 chars instead of 42). 
   This indicates data corruption. Please regenerate the company wallet.
   (clear, actionable)
```

---

## 🐛 Finding The Root Cause

The team is investigating **where** the address character is being lost:

1. ✅ **Not from ethers.js** - Direct test shows 42-char output
2. ✅ **Not from database column** - `varchar(42)` is correct
3. ✅ **Not from toLowerCase()** - Case conversion preserves length  
4. ✅ **Not from entity definition** - `length: 42` is correct
5. 🔴 **Unknown** - Somewhere in wallet generation or retrieval pipeline

**Investigation**: See `/docs/WALLET_ADDRESS_TRUNCATION_INVESTIGATION.md` for detailed analysis

---

## 📋 Troubleshooting Steps

### If Error Persists After Regenerating Wallet

**Step 1: Check Company Has Valid Wallet**
```bash
curl -X GET \
  http://localhost:3000/companies/{companyId} \
  -H "Authorization: Bearer {jwt_token}"

# Look for ethAddress and avaxAddress - both should be 42 chars
```

**Step 2: Check Backend Logs During Wallet Generation**
```bash
# Watch logs while regenerating
docker-compose logs -f backend | grep -i wallet

# Look for: "✅ Generated company wallet: ethAddress=0x... (42 chars)"
```

**Step 3: Check Database Directly**
```bash
# Connect to postgres and verify stored value
docker-compose exec postgres psql -U lfc_user -d lfc_db

SELECT id, name, ethAddress, LENGTH(ethAddress) as eth_len FROM companies LIMIT 5;
```

### If Character Count Still Wrong

**This indicates an underlying issue in the wallet generation pipeline**

Contact developer with:
- Company ID that has the problem
- Character count shown in error message
- Screenshot of logs from wallet generation
- Output of database query above

---

## 📚 Related Documentation

- **Full Investigation**: `/docs/WALLET_ADDRESS_TRUNCATION_INVESTIGATION.md`
- **Wallet System**: `/docs/MASTER_WALLET_LOOKUP.md`
- **Escrow System**: `/docs/ESCROW_SYSTEM.md`
- **Bounty API**: `/docs/BOUNTIES_API.md`

---

## ✅ Deployment Checklist

Before going to production:

- [ ] Backend deployed with address validation checks
- [ ] All existing companies' wallets verified (42 chars each)
- [ ] Corrupted wallets regenerated
- [ ] Root cause of truncation identified and fixed
- [ ] Database migration created to repair truncated addresses
- [ ] Unit tests added to prevent address length issues
- [ ] User-facing warning added if wallet regeneration needed

---

## 💡 Key Takeaways

1. **Addresses are now validated** - Malformed addresses caught early with clear errors
2. **You'll know if there's a problem** - Error message tells you exactly what's wrong
3. **Regeneration is the fix** - New wallet will be created with correct format
4. **Investigation ongoing** - Team working to prevent this in future

---

**Status**: 🟡 PARTIALLY RESOLVED  
**Detection**: ✅ Implemented  
**User Action**: Regenerate wallet  
**Root Cause**: 🔴 Still investigating  

**Last Updated**: 2024-12-13
