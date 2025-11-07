# Your Railway Project Configuration Summary

**Project**: liffeyfc_form  
**Environment**: production  
**Service**: liffeyfc_form  
**Domain**: https://liffeyfcform-production.up.railway.app  
**Date**: November 7, 2025

---

## ✅ Current Setup

### Railway Services
- ✅ **Main Service**: liffeyfc_form (currently deployed)
- ✅ **PostgreSQL**: Database (you mentioned this exists)
- ✅ **Redis**: Cache/Nonce storage (you mentioned this exists)

### Environment Variables Configured

#### Authentication & Security
- ✅ `JWT_SECRET` - Set for authentication tokens
- ✅ `JWT_EXPIRES_IN` - Set to 15 minutes
- ✅ `RECAPTCHA_SECRET_KEY` - Already configured
- ✅ `NODE_ENV` - Set to production
- ✅ `TYPEORM_SYNCHRONIZE` - Set to false (production safe)

#### Application URLs
- ✅ `FRONTEND_URL` - https://liffeyfoundersclub.com
- ✅ `ALLOWED_ORIGINS` - CORS configured for your domains
- ✅ `RAILWAY_PUBLIC_DOMAIN` - liffeyfcform-production.up.railway.app

#### Email Configuration (SMTP)
- ✅ `SMTP_HOST` - smtp.gmail.com
- ✅ `SMTP_PORT` - 587
- ✅ `SMTP_USER` - karltimmins@gmail.com
- ✅ `SMTP_PASS` - Configured
- ✅ `FROM_EMAIL` - info@liffeyfoundersclub.com
- ✅ `FROM_NAME` - Liffey Founders Club
- ✅ `ADMIN_EMAIL` - karl@liffeyfoundersclub.com
- ✅ `REPLY_TO_EMAIL` - info@liffeyfoundersclub.com

---

## 📋 Next Steps

### 1. Connect Database & Redis URLs

Since you have PostgreSQL and Redis services, you need to link them to your main service.

**In Railway Dashboard:**
1. Go to your project: https://railway.app/project/d6533798-7ff1-49fd-ab0a-83ba7a69ebe0
2. Find your PostgreSQL service
3. Copy the `DATABASE_URL` variable reference
4. Add to your `liffeyfc_form` service as:
   ```
   DATABASE_URL = ${{Postgres.DATABASE_URL}}
   ```
5. Repeat for Redis:
   ```
   REDIS_URL = ${{Redis.REDIS_URL}}
   ```

**Or via CLI** (once you know the exact service names):
```bash
# Check service names in dashboard first, they might be:
# - Postgres, PostgreSQL, or custom name
# - Redis, or custom name

# Then set:
railway variables --set "DATABASE_URL=\${{Postgres.DATABASE_URL}}"
railway variables --set "REDIS_URL=\${{Redis.REDIS_URL}}"
```

### 2. Add Missing Variable (Optional)

If you're using Web3Forms for additional form handling:
```bash
railway variables --set "WEB3FORMS_ACCESS_KEY=your_actual_key_here"
```

### 3. Deploy Updated Backend Code

Since your code is linked locally, you can deploy updates:

**Option A: Deploy from GitHub** (Recommended)
```bash
# Commit and push your changes
git add .
git commit -m "Update backend with full authentication and database support"
git push origin main

# Railway will auto-deploy if connected to GitHub
```

**Option B: Deploy from Local** (if not using GitHub integration)
```bash
# From backend directory
cd backend
railway up --service liffeyfc_form
```

### 4. Run Database Migrations

After deployment, run migrations to set up your database schema:
```bash
railway run -- pnpm run migration:run
```

Or if migrations are configured in your `railway.json` start command, they'll run automatically on deployment.

### 5. Verify Deployment

```bash
# Check logs
railway logs --follow

# Test health endpoint
curl https://liffeyfcform-production.up.railway.app/health

# Test API
curl https://liffeyfcform-production.up.railway.app/
```

---

## 🔍 Checking Database & Redis Services

To find your database and Redis service names:

