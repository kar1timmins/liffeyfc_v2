# Wallet Restoration Auto-Generation Feature

## Overview
When a user restores their master wallet, the system now **automatically generates wallet addresses for all existing companies** that don't have addresses yet. This ensures companies created before wallet restoration become immediately usable for blockchain features without requiring manual wallet generation.

## Implementation

### Backend Changes

#### File: `src/web3/wallet-generation.service.ts`

**Method**: `restoreMasterWallet()` (lines ~230-283)

After creating the master wallet record, the service now:

1. **Queries for companies without addresses**:
   ```typescript
   const companiesWithoutAddresses = await this.companyRepo.find({
     where: { ownerId: userId, ethAddress: null },
   });
   ```

2. **Generates child wallets for each company**:
   - Uses incrementing child indices (starting at 1, since 0 is master wallet)
   - Derives addresses using BIP44 paths: `m/44'/60'/0'/0/{childIndex}`
   - Creates encrypted CompanyWallet records with private keys
   - Updates Company entities with ethAddress and avaxAddress

3. **Error Handling**:
   - Individual company wallet generation failures don't break restoration
   - Each company is wrapped in try-catch
   - Overall restoration succeeds even if some companies fail to generate wallets

4. **Updates master wallet**:
   - Sets `nextChildIndex = companiesWithoutAddresses.length + 1`
   - Prevents index collision for future companies

### Frontend Changes

#### File: `src/routes/profile/+page.svelte`

**Method**: `handleWalletGenerated()` (lines ~113-120)

Updated to call both:
```typescript
function handleWalletGenerated() {
  walletRefreshTrigger++;
  fetchMasterWallet();
  fetchMyCompanies();  // NEW: Refresh companies with generated addresses
}
```

This ensures the UI updates to display newly generated company addresses after restoration completes.

### User Flow

1. User opens RestoreWalletModal on profile page
2. User enters mnemonic phrase and submits
3. Backend processes:
   - Creates master wallet record
   - **Automatically generates addresses for all existing companies**
   - Updates both Company and CompanyWallet entities
4. Restoration completes successfully
5. Modal callback fires `handleWalletGenerated()`
6. Frontend:
   - Increments `walletRefreshTrigger`
   - Calls `fetchMasterWallet()` - updates master wallet display
   - Calls `fetchMyCompanies()` - fetches companies with newly generated addresses
7. CompanyManager displays companies with their new blockchain addresses
8. All addresses visible with truncation and reveal toggles

## Key Features

### Deterministic Wallet Generation
- Same mnemonic always produces same child wallets
- Indices match incrementally: company 1 gets childIndex 1, company 2 gets childIndex 2, etc.
- User can verify addresses match by restoring wallet multiple times

### Multi-Chain Support
- Each company gets Ethereum Sepolia address (derived from eth path)
- Each company gets Avalanche Fuji address (derived from avax path)
- Both addresses stored in Company entity

### Encrypted Storage
All private keys stored encrypted with AES-256-GCM:
- Each private key encrypted separately with unique IV
- Encryption performed in WalletGenerationService
- Decryption happens only when needed for transactions

## Database Impact

### Tables Modified
- `user_wallets` - Updates `nextChildIndex` after restoration
- `companies` - Updates `ethAddress` and `avaxAddress` for affected rows
- `company_wallets` - Creates new records for generated child wallets

### Migration Requirements
No new migrations needed. The CompanyWallet table already existed from previous work.

## Testing Scenarios

### Scenario 1: Generate Wallet, Create Companies, Restore Wallet
1. Generate new wallet on profile page
2. Register multiple companies
3. Logout
4. Restore wallet with saved mnemonic
5. **Expected**: Companies appear with addresses automatically populated

### Scenario 2: Create Companies, Restore Wallet
1. Logout all sessions
2. Restore wallet first time (no wallet in database)
3. Create multiple companies
4. Logout
5. Restore wallet again
6. **Expected**: All companies maintain same addresses (deterministic)

### Scenario 3: Mixed Wallets and Companies
1. Create company before wallet restoration
2. Restore wallet
3. Company A should get auto-generated address
4. Create company B after restoration
5. Company B should get newly generated address
6. Both should work correctly

### Scenario 4: Private Key Restoration
1. Restore from private key only (no mnemonic)
2. **Current behavior**: Company wallets not auto-generated (no mnemonic to derive from)
3. User can manually generate using "Generate Wallet Addresses" button in CompanyManager
4. **Future**: May implement alternative approach for private key restoration

## Error Handling

### What if auto-generation fails?
- Individual company failures logged but don't break restoration
- Company without address shows "No Wallet Addresses" in UI
- User can manually regenerate using button in CompanyManager
- Restoration completes successfully; user can retry company generation later

### What if database is inconsistent?
- Frontend shows "No Wallet Addresses" for companies missing addresses
- Manual regeneration endpoint available: `POST /wallet/company/:companyId`
- Both paths (auto-generation and manual) use same core logic

## Performance Considerations

- Auto-generation happens synchronously during restoration
- Each company wallet derivation is fast (< 50ms)
- Network calls to update database happen in sequence
- For users with many companies, restoration may take 1-2 seconds longer

**Optimization tip**: For future, could batch database updates or parallelize derivations

## Related Documentation

- [Master Wallet Lookup](./MASTER_WALLET_LOOKUP.md) - How wallet addresses are used
- [Three-Tier Wallet Architecture](./SYSTEM_ARCHITECTURE_THREE_TIER.md) - Wallet hierarchy explained
- [Wallet Generation System](./WALLET_GENERATION_SYSTEM.md) - Full wallet generation details

## Changelog

### Added
- Auto-generation of company wallet addresses during wallet restoration
- Automatic update of nextChildIndex to prevent collisions
- Frontend refresh to display generated addresses after restoration
- Error handling for individual company generation failures

### Fixed
- Wallet restoration leaving companies without blockchain addresses
- UI showing "No Addresses" message after successful restoration

### Files Modified
- `backend/src/web3/wallet-generation.service.ts` - Added auto-generation loop
- `frontend/src/routes/profile/+page.svelte` - Added fetchMyCompanies() call
