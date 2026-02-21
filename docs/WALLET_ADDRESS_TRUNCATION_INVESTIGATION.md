# Wallet Address Truncation Investigation

## Issue Summary

**Problem**: Company wallet addresses are being stored/retrieved with only 39 hex characters instead of 40, causing them to be invalid for Solidity contract calls.

**Evidence**:
- **Expected**: `0xd667a758f967fc01327bc0fa385f8c32e56aef80` (42 characters total: `0x` + 40 hex)
- **Actual**: `0xd667a758f967fc01327bc0fa385f8c32e56aef8` (41 characters total: `0x` + 39 hex)
- **Missing**: Final `0` digit

**Impact**: Factory contract rejects the call with `require(false)` because the address is malformed/incomplete.

---

## Root Cause Analysis

### Hypothesis 1: Database Column Length ✅ VERIFIED CORRECT
- **Column Definition**: `varchar(42)` (sufficient for 42-character addresses)
- **Migration**: `1762294700000-add-wallet-addresses-to-companies.ts` 
- **Status**: Correct - uses `length: '42'`
- **Conclusion**: Database is not truncating based on column size

### Hypothesis 2: TypeORM Entity Mapping ✅ VERIFIED CORRECT
- **Entity**: `Company.entity.ts` line 65-68
- **Definitions**:
  ```typescript
  @Column({ type: 'varchar', length: 42, nullable: true })
  ethAddress?: string;

  @Column({ type: 'varchar', length: 42, nullable: true })
  avaxAddress?: string;
  ```
- **Status**: Correct - length is `42` (number)
- **Conclusion**: TypeORM entity is correctly defined

### Hypothesis 3: ethers.js Output ✅ VERIFIED CORRECT
- **Test Result**:
  ```javascript
  const { Wallet } = require('ethers');
  const w = Wallet.createRandom();
  console.log(w.address); // Output: 0x276e667Bc9484D41991c2ba7A32C3FfB1264a403 (42 chars)
  ```
- **Status**: ethers.js correctly returns 42-character addresses
- **Conclusion**: Address generation is not the issue

### Hypothesis 4: toLowerCase() Processing ✅ VERIFIED CORRECT
- **Test Result**:
  ```javascript
  const addr = '0x62e1052329cb51c808F4e25e53Df4aa8EEEA0601';
  console.log(addr.toLowerCase().length); // Output: 42
  ```
- **Status**: Case conversion does NOT affect length
- **Conclusion**: Not a case conversion issue

### Hypothesis 5: Address Storage/Retrieval (🔴 UNCONFIRMED)
**Most Likely**:
- Wallet generation creates proper 42-char address
- Address is stored to database
- Address is retrieved from database with 1 character missing
- **Possible causes**:
  1. Custom getter/setter in entity truncating address
  2. Database driver encoding issue
  3. Encryption/decryption padding problem
  4. TypeORM query manipulation
  5. A `.slice()` or `.substring()` operation somewhere

---

## Detection & Mitigation

### Added Validations (✅ IMPLEMENTED)

**File**: `backend/src/web3/escrow.controller.ts`

```typescript
// Extra validation - ensure addresses are exactly 42 characters
if (company.ethAddress && company.ethAddress.length !== 42) {
  throw new HttpException(
    `Company ETH wallet address has incorrect length (${company.ethAddress.length} chars instead of 42). This indicates data corruption. Please regenerate the company wallet.`,
    HttpStatus.BAD_REQUEST
  );
}
```

**File**: `backend/src/web3/escrow-contract.service.ts`

```typescript
// Extra validation - ensure addresses are exactly 42 characters
if (companyWalletAddress.length !== 42) {
  const detail = `Address has ${companyWalletAddress.length} characters instead of 42 - data corruption suspected`;
  throw new BadRequestException(`Company wallet address validation failed. ${detail}. Please regenerate company wallet.`);
}
```

### User Impact

When address is truncated:
- ✅ Clear error message indicating data corruption
- ✅ Actionable guidance to regenerate wallet
- ✅ Character count reported for debugging
- ✅ Error thrown BEFORE contract call (saves gas, clear error)

---

## Debugging Steps

### Step 1: Enable Dev Logging

Check if wallet generation logs show the correct address:

```bash
# Backend logs during wallet generation should show:
📋 Generated company wallet: ethAddress=0x... (42 chars), avaxAddress=0x... (42 chars)
✅ Saved company wallet record: <uuid>
✅ Verified company addresses - ETH: 0x... (42 chars), AVAX: 0x... (42 chars)
```

### Step 2: Direct Database Query

Connect to PostgreSQL and check actual stored value:

