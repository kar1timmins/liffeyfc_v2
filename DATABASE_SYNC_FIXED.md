# Database Synchronization Fixed ✅

## Summary
Fixed critical issues preventing database schema synchronization and backend startup. The application is now fully operational with all services running (PostgreSQL, Redis, Backend, Frontend).

## Issues Resolved

### 1. **SQL Syntax Error in UserWallet Entity** ❌→✅
**Problem:** PostgreSQL rejected CREATE TABLE statement with `syntax error at or near "'/0'"`

**Root Cause:** TypeORM was generating invalid SQL from the default value in the `derivationPath` column:
```typescript
// WRONG - Generated: DEFAULT 'm/44'/60'/0'/0/0'
// PostgreSQL interprets single quotes as string terminators → syntax error
@Column({ type: 'varchar', default: "m/44'/60'/0'/0/0" })
derivationPath: string;
```

**Solution:** Removed the problematic database default value:
```typescript
// CORRECT - Application explicitly sets this value when creating wallets
@Column({ type: 'varchar' })
derivationPath: string;
```

**Why It Works:** The `WalletGenerationService.generateMasterWallet()` method already explicitly sets `derivationPath` when creating UserWallet records:
```typescript
const userWallet = this.userWalletRepo.create({
  // ... other fields
  derivationPath: `${this.ETH_DERIVATION_BASE}/0`, // Set by application
  nextChildIndex: 0,
});
```

### 2. **Missing WALLET_ENCRYPTION_KEY Environment Variable** ❌→✅
**Problem:** Backend threw error: `WALLET_ENCRYPTION_KEY must be set and be 64 hex characters (32 bytes)`

**Root Cause:** The key was not being passed to the backend container via docker-compose.

**Solution:** 
- Added `WALLET_ENCRYPTION_KEY=${WALLET_ENCRYPTION_KEY}` to docker-compose.yml backend environment
- Generated proper 64-character hex key: `88478f11364a7758ef2d6069a7dcdbabf4232f6b395786c50d82a4d3086c3274`
- Updated `.env` file with the proper key
- Key properly validated: 64 hex characters = 32 bytes for AES-256 encryption

### 3. **Incomplete Environment Configuration** ❌→✅
**Problem:** Several required environment variables were missing from docker-compose configuration

**Solution:** Added to docker-compose.yml backend environment section:
- `JWT_REFRESH_SECRET` - For refresh token signing
- `JWT_REFRESH_EXPIRES_IN` - Refresh token expiration (30d)
- `RESEND_API_KEY` - Email service API key
- `EMAIL_FROM` - From address for transactional emails

## Verification

### Database Schema Created Successfully ✅
```
 Schema |      Name       | Type  |  Owner   
--------+-----------------+-------+----------
 public | companies       | table | lfc_user
 public | company_wallets | table | lfc_user
 public | refresh_tokens  | table | lfc_user
 public | user_wallets    | table | lfc_user
 public | users           | table | lfc_user
 public | wallets         | table | lfc_user
 public | wishlist_items  | table | lfc_user
```

### Backend Health Check ✅
```bash
$ curl http://localhost:3000/health
{"status":"ok","timestamp":"2025-12-07T00:17:09.949Z","database":"connected","redis":"connected"}
```

### Services Running ✅
- **Backend**: Running on port 3000 ✅
- **Frontend**: Running on port 5173 ✅
- **PostgreSQL**: Database connected ✅
- **Redis**: Connected for nonce storage ✅

## Files Modified
1. `backend/src/entities/user-wallet.entity.ts` - Removed problematic default value
2. `docker-compose.yml` - Added missing environment variables
3. `.env` - Updated with proper wallet encryption key

## Environment Variable Reference

### Critical Variables for Development
```bash
# Database (Docker Compose)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=lfc_user
POSTGRES_PASSWORD=lfc_pass
POSTGRES_DB=lfc_db
DATABASE_URL=postgres://lfc_user:lfc_pass@postgres:5432/lfc_db

# Authentication
JWT_SECRET=70cc294ebf8f93d4006da6d18001acd524ffc6dca090b0f77deadcb2325277f4
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=a7f3e9d1c5b8a2f6e4c7d1a5f9b2e6c1a4d8f2b6e9c3a7d1e5f8b2c6a9d3e
JWT_REFRESH_EXPIRES_IN=30d

# Web3 & Wallet (64-character hex = 32 bytes)
WALLET_ENCRYPTION_KEY=88478f11364a7758ef2d6069a7dcdbabf4232f6b395786c50d82a4d3086c3274

# Cache
REDIS_URL=redis://redis:6379

# Email
RESEND_API_KEY=your_resend_api_key_here
EMAIL_FROM=noreply@liffeyfoundersclub.com
```

## How to Generate New Keys

### New Wallet Encryption Key (64-char hex)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### New JWT Secrets
```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT Refresh Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Testing the Fix

### Start Services
```bash
docker compose down && docker compose up -d
```

### Wait for Startup (15-20 seconds)
```bash
sleep 15 && docker compose logs backend | tail -50
```

### Verify Database
```bash
docker compose exec -T postgres psql -U lfc_user -d lfc_db -c "\dt"
```

### Test Health Endpoint
```bash
curl http://localhost:3000/health
```

### Expected Output
```json
{
  "status": "ok",
  "timestamp": "2025-12-07T00:17:09.949Z",
  "database": "connected",
  "redis": "connected"
}
```

## Lessons Learned

1. **SQL Special Characters in TypeORM**: Default values with single quotes must not be used directly as TypeORM generates raw SQL. Let the application set these values instead.

2. **Environment Variable Length Validation**: Wallet encryption keys require exactly 64 hex characters (32 bytes). A 62-character string will fail validation.

3. **Docker Environment Resolution**: Use `docker compose config` to verify that environment variables are properly resolved from `.env` before deployment.

4. **Database-Level Defaults vs Application Defaults**: For complex default values with special characters, prefer application-level defaults set in the service layer over database constraints.

## Next Steps

- ✅ Database schema synchronized
- ✅ Backend API running
- ✅ Frontend dev server running
- ⏭️ Test complete user workflows (registration, login, wallet generation)
- ⏭️ Verify email notifications via Resend
- ⏭️ Test Web3 wallet integration
- ⏭️ Test wishlist functionality

---
**Status**: ✅ All critical issues resolved. Full stack operational.
