# Railway Multi-Service Setup Guide

## Current Issue
The `liffeyfc_form` service is deploying the email server instead of the NestJS backend because Railway doesn't know which directory to use.

## Solution 1: Reconfigure Existing Service (Recommended)

### Steps:
1. Go to: https://railway.app/project/d6533798-7ff1-49fd-ab0a-83ba7a69ebe0
2. Click on **liffeyfc_form** service
3. Click **Settings** → **Source**
4. Set **Root Directory** to: `backend`
5. Save and trigger new deployment

This will:
- ✅ Deploy NestJS backend from `/backend` directory
- ✅ Run migrations automatically on startup
- ✅ Create database tables
- ✅ Use the correct `railway.json` configuration

## Solution 2: Create Two Separate Services

If you want BOTH email server AND backend running:

### Backend Service:
1. Go to project dashboard
2. Click **+ New Service**
3. Select **GitHub Repo** → `kar1timmins/liffeyfc_v2`
4. Set **Root Directory**: `backend`
5. Set **Service Name**: `backend` or `api`
6. Link environment variables:
   - DATABASE_URL → `${{Postgres.DATABASE_URL}}`
   - REDIS_URL → `${{Redis.REDIS_URL}}`
   - Copy all other vars from existing service

### Email Server Service:
1. Click **+ New Service**
2. Select **GitHub Repo** → `kar1timmins/liffeyfc_v2`
3. Set **Root Directory**: `email-server`
4. Set **Service Name**: `email-server`
5. Add SMTP environment variables

## Verification After Deployment

### 1. Check Deployment Logs
```bash
railway logs
```

Should show:
```
Running migrations...
Migration {timestamp}-initial completed
Server started on port 3000
```

### 2. Verify Database Tables
```bash
# Connect to Railway Postgres
railway run psql $DATABASE_URL

# List tables
\dt

# Should show:
# - user
# - wallet
# - refresh_token
# - typeorm_migrations
```

### 3. Test Health Endpoint
```bash
curl https://your-service.railway.app/health
# Should return: {"status":"ok"}
```

### 4. Test Database Connection
```bash
curl https://your-service.railway.app/
# Should return API info
```

## Common Issues

### "Initializing" Stuck
**Cause**: Build is failing silently or wrong directory
**Fix**: 
1. Check Railway logs for build errors
2. Verify Root Directory is set to `backend`
3. Check that `pnpm-lock.yaml` exists in backend/

### No Database Tables
**Cause**: Migrations not running
**Fix**:
1. Verify Start Command includes: `pnpm run migration:run && node dist/main.js`
2. Check DATABASE_URL is set correctly
3. Check migration files exist in `backend/src/migrations/`

### Build Fails
**Cause**: Missing dependencies or wrong Node version
**Fix**:
1. Add `nixpacks.toml` in backend/ with Node version
2. Verify all dependencies in `package.json`
3. Check build command matches local build

## Current Service Configuration

**Project ID**: d6533798-7ff1-49fd-ab0a-83ba7a69ebe0
**Environment**: production

**Existing Services**:
- `liffeyfc_form` - Currently deploying email server (needs reconfiguration)
- `Postgres` - Database
- `Redis` - Cache

**Target Configuration**:
- `liffeyfc_form` → Backend (NestJS) from `/backend`
- OR create new `backend` + `email-server` services

## Next Steps

1. ✅ Choose Solution 1 or Solution 2
2. ✅ Configure service(s) via Railway dashboard
3. ✅ Trigger deployment (auto or manual)
4. ✅ Monitor logs: `railway logs`
5. ✅ Verify database tables created
6. ✅ Test endpoints
