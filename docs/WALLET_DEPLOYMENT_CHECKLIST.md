# Wallet System Deployment Checklist

## Pre-Deployment Steps

### 1. Generate Encryption Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
- [ ] Copy generated 64-character hex string
- [ ] Store in secure password manager

### 2. Configure Railway Environment
- [ ] Navigate to Railway project settings
- [ ] Add environment variable: `WALLET_ENCRYPTION_KEY=<generated-key>`
- [ ] Verify variable is saved and applied

### 3. Database Migration
```bash
# Railway CLI method
railway run pnpm run migration:run

# Or via Railway console
cd backend && pnpm run migration:run
```
- [ ] Verify migration executed successfully
- [ ] Check tables created: `user_wallets`, `company_wallets`
- [ ] Verify foreign key constraints exist

### 4. Verify Build Success
- [ ] Backend builds successfully (`pnpm run build`)
- [ ] Frontend builds successfully (`pnpm run build`)
- [ ] No TypeScript errors
- [ ] All tests pass

## Deployment

### 1. Push to Git
```bash
git add -A
git commit -m "Implement HD wallet generation system with encryption and derivation"
git push origin main
```

### 2. Monitor Railway Deployment
- [ ] Backend deploys successfully
- [ ] Frontend deploys successfully
- [ ] Health checks pass
- [ ] No error logs

### 3. Verify Database
```bash
# Check tables exist
railway run psql $DATABASE_URL -c "\dt"

# Verify table structure
railway run psql $DATABASE_URL -c "\d user_wallets"
railway run psql $DATABASE_URL -c "\d company_wallets"
```

## Post-Deployment Testing

### 1. Test Master Wallet Generation
- [ ] Sign in to platform
- [ ] Navigate to Profile → Web3 Wallet
- [ ] Click "Generate New Wallet"
- [ ] Verify security warnings display
- [ ] Acknowledge warnings and generate
- [ ] Verify addresses displayed (ETH + AVAX)
- [ ] Verify mnemonic displayed (12 words)
- [ ] Copy mnemonic using copy button
- [ ] Download wallet file
- [ ] Verify file contents correct
- [ ] Close modal
- [ ] Verify cannot generate second wallet

### 2. Test Company Wallet Derivation
- [ ] Navigate to Companies → Add Company
- [ ] Fill out company form completely
- [ ] Submit form
- [ ] Navigate to created company detail page
- [ ] Verify company has wallet addresses
- [ ] Verify addresses different from master wallet
- [ ] Create second company
- [ ] Verify second company has different addresses

### 3. Database Verification
```bash
# Check user_wallets table
railway run psql $DATABASE_URL -c "SELECT id, \"userId\", eth_address, avax_address, derivation_path, next_child_index FROM user_wallets;"

# Check company_wallets table
railway run psql $DATABASE_URL -c "SELECT id, \"companyId\", \"parentWalletId\", eth_address, avax_address, derivation_path, child_index FROM company_wallets;"

# Verify encryption (should see encrypted strings)
railway run psql $DATABASE_URL -c "SELECT encrypted_mnemonic FROM user_wallets LIMIT 1;"
```

- [ ] Master wallet record exists
- [ ] Mnemonic is encrypted (not plaintext)
- [ ] Private keys are encrypted (not plaintext)
- [ ] Company wallets linked to parent via parentWalletId
- [ ] Child indices increment correctly (1, 2, 3...)
- [ ] Derivation paths correct

### 4. API Endpoint Testing
```bash
# Get auth token first by signing in, then:

# Check wallet status
curl -X GET https://liffeyfcv2-production.up.railway.app/wallet/check \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get addresses
curl -X GET https://liffeyfcv2-production.up.railway.app/wallet/addresses \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get company wallets
curl -X GET https://liffeyfcv2-production.up.railway.app/wallet/companies \
  -H "Authorization: Bearer YOUR_TOKEN"
```

- [ ] `/wallet/check` returns correct status
- [ ] `/wallet/addresses` returns public addresses
- [ ] `/wallet/companies` returns all company wallets
- [ ] All endpoints require authentication
- [ ] Error messages are clear

### 5. Security Verification
- [ ] Mnemonic never appears in API responses after generation
- [ ] Private keys never appear in API responses after generation
- [ ] Database stores encrypted values (verify with raw query)
- [ ] Cannot generate multiple wallets per user
- [ ] Company wallets auto-generated only for users with master wallet
- [ ] Encryption key not exposed in logs or error messages

### 6. UI/UX Testing
- [ ] Modal displays correctly on all screen sizes
- [ ] Security warnings prominent and clear
- [ ] Mnemonic grid displays all 12 words
- [ ] Copy button works for mnemonic
- [ ] Download button works and file contains correct data
- [ ] Cannot close modal without acknowledgment
- [ ] Company detail pages show wallet addresses
- [ ] Copy address buttons work
- [ ] "Send Funds" via MetaMask works (if connected)

## Rollback Plan

### If Deployment Fails:
1. **Revert Git Commit**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Revert Database Migration**
   ```bash
   railway run pnpm run migration:revert
   ```

3. **Remove Environment Variable**
   - Delete `WALLET_ENCRYPTION_KEY` from Railway

### If Data Corruption Occurs:
1. **Stop All Services**
2. **Restore Database from Backup**
3. **Investigate Root Cause**
4. **Fix and Redeploy**

## Monitoring

### Metrics to Watch
- [ ] Wallet generation success rate
- [ ] Company wallet auto-generation success rate
- [ ] API response times for wallet endpoints
- [ ] Database query performance
- [ ] Error rates in logs

### Log Keywords to Monitor
- "WALLET_ENCRYPTION_KEY"
- "wallet generation failed"
- "encryption error"
- "decryption error"
- "derivation failed"

## Documentation Updates

- [ ] Update main README.md with wallet feature
- [ ] Update backend/README.md with wallet endpoints
- [ ] Update frontend/README.md with wallet UI components
- [ ] Document environment variables in .env.example
- [ ] Add wallet system to deployment docs

## User Communication

- [ ] Announce new wallet feature
- [ ] Provide user guide for wallet generation
- [ ] Emphasize importance of downloading wallet file
- [ ] Explain security best practices
- [ ] Set up support channel for wallet issues

## Security Audit Checklist

- [ ] Encryption implementation reviewed
- [ ] Key management strategy reviewed
- [ ] Database security verified
- [ ] API authentication verified
- [ ] Input validation verified
- [ ] Error handling doesn't leak sensitive data
- [ ] HTTPS enforced
- [ ] CORS configured correctly
- [ ] Rate limiting on wallet operations (future)

## Success Criteria

✅ Users can generate master wallets  
✅ Wallet data displayed once and downloadable  
✅ Company wallets auto-generated from master  
✅ All private data encrypted in database  
✅ No security vulnerabilities detected  
✅ Performance meets expectations  
✅ Zero data loss  
✅ Clear error messages for users  
✅ Comprehensive logging for debugging  

## Post-Launch

### Week 1
- [ ] Monitor error logs daily
- [ ] Track wallet generation metrics
- [ ] Collect user feedback
- [ ] Address any bugs immediately

### Month 1
- [ ] Review security logs
- [ ] Analyze usage patterns
- [ ] Plan enhancements based on feedback
- [ ] Consider audit by security firm

### Ongoing
- [ ] Rotate encryption keys periodically
- [ ] Update dependencies for security patches
- [ ] Monitor blockchain network changes
- [ ] Evaluate additional features (multi-sig, hardware wallet)
