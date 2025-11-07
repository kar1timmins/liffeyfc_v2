# Railway Multi-Service Setup: Backend + Email Server

## Current Architecture
```
┌─────────────────────────────────────────────────────────┐
│ Railway Project: liffeyfc_form                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │   Postgres   │    │    Redis     │                  │
│  │  (Database)  │    │   (Cache)    │                  │
│  └──────────────┘    └──────────────┘                  │
│         ▲                    ▲                          │
│         │                    │                          │
│         ├────────────────────┼──────────────────┐       │
│         │                    │                  │       │
│  ┌──────┴─────────┐   ┌─────┴────────┐  ┌──────┴─────┐ │
│  │ liffeyfc_form  │   │   backend    │  │            │ │
│  │ (Email Server) │   │ (NestJS API) │  │  (future)  │ │
│  │   port 8080    │   │  port 3000   │  │            │ │
│  └────────────────┘   └──────────────┘  └────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Setup Instructions

### Step 1: Create Backend Service via Railway Dashboard

1. **Go to your project**: https://railway.app/project/d6533798-7ff1-49fd-ab0a-83ba7a69ebe0

2. **Click "+ New"** button (top right) → **Service** → **GitHub Repo**

3. **Configure the new service**:
   - **Repository**: Select `Karlitoyo/liffeyfc_v2`
   - **Service Name**: `backend` or `api` (your choice)
   - **Root Directory**: `backend` ⚠️ **CRITICAL**
   - **Branch**: `main`

4. **Railway will auto-detect** the `nixpacks.toml` and `railway.json` configs

5. **Click "Deploy"** - Railway will start building

### Step 2: Configure Backend Environment Variables

Once the service is created, add these environment variables:

#### **Via Railway Dashboard** (Service → Variables):

**Required Variables:**
```bash
NODE_ENV=production
TYPEORM_SYNCHRONIZE=false

# JWT Configuration
JWT_SECRET=7b2a989f48a96936b8a1dbc68060b5cc9601f692d417a7adbfe58614eb2a204b
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend URL for CORS
FRONTEND_URL=https://liffeyfoundersclub.com

# reCAPTCHA
RECAPTCHA_SECRET_KEY=6LfLPNorAAAAAP0MpC3rtovBY6fuG8-HGue14ae8

# Google OAuth (if using)
GOOGLE_CLIENT_ID=${{liffeyfc_form.GOOGLE_CLIENT_ID}}
GOOGLE_CLIENT_SECRET=${{liffeyfc_form.GOOGLE_CLIENT_SECRET}}
GOOGLE_CALLBACK_URL=https://your-backend-url.railway.app/auth/google/callback
```

**Link to Database Services:**
```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
```

#### **Via Railway CLI** (from your terminal):

```bash
cd /home/karlitoyo/Development/liffeyfc/liffeyfc_v2/backend

# Link to the new backend service
railway link

# Set variables
railway variables --set "NODE_ENV=production"
railway variables --set "TYPEORM_SYNCHRONIZE=false"
railway variables --set "JWT_SECRET=7b2a989f48a96936b8a1dbc68060b5cc9601f692d417a7adbfe58614eb2a204b"
railway variables --set "JWT_EXPIRES_IN=15m"
railway variables --set "JWT_REFRESH_EXPIRES_IN=7d"
railway variables --set "FRONTEND_URL=https://liffeyfoundersclub.com"
railway variables --set "RECAPTCHA_SECRET_KEY=6LfLPNorAAAAAP0MpC3rtovBY6fuG8-HGue14ae8"

# Link database services using Railway's service reference syntax
railway variables --set "DATABASE_URL=\${{Postgres.DATABASE_URL}}"
railway variables --set "REDIS_URL=\${{Redis.REDIS_URL}}"
```

### Step 3: Verify Email Service Configuration

The email service (`liffeyfc_form`) should remain unchanged and continue running.

**Check current email service**:
```bash
# Link to email service
cd /home/karlitoyo/Development/liffeyfc/liffeyfc_v2/email-server
railway link -s liffeyfc_form

