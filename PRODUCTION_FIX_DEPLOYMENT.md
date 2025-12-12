# Production Deployment Fix - Entity Registration

## Problem
```
TypeORMError: Entity metadata for WishlistItem#escrowDeployments was not found.
Check if you specified a correct entity object and if it's connected in the connection options.
```

## Root Cause
The glob pattern `entities: [__dirname + '/**/*.entity.{ts,js}']` was unreliable in production. The new entities (`EscrowDeployment` and `Contribution`) weren't being discovered by TypeORM's entity scanner.

## Solution Applied
✅ Created `backend/src/entities/index.ts` to explicitly export all entities  
✅ Updated `app.module.ts` to use `entities: Object.values(entities)` instead of glob pattern  
✅ Committed changes (commit: 0460534)

## Deployment Steps

### 1. Push to Repository
```bash
git push origin main
```

### 2. Railway/Production Platform Steps
The platform should automatically:
- Pull latest code
- Run `pnpm install` (if package.json changed)
- Run `pnpm build` (compiles TypeScript → JavaScript)
- Run database migration: `pnpm run migration:run`
- Restart application

### 3. Manual Deployment (if needed)
If auto-deploy is disabled, manually trigger:

**Railway:**
```bash
# Via Railway CLI
railway up

# Or trigger via web UI
# Go to project → Deployments → Deploy Now
```

**Other platforms:**
```bash
# SSH into server
cd /app  # or your app directory
git pull origin main
pnpm install
pnpm build
pnpm run migration:run  # IMPORTANT: Run migration first!
pm2 restart liffeyfc-backend  # or your process manager
```

### 4. Verify Deployment
```bash
# Check logs for successful startup
railway logs  # Railway
# or
pm2 logs  # PM2
# or check platform logs

# Look for:
# ✅ "Nest application successfully started"
# ✅ No TypeORM errors
# ✅ Migration completed (if running for first time)
```

### 5. Test Application
1. Visit production URL
2. Navigate to a company page
3. Try creating a wishlist item with escrow enabled
4. Verify contract deployment works
5. Check database for `escrow_deployments` and `contributions` tables

## Migration Status
**IMPORTANT**: The migration `1734000000000-add-escrow-tracking-tables.ts` must be run in production.

Check if migration was run:
```sql
SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 5;
```

If migration not found, run manually:
```bash
cd backend
pnpm run migration:run
```

## Rollback Plan (if deployment fails)
```bash
# Revert to previous commit
git revert 0460534
git push origin main

# Or rollback deployment in Railway
railway rollback
```

## Expected Results After Fix
✅ Application starts without TypeORM errors  
✅ New entities (EscrowDeployment, Contribution) properly registered  
✅ WishlistItem relations work correctly  
✅ Bounties API endpoints return data  
✅ Escrow deployment and contribution tracking functional  

## Monitoring
Watch logs for first 5-10 minutes after deployment:
- No TypeORM metadata errors
- Database connections successful
- API requests complete without 500 errors
- Bounties endpoints return data

## Files Changed
- ✅ `backend/src/entities/index.ts` (NEW) - Explicit entity exports
- ✅ `backend/src/app.module.ts` (MODIFIED) - Use explicit entity array

## Why This Fixes The Issue
**Before:**
```typescript
entities: [__dirname + '/**/*.entity.{ts,js}']  // Glob pattern - unreliable
```
- TypeORM scans filesystem for matching files
- Can fail in production if build structure differs
- New files might not be discovered

**After:**
```typescript
import * as entities from './entities';
// ...
entities: Object.values(entities)  // Explicit imports
```
- All entities explicitly imported
- TypeScript/build system ensures they exist
- No runtime filesystem scanning
- Guaranteed to include all entities

## Next Deploy Checklist
- [ ] Push code to repository
- [ ] Wait for auto-deploy or manually trigger
- [ ] Verify migration ran: `SELECT * FROM migrations;`
- [ ] Check logs for errors
- [ ] Test wishlist creation with escrow
- [ ] Monitor for 5-10 minutes
- [ ] Check database tables exist: `\dt escrow*` and `\dt contribution*`