```sql
-- Check actual character lengths stored
SELECT 
  id, 
  name,
  ethAddress,
  LENGTH(ethAddress) as eth_len,
  avaxAddress,
  LENGTH(avaxAddress) as avax_len
FROM companies
WHERE ethAddress IS NOT NULL;
```

**Expected Output**:
```
eth_len = 42
avax_len = 42
```

**If truncated**:
```
eth_len = 41 or 39 or less
avax_len = 41 or 39 or less
```

### Step 3: Check Encryption/Decryption

If private keys are encrypted, verify decryption isn't affecting addresses:

```typescript
// In escrow-contract.service.ts decrypt() method
// Check that decrypted address is correct length
const decrypted = this.decrypt(encryptedData);
console.log(`Decrypted length: ${decrypted.length}`); // Should be 42
```

### Step 4: Trace Wallet Generation Flow

Add detailed logging to `wallet-generation.service.ts`:

```typescript
const childWallet = HDNodeWallet.fromPhrase(mnemonic, undefined, derivationPath);
console.log(`✅ HD Wallet derived - address: ${childWallet.address}, length: ${childWallet.address.length}`);

const companyWallet = this.companyWalletRepo.create({
  ethAddress: childWallet.address, // Log: should be 42 chars
  // ...
});

const savedWallet = await this.companyWalletRepo.save(companyWallet);
console.log(`✅ Saved to DB - ethAddress: ${savedWallet.ethAddress}, length: ${savedWallet.ethAddress.length}`);

const updated = await this.companyRepo.update(companyId, {
  ethAddress: childWallet.address, // Log: should be 42 chars
  // ...
});

const company = await this.companyRepo.findOne({ where: { id: companyId } });
console.log(`✅ Retrieved from DB - ethAddress: ${company.ethAddress}, length: ${company.ethAddress.length}`);
```

---

## Solution Path

### Immediate Fix (✅ DONE)
- [x] Add `.length` validation in escrow controller
- [x] Add `.length` validation in escrow-contract service
- [x] Provide clear error messages with character count
- [x] Guide users to regenerate wallet

### Investigation (IN PROGRESS)
- [ ] Enable detailed dev logging during wallet generation
- [ ] Query database to confirm truncation is happening
- [ ] Identify exactly where truncation occurs
- [ ] Check encryption/decryption pipeline
- [ ] Review all `.slice()`, `.substring()`, and string manipulation operations

### Long-term Fix (BLOCKED UNTIL ROOT CAUSE FOUND)
Once root cause identified:
- [ ] Fix the truncation source
- [ ] Add unit test to verify address length is preserved
- [ ] Create database migration to repair existing truncated addresses
- [ ] Force users to regenerate wallets with fixed code

---

## Testing Checklist

### Pre-Fix Testing
- [ ] Create company without explicit wallet generation
- [ ] Check if auto-generated address is 42 chars
- [ ] Try creating escrow - should get clear error about address length
- [ ] Check logs for truncation point

### Post-Fix Testing  
- [ ] Fix truncation source
- [ ] Regenerate company wallet
- [ ] Verify address is now 42 chars in database
- [ ] Create escrow successfully
- [ ] Confirm factory contract calls succeed

---

## Files for Investigation

1. **Wallet Generation**:
   - `/backend/src/web3/wallet-generation.service.ts` (lines 400-450)
   - Check: HD derivation, private key encryption, database save

2. **Wallet Entities**:
   - `/backend/src/entities/company.entity.ts` (lines 65-68)
   - `/backend/src/entities/user-wallet.entity.ts` (address columns)
   - `/backend/src/entities/company-wallet.entity.ts` (address columns)

3. **Database Migrations**:
   - `/backend/src/migrations/1762294800000-create-wallet-tables.ts` (schema definition)
   - `/backend/src/migrations/1762294700000-add-wallet-addresses-to-companies.ts` (schema definition)

4. **Query Repositories**:
   - `backend/src/web3/*.service.ts` (any `.query()` or custom SQL)
   - Check for substring operations or string manipulation

---

## Related Issues

- **Factory Contract Rejection**: `require(false)` revert from factory contract when company wallet address is invalid
- **Escrow Deployment Failure**: Cannot deploy escrow with invalid company wallet address
- **Data Integrity**: Address truncation indicates systematic issue in storage/retrieval pipeline

---

## Status: 🔄 IN PROGRESS

**Detection**: ✅ DONE - Addresses detected as malformed, validation added  
**Root Cause**: 🔴 UNKNOWN - Where is the character being lost?  
**Fix**: 🔴 BLOCKED - Cannot fix until root cause is identified  
**Workaround**: Users must regenerate company wallets  

---

**Last Updated**: 2024-12-13  
**Investigated By**: GitHub Copilot with user feedback  
**Build Status**: ✅ Successfully compiles with address validation checks