# Verify it's running
railway logs
```

**Email service should have**:
- Root Directory: `/email-server` OR root `/` (if it was set up that way)
- Start Command: `npm start` or `node server.js`
- Port: 8080
- SMTP configuration for Gmail

### Step 4: Monitor Deployment

Watch the backend deployment logs:

```bash
# From backend directory
cd /home/karlitoyo/Development/liffeyfc/liffeyfc_v2/backend
railway link  # Select the new 'backend' service
railway logs
```

**Expected output:**
```
[nixpacks] Installing nodejs_20, pnpm
[nixpacks] Running: pnpm install --frozen-lockfile
[nixpacks] Running: pnpm build
[nixpacks] Build completed successfully
[railway] Starting container
[app] Running migrations...
[app] Query: SELECT * FROM "typeorm_migrations"
[app] Migration 1762294178719-init completed
[app] Migrations complete
[app] [Nest] 1  - 11/07/2025, 12:00:00 AM     LOG [NestFactory] Starting Nest application...
[app] [Nest] 1  - 11/07/2025, 12:00:00 AM     LOG [InstanceLoader] AppModule dependencies initialized
[app] [Nest] 1  - 11/07/2025, 12:00:00 AM     LOG [RoutesResolver] AppController {/}:
[app] [Nest] 1  - 11/07/2025, 12:00:00 AM     LOG [NestApplication] Nest application successfully started
[app] Application is running on: http://0.0.0.0:3000
```

### Step 5: Test Endpoints

Once deployed, test your backend:

```bash
# Get your backend URL from Railway dashboard, then test:

# Health check
curl https://your-backend-url.railway.app/health
# Expected: {"status":"ok","database":"connected","redis":"connected"}

# API root
curl https://your-backend-url.railway.app/
# Expected: API info response

# Auth status
curl https://your-backend-url.railway.app/auth/status
# Expected: Authentication status
```

### Step 6: Verify Database Tables

Check that migrations created the tables:

```bash
# From backend directory
railway run -- pnpm run typeorm query "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"

# Or connect directly
railway run psql $DATABASE_URL
\dt
# Should show: user, wallet, refresh_token, typeorm_migrations
```

## Service Communication

### Backend → Database
- Uses: `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- Internal URL: `postgresql://postgres:***@postgres.railway.internal:5432/railway`

### Backend → Redis
- Uses: `REDIS_URL=${{Redis.REDIS_URL}}`
- Internal URL: `redis://default:***@redis.railway.internal:6379`

### Email Service (Independent)
- No database connection needed
- Receives HTTP requests
- Forwards emails via Gmail SMTP
- Port: 8080

### Frontend → Backend
- Will call backend API at public Railway URL
- CORS configured via `FRONTEND_URL` env var

### Frontend → Email Service
- Direct HTTP requests to email service public URL
- Independent from backend API

## Troubleshooting

### Backend stuck on "Initializing"
1. Check Railway logs for build errors
2. Verify Root Directory is set to `backend`
3. Confirm `nixpacks.toml` exists in backend/
4. Check DATABASE_URL and REDIS_URL are set

### Migrations failing
1. Verify DATABASE_URL format is correct
2. Check Postgres service is running
3. Ensure `data-source.ts` parses DATABASE_URL (already fixed)
4. Try manual migration: `railway run -- pnpm run migration:run`

### Email service stopped working
1. Ensure you didn't modify the `liffeyfc_form` service
2. Check SMTP credentials are still set
3. Verify Root Directory points to correct location

### Port conflicts
- Backend runs on port 3000 (Railway auto-detects)
- Email server runs on port 8080 (Railway auto-detects)
- No conflicts - different services, different containers

## Next Steps After Deployment

1. ✅ Both services running
2. ✅ Database tables created
3. ✅ Test backend endpoints
4. ✅ Test email service
5. 🔄 Update frontend to use backend API URL
6. 🔄 Configure custom domain (if needed)
7. 🔄 Set up monitoring/alerts

## CLI Quick Reference

```bash
# List all services in project
railway status

# Switch between services
railway link  # Interactive selector
railway link -s backend
railway link -s liffeyfc_form

# View logs
railway logs

# Run commands in service context
railway run -- pnpm run migration:run

# Set environment variables
railway variables --set "KEY=value"

# View all variables
railway variables --kv
```

## File Structure Summary

```
liffeyfc_v2/
├── backend/
│   ├── nixpacks.toml          # ✅ Tells Railway how to build
│   ├── railway.json           # ✅ Deployment config
│   ├── .railwayignore         # ✅ Excludes node_modules
│   ├── src/
│   │   ├── data-source.ts     # ✅ Parses DATABASE_URL
│   │   └── migrations/        # ✅ Database migrations
│   └── package.json
│
├── email-server/
│   ├── railway.json           # ✅ Email service config
│   ├── .railwayignore         # ✅ Excludes node_modules
│   └── server.js              # ✅ Email forwarding service
│
└── frontend/
    └── (SvelteKit static site - deployed separately)
```

## Summary

**Before**: Single service trying to run email server  
**After**: Two independent services sharing database/redis

**Email Service** (`liffeyfc_form`):
- Already running ✅
- Handles email forwarding ✅
- No database needed ✅

**Backend Service** (new):
- Deploy from `/backend` directory
- Runs NestJS API
- Uses Postgres + Redis
- Runs migrations automatically
- Handles authentication, user management, etc.

Both services are independent but can communicate via HTTP if needed.
