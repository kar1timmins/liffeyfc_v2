# Master Wallet Fund Forwarding - Deployment Checklist

## Pre-Deployment

- [ ] Review `/docs/MASTER_WALLET_FUND_FORWARDING.md` for architecture overview
- [ ] Ensure all tests pass in backend and hardhat
- [ ] Backup existing contract deployments (save factory addresses)

## Smart Contract Deployment

### Ethereum Sepolia

```bash
cd hardhat
npx hardhat run scripts/deploy-factory.ts --network sepolia
```

- [ ] Note new `ETHEREUM_FACTORY_ADDRESS` from deployment output
- [ ] Update `.env` with new address: `ETHEREUM_FACTORY_ADDRESS=0x...`
- [ ] Verify on Etherscan: https://sepolia.etherscan.io/address/0x...

### Avalanche Fuji

```bash
cd hardhat
npx hardhat run scripts/deploy-factory.ts --network fuji
```

- [ ] Note new `AVALANCHE_FACTORY_ADDRESS` from deployment output
- [ ] Update `.env` with new address: `AVALANCHE_FACTORY_ADDRESS=0x...`
- [ ] Verify on Snowtrace: https://testnet.snowtrace.io/address/0x...

## Backend Deployment

### Build and Test

```bash
cd backend
pnpm install
pnpm build
pnpm test
```

- [ ] No TypeScript errors
- [ ] All unit tests pass
- [ ] All e2e tests pass

### Run Backend

```bash
# With docker-compose
docker-compose up -d backend

# Or manually
cd backend
pnpm start:dev
```

- [ ] Backend starts without errors
- [ ] Check logs for initialization messages
- [ ] `/health` endpoint responds with 200

### Verify Configuration

```bash
# Check that factory addresses are loaded
curl -X GET http://localhost:3000/health
```

- [ ] Response includes factory addresses in logs
- [ ] No "factory addresses not configured" errors

## Frontend Deployment

### Build

```bash
cd frontend
pnpm install
pnpm build
pnpm check
```

- [ ] No TypeScript errors
- [ ] Build completes successfully
- [ ] Type checking passes

### Test Fund Forwarding

1. **User Setup**:
   - [ ] Create test user account
   - [ ] Generate or restore master wallet
   - [ ] Create test company
   - [ ] Verify child wallet created with unique address

2. **Bounty Creation**:
   - [ ] Create new bounty for company
   - [ ] Select blockchain (Ethereum or Avalanche)
   - [ ] Set target amount (test with small amount)
   - [ ] Confirm contract deployment

3. **Verify Master Wallet Forwarding**:
   - [ ] Check blockchain explorer for deployed contract
   - [ ] Verify contract has master wallet address stored
   - [ ] Make test contribution
   - [ ] Check that contract shows master wallet as recipient

## Testing Scenarios

### Scenario 1: Successful Campaign

- [ ] Create bounty with $10 target
- [ ] Contribute $15 worth of ETH/AVAX
- [ ] Campaign completes
- [ ] Master wallet receives funds (minus gas)
- [ ] Verify transaction on blockchain explorer

### Scenario 2: Failed Campaign

- [ ] Create bounty with $1000 target
- [ ] Contribute $10 worth of ETH/AVAX
- [ ] Wait for deadline to pass
- [ ] Claim refund
- [ ] Receive refund in contributor wallet (minus gas fee)
- [ ] Verify master wallet did NOT receive funds

### Scenario 3: Multiple Companies

- [ ] Create 2 test companies
- [ ] Create bounty on Company A
- [ ] Create bounty on Company B
- [ ] Fund both bounties
- [ ] Verify both fund transfers go to same master wallet
- [ ] Check master wallet balance shows sum of both

## Database Verification

### Check User Wallet Configuration

```sql
SELECT 
  u.id, 
  u.email, 
  uw.ethAddress, 
  uw.avaxAddress,
  uw.encryptedMnemonic IS NOT NULL as hasMnemonic
FROM users u
LEFT JOIN user_wallets uw ON u.id = uw.userId
WHERE u.id = '[test-user-id]';
```

- [ ] User has `userWallet` record
- [ ] `ethAddress` and/or `avaxAddress` are populated
- [ ] Mnemonic is encrypted (not NULL)

### Check Escrow Deployment Records

```sql
SELECT 
  ed.id,
  ed.contractAddress,
  ed.chain,
  ed.targetAmountEth,
  ed.status,
  ed.deployedAt
FROM escrow_deployments ed
WHERE ed.wishlistItemId = '[test-bounty-id]'
ORDER BY ed.deployedAt DESC;
```

- [ ] Record created for each chain
- [ ] `contractAddress` is populated
- [ ] Status is 'active'

## Rollback Plan

If issues occur:

1. **Revert Smart Contracts**:
   ```bash
   cd hardhat
   git checkout HEAD -- contracts/
   npx hardhat run scripts/deploy-factory.ts --network sepolia
   ```

2. **Revert Backend**:
   ```bash
   cd backend
   git checkout HEAD -- src/web3/
   pnpm build
   ```

3. **Revert .env**:
   - Restore old `ETHEREUM_FACTORY_ADDRESS` and `AVALANCHE_FACTORY_ADDRESS`

4. **Restart Services**:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

## Post-Deployment Monitoring

### Logs to Monitor

```bash
# Backend logs
docker-compose logs -f backend | grep -E "Deploying escrow|Master Wallet|Fund forwarding"
```

- [ ] Verify fund forwarding messages appear on new bounty creation
- [ ] Check master wallet addresses are correctly logged

### Metrics to Track

- [ ] New bounties deploy successfully
- [ ] Escrow contracts created on correct chains
- [ ] Fund transfers occur to master wallet on campaign success
- [ ] No errors in escrow deployment logs

### User Testing

- [ ] Existing users can still create bounties (backward compatible)
- [ ] New bounties automatically use master wallet
- [ ] Users see master wallet address in UI (if implemented)
- [ ] Support team reports no new issues

## Documentation Updates

- [ ] Update `/README.md` with master wallet fund forwarding section
- [ ] Update `/backend/README.md` API docs with new master wallet parameter
- [ ] Update `/frontend/README.md` with UI changes (if any)
- [ ] Add this checklist to deployment runbooks

## Success Criteria

✅ **Deployment is successful when:**

1. New escrow contracts deploy with master wallet parameter
2. Funds from successful bounties go to master wallet
3. Failed bounties refund to contributors (not master wallet)
4. All existing functionality continues to work
5. No errors in logs related to master wallet
6. Multiple test users can create bounties without issues
7. Blockchain transactions verify correct fund forwarding

## Rollback Decision Matrix

| Issue | Severity | Action |
|-------|----------|--------|
| New bounties won't deploy | Critical | Immediate rollback |
| Wrong wallet receives funds | Critical | Immediate rollback |
| Fund forwarding fails silently | High | Rollback, investigate |
| UI display issues | Medium | Fix in patch, no rollback |
| Documentation incomplete | Low | Update docs, no rollback |

## Contact

For issues during deployment:
- Check logs: `docker-compose logs -f backend`
- Review `/docs/MASTER_WALLET_FUND_FORWARDING.md`
- Check smart contract addresses in `.env`
- Verify user has master wallet configured