### Method 1: Railway Dashboard
1. Open: https://railway.app/project/d6533798-7ff1-49fd-ab0a-83ba7a69ebe0
2. Look for services named Postgres/PostgreSQL and Redis
3. Click each service to see their variables
4. Copy the reference format (e.g., `${{Postgres.DATABASE_URL}}`)

### Method 2: Railway CLI
```bash
# The CLI might not list all services when linked to one service
# But you can switch services:
railway link  # Will show all services in the project
```

---

## 📊 Current Project Structure

```
Railway Project: liffeyfc_form
├── liffeyfc_form (Main Service) ✅
│   ├── Runtime: Node.js
│   ├── URL: liffeyfcform-production.up.railway.app
│   └── Env: Production variables (JWT, SMTP, etc.)
├── PostgreSQL ⚠️ (Need to link DATABASE_URL)
│   └── Provides: DATABASE_URL
└── Redis ⚠️ (Need to link REDIS_URL)
    └── Provides: REDIS_URL
```

---

## 🛠️ Useful Commands

```bash
# View current configuration
railway status

# View all variables
railway variables

# View logs in real-time
railway logs --follow

# Restart service
railway service restart

# Open Railway dashboard
railway open

# Run commands in Railway environment
railway run -- <command>

# Deploy (if not using GitHub)
railway up
```

---

## 🔐 Security Notes

### Secrets Already Secured ✅
- JWT_SECRET
- RECAPTCHA_SECRET_KEY  
- SMTP credentials

### Best Practices
- ✅ Using production environment
- ✅ TYPEORM_SYNCHRONIZE disabled
- ✅ CORS configured for specific domains
- ⚠️ Consider rotating SMTP_PASS regularly
- ⚠️ Consider using Railway's secret encryption for sensitive values

---

## 🚀 Deployment Workflow

### Current Setup (Manual)
1. Make code changes locally
2. Commit to git
3. Push to GitHub (if connected) OR
4. Run `railway up` to deploy directly

### Recommended Setup (GitHub Auto-deploy)
1. Connect Railway to your GitHub repository
2. Set root directory to `backend`
3. Every push to main branch auto-deploys
4. View deployment logs in Railway dashboard

---

## 📝 Railway Project URLs

- **Dashboard**: https://railway.app/project/d6533798-7ff1-49fd-ab0a-83ba7a69ebe0
- **Production URL**: https://liffeyfcform-production.up.railway.app
- **Environment**: production (ID: a58e747b-eae0-477c-8d18-893b0ec4455a)

---

## ✅ Completion Checklist

- [x] Linked local project to Railway
- [x] Set JWT authentication variables
- [x] Configured Node environment
- [x] Email/SMTP already configured
- [ ] Link DATABASE_URL from PostgreSQL service
- [ ] Link REDIS_URL from Redis service
- [ ] Deploy updated backend code
- [ ] Run database migrations
- [ ] Test all endpoints
- [ ] Verify authentication flow
- [ ] Test database connections
- [ ] Test Redis connections

---

## 🆘 Troubleshooting

### Can't see PostgreSQL/Redis services
**Solution**: Check Railway dashboard, they should appear as separate services in your project.

### DATABASE_URL not set
**Solution**: In Railway dashboard, go to liffeyfc_form service → Variables → Add → Reference the Postgres service variable.

### Deployment fails
**Solution**: Check logs with `railway logs` and ensure all required variables are set.

### Authentication not working
**Solution**: Verify JWT_SECRET is set and matches between frontend/backend.

---

## 📚 Documentation

- [Railway MCP Agent Docs](./.github/mcp/README.md)
- [Deployment Order Guide](./.github/mcp/DEPLOYMENT_ORDER.md)
- [Railway CLI Reference](./.github/mcp/RAILWAY_CLI_V4_SYNTAX.md)
- [Quick Reference](./.github/mcp/RAILWAY_QUICK_REF.md)

---

**Last Updated**: November 7, 2025  
**Next Review**: After linking database URLs and successful deployment
