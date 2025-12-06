# Environment Setup Guide

This guide explains how to set up environment variables for **development** and **production** environments.

## Table of Contents
- [Quick Start (Development)](#quick-start-development)
- [Frontend Environment Variables](#frontend-environment-variables)
- [Backend Environment Variables](#backend-environment-variables)
- [Docker Compose Setup](#docker-compose-setup)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## Quick Start (Development)

### Prerequisites
- Node.js 18+ with pnpm
- PostgreSQL 15 (or Docker)
- Redis 7 (or Docker)

### Local Development (No Docker)

**Backend Setup:**
```bash
cd backend

# Copy and update environment file
cp .env.example .env

# Edit .env with your actual values
nano .env  # or use your editor

# Install dependencies
pnpm install

# Run database migrations
pnpm run migration:run

# Start development server
pnpm start:dev
# Backend runs on http://localhost:3000
```

**Frontend Setup:**
```bash
cd frontend

# Copy and update environment file
cp .env.example .env.local

# Install dependencies
pnpm install

# Start development server
pnpm dev
# Frontend runs on http://localhost:5173
```

### Docker Compose Setup

```bash
# From project root
docker-compose up

# Or rebuild services
docker-compose up --build

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop services
docker-compose down
```

The `.env` file in the project root is automatically used by docker-compose for:
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `REDIS_URL`, `DATABASE_URL`
- Backend environment variables

---

## Frontend Environment Variables

### Development (`.env.local`)

| Variable | Value | Purpose |
|----------|-------|---------|
| `PUBLIC_RECAPTCHA_SITE_KEY` | Your reCAPTCHA v3 site key | Frontend form validation |
| `PUBLIC_DEBUG_LOGS` | `1` | Enable debug logging in browser console |
| `PUBLIC_APP_ENV` | `development` | Development environment flag |
| `PUBLIC_API_URL` | `http://localhost:3000` | Backend API URL (used as fallback) |
| `PUBLIC_FORM_API_URL` | `/api/interest/submit/` | Contact form endpoint |
| `RECAPTCHA_SECRET_KEY` | Your reCAPTCHA v3 secret | Server-side validation |
| `RESEND_API_KEY` | Your Resend API key | Email service |

### Production (Set in Railway/Hosting)

| Variable | Value | Purpose |
|----------|-------|---------|
| `PUBLIC_RECAPTCHA_SITE_KEY` | Production site key | Frontend form validation |
| `PUBLIC_DEBUG_LOGS` | `0` | Disable debug logging |
| `PUBLIC_APP_ENV` | `production` | Production environment flag |
| `PUBLIC_API_URL` | `https://your-backend-url.railway.app` | Backend API URL |
| `PUBLIC_FORM_API_URL` | `/api/interest/submit/` | Contact form endpoint |
| `RECAPTCHA_SECRET_KEY` | Production secret key | Server-side validation |
| `RESEND_API_KEY` | Your Resend API key | Email service |

**Note:** In development, Vite's dev server includes a proxy that routes API requests to the backend, so cross-origin requests are handled transparently.

---

## Backend Environment Variables

### Development (`.env`)

| Variable | Example | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Backend server port |
| `NODE_ENV` | `development` | Node.js environment |
| `APP_ENV` | `development` | Application environment (for logging) |
| `ENABLE_API_LOGS` | `1` | Enable request logging |
| `JWT_SECRET` | (64-char hex) | JWT signing key (REQUIRED) |
| `JWT_EXPIRES_IN` | `15m` | Access token expiry |
| `JWT_REFRESH_SECRET` | (64-char hex) | Refresh token key |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | Refresh token expiry |
| `RECAPTCHA_SECRET_KEY` | Your key | reCAPTCHA v3 verification |
| `RESEND_API_KEY` | `re_xxxx` | Resend email service |
| `EMAIL_FROM` | `noreply@liffeyfoundersclub.com` | Email sender address |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL (for emails) |
| `DATABASE_URL` | (Postgres URI) | Database connection string |
| `POSTGRES_HOST` | `localhost` | Postgres host |
| `POSTGRES_PORT` | `5432` | Postgres port |
| `POSTGRES_USER` | `lfc_user` | Database user |
| `POSTGRES_PASSWORD` | (your password) | Database password |
| `POSTGRES_DB` | `lfc_db` | Database name |
| `TYPEORM_SYNCHRONIZE` | `true` | Auto-sync schema (dev only) |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `GCP_PROJECT_ID` | Your GCP project ID | Google Cloud project |
| `GCP_BUCKET_NAME` | Your bucket name | GCS bucket for uploads |
| `GCP_KEY_FILENAME` | `lfc_key_gcp_bucket.json` | GCP credentials file (local dev) |

### Production (Set in Railway)

All variables from development, plus:

| Variable | Example | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `production` | Production environment |
| `APP_ENV` | `production` | Production flag |
| `ENABLE_API_LOGS` | `0` | Disable verbose logging |
| `TYPEORM_SYNCHRONIZE` | `false` | Don't auto-sync (use migrations) |
| `DATABASE_URL` | Railway DB URL | Production Postgres |
| `REDIS_URL` | Railway Redis URL | Production Redis |
| `FRONTEND_URL` | `https://liffeyfoundersclub.com` | Production frontend URL |
| `GCP_KEY_FILENAME` | (empty) | Use Application Default Credentials |

---

## Docker Compose Setup

### Environment File (`.env`)

The root `.env` file configures docker-compose services:

```dotenv
# PostgreSQL
POSTGRES_USER=lfc_user
POSTGRES_PASSWORD=lfc_password
POSTGRES_DB=lfc_db
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DATABASE_URL=postgres://lfc_user:lfc_password@postgres:5432/lfc_db
TYPEORM_SYNCHRONIZE=true

# Redis
REDIS_URL=redis://redis:6379

# Backend (inside container, use service names)
PORT=3000
NODE_ENV=development
JWT_SECRET=your_development_jwt_secret_64_chars
JWT_REFRESH_SECRET=your_development_refresh_secret_64_chars
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@liffeyfoundersclub.com
FRONTEND_URL=http://frontend:5173

# Frontend (inside container, use backend service name)
PUBLIC_API_URL=http://backend:3000
PUBLIC_APP_ENV=development
PUBLIC_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
PUBLIC_DEBUG_LOGS=1
```

### Startup Order
1. PostgreSQL starts (port 5433 on host)
2. Redis starts (port 6379 on host)
3. Backend starts (port 3000 inside container, 3000 on host)
4. Frontend starts (port 5173 inside container, 5173 on host)

### Common Issues

**Backend can't connect to Postgres:**
```bash
# Check if POSTGRES_HOST is set correctly in .env
# Should be "postgres" inside docker-compose, "localhost" for local dev
docker-compose logs postgres
```

**Frontend can't reach backend:**
```bash
# Inside container, use service name: http://backend:3000
# From host machine, use: http://localhost:3000
docker-compose logs frontend
```

---

## Production Deployment

### Railway Configuration

Set these environment variables in Railway dashboard:

**Frontend Variables:**
- Copy all `PUBLIC_*` variables
- Set `PUBLIC_APP_ENV=production`
- Set `PUBLIC_API_URL=https://your-backend-url.railway.app`

**Backend Variables:**
- `NODE_ENV=production`
- `APP_ENV=production`
- `TYPEORM_SYNCHRONIZE=false`
- Database and Redis URLs provided by Railway
- Generate new JWT secrets for production

### Database Migrations in Production

Railway automatically runs migrations during deployment if configured:

```json
{
  "build": {
    "builder": "nixpacks",
    "watchPathIgnore": ["dist_backup/**"]
  },
  "deploy": {
    "startCommand": "npm run migration:run && npm start"
  }
}
```

### Email Configuration for Production

**Resend Setup:**
1. Get API key from https://resend.com/api-keys
2. Set `RESEND_API_KEY` in production environment
3. Verify custom domain (liffeyfoundersclub.com) in Resend dashboard
4. Update `EMAIL_FROM` to use verified domain

---

## Troubleshooting

### "ERR_ACCESS_DENIED" on Login

**Cause:** CORS issue or backend not accessible

**Solution:**
1. Ensure backend is running on `http://localhost:3000`
2. Check `PUBLIC_API_URL` in frontend `.env.local`
3. Verify CORS is enabled in `backend/src/main.ts`
4. Check browser console for exact error message

```bash
# Test backend connectivity
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### Database Connection Errors

**Cause:** Database URL incorrect or service not running

**Solution:**
```bash
# For Docker Compose
docker-compose logs postgres

# For local development
psql -h localhost -U lfc_user -d lfc_db

# Check DATABASE_URL format
# postgres://user:password@host:port/database
```

### Redis Connection Errors

**Cause:** Redis not running or REDIS_URL incorrect

**Solution:**
```bash
# For Docker Compose
docker-compose logs redis

# For local development
redis-cli ping
# Should return: PONG

# Check REDIS_URL
# redis://localhost:6379 (local)
# redis://redis:6379 (docker-compose)
```

### Migration Errors

```bash
# Generate migration from entities
cd backend
pnpm run migration:generate -- src/migrations/description

# Run pending migrations
pnpm run migration:run

# Revert last migration
pnpm run migration:revert
```

---

## Environment-Specific Notes

### Development
- Auto-reload on file changes
- CORS relaxed for localhost
- Database auto-syncs from entities
- Verbose logging enabled
- Debug mode available in browser

### Production
- Static builds deployed to CDN
- CORS restricted to production domains
- Database migrations required (auto-sync disabled)
- Minimal logging
- Performance optimized

### Docker Compose
- Internal service communication via service names
- External access via localhost ports
- All services on isolated network
- Volume mounts for code changes

---

## Quick Reference Commands

```bash
# Frontend
cd frontend && pnpm dev              # Start dev server
cd frontend && pnpm build            # Build for production
cd frontend && pnpm preview          # Preview production build

# Backend
cd backend && pnpm start:dev         # Start dev server
cd backend && pnpm build             # Build for production
cd backend && pnpm test              # Run tests

# Database
cd backend && pnpm run migration:generate -- src/migrations/name
cd backend && pnpm run migration:run
cd backend && pnpm run migration:revert

# Docker Compose
docker-compose up                    # Start all services
docker-compose up --build            # Rebuild and start
docker-compose down                  # Stop all services
docker-compose logs -f backend       # View backend logs
docker-compose exec backend bash     # Access backend container

# Generate Secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

For more details, see:
- `/backend/README.md` - Backend API documentation
- `/frontend/README.md` - Frontend setup guide
- `/backend/.env.example` - Backend environment template
- `/frontend/.env.example` - Frontend environment template
