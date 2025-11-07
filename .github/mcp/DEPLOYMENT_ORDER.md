# Railway Deployment - Correct Order of Operations

> **TL;DR**: Deploy services FIRST, then set environment variables, then add databases.

## The Problem

If you try to set environment variables before deploying services, you'll get:
```
Service 'backend' not found
```

This is because Railway services don't exist until you deploy them for the first time.

## Correct Deployment Order

### Step 1: Login & Link Project ✅
```bash
# Install Railway CLI (if not already installed)
npm install -g @railway/cli

# Login
railway login

# Link to existing project OR create new one
railway link
# or
railway init
```

### Step 2: Deploy Services First 🚀
```bash
# Deploy backend (this creates the 'backend' service)
cd backend
railway up

# The service name will be auto-generated or you can specify it
# Railway will now recognize this service
```

```bash
# Deploy email server (creates 'email-server' service)
cd ../email-server
railway up
```

**Important**: After deployment, check the service names:
```bash
railway service list
```

### Step 3: Add Databases 🗄️
```bash
# Add PostgreSQL (auto-creates DATABASE_URL variable)
railway add --database postgres

# Add Redis (auto-creates REDIS_URL variable)
railway add --database redis
```

These will automatically create and link the `DATABASE_URL` and `REDIS_URL` environment variables to your services.

### Step 4: Set Environment Variables 🔐
Now that services exist, you can set variables:

```bash
# Use the EXACT service name from 'railway service list'
# Common names: backend, liffeyfc-backend, backend-production, etc.

# Set backend variables
railway variables --set "JWT_SECRET=your-secret-here" --service backend
railway variables --set "NODE_ENV=production" --service backend
railway variables --set "RECAPTCHA_SECRET_KEY=your-key" --service backend
railway variables --set "WEB3FORMS_ACCESS_KEY=your-key" --service backend
railway variables --set "TYPEORM_SYNCHRONIZE=false" --service backend

# Reference database URLs (Railway auto-links these)
railway variables --set "DATABASE_URL=\${{Postgres.DATABASE_URL}}" --service backend
railway variables --set "REDIS_URL=\${{Redis.REDIS_URL}}" --service backend
```

```bash
# Set email server variables
railway variables --set "SMTP_HOST=smtp.zoho.com" --service email-server
railway variables --set "SMTP_PORT=465" --service email-server
railway variables --set "SMTP_USER=your-email" --service email-server
railway variables --set "SMTP_PASSWORD=your-password" --service email-server
railway variables --set "FROM_EMAIL=your-email" --service email-server
```

### Step 5: Restart Services (if needed) 🔄
```bash
# Restart to pick up new environment variables
railway service restart backend
railway service restart email-server
```

### Step 6: Verify Deployment ✅
```bash
# Check all services are running
railway status

# View logs
railway logs --service backend --tail 50

# Test backend health
curl https://your-backend-url.railway.app/health
```

## Complete Example Flow

```bash
# 1. Setup
npm install -g @railway/cli
railway login
cd /path/to/liffeyfc_v2
railway init

# 2. Deploy services
cd backend
railway up
# Note the service name from output (e.g., "backend" or "liffeyfc-backend")

cd ../email-server
railway up
# Note the service name from output

# 3. Check service names
cd ..
railway service list
# Output example:
# - backend
# - email-server

# 4. Add databases
railway add --database postgres
railway add --database redis

# 5. Set variables (use actual service names from step 3)
railway variables --set "JWT_SECRET=$(openssl rand -hex 32)" --service backend
railway variables --set "NODE_ENV=production" --service backend
railway variables --set "RECAPTCHA_SECRET_KEY=your-key" --service backend
railway variables --set "WEB3FORMS_ACCESS_KEY=your-key" --service backend
railway variables --set "TYPEORM_SYNCHRONIZE=false" --service backend

railway variables --set "SMTP_HOST=smtp.zoho.com" --service email-server
railway variables --set "SMTP_PORT=465" --service email-server
railway variables --set "SMTP_USER=noreply@liffeyfc.com" --service email-server
railway variables --set "SMTP_PASSWORD=your-password" --service email-server
railway variables --set "FROM_EMAIL=noreply@liffeyfc.com" --service email-server

# 6. Verify
railway status
railway logs --service backend
```

## Common Mistakes & Solutions

### ❌ Mistake 1: Setting variables before deploying
```bash
railway variables --set "JWT_SECRET=secret" --service backend
# Error: Service 'backend' not found
```

**Solution**: Deploy first, then set variables.

### ❌ Mistake 2: Wrong service name
```bash
railway variables --set "KEY=value" --service backend
# Error: Service 'backend' not found
```

**Solution**: Check exact service name:
```bash
railway service list
# Use the exact name shown
```

### ❌ Mistake 3: Not linking to project
```bash
railway up
# Error: No project linked
```

**Solution**: Link first:
```bash
railway link
# or
railway init
```

### ❌ Mistake 4: Forgetting to restart after setting variables
Variables are set but service doesn't pick them up.

**Solution**: Restart service:
```bash
railway service restart backend
```

## Using the Setup Script

The `railway-setup.sh` script now handles this correctly:

```bash
./.github/mcp/railway-setup.sh
```

It will:
1. ✅ Check Railway CLI
2. ✅ Login/authenticate
3. ✅ Link/create project
4. ✅ Guide you to deploy services FIRST
5. ✅ Then help set environment variables
6. ✅ Then add databases

## Alternative: Use Railway Dashboard

If you prefer a GUI:

1. Go to [railway.app](https://railway.app)
2. Create new project
3. Deploy from GitHub (select your repo)
4. Add services (backend, email-server)
5. Add databases (PostgreSQL, Redis)
6. Set environment variables in the dashboard
7. Redeploy

## Service Naming

Railway generates service names based on:
- Your directory name (e.g., `backend` → service name `backend`)
- Your repository name (e.g., `liffeyfc_v2` → `liffeyfc-v2`)
- Manual naming during deployment

Always check with `railway service list` to see the actual names.

## Environment Variable References

When you add databases, Railway automatically creates these variables:
- PostgreSQL: `Postgres.DATABASE_URL`
- Redis: `Redis.REDIS_URL`
- MySQL: `MySQL.DATABASE_URL`

Reference them in your services:
```bash
railway variables --set "DATABASE_URL=\${{Postgres.DATABASE_URL}}" --service backend
```

## Quick Checklist

- [ ] Railway CLI installed (`railway --version`)
- [ ] Logged in (`railway login`)
- [ ] Project linked (`railway link` or `railway init`)
- [ ] Backend deployed (`cd backend && railway up`)
- [ ] Email server deployed (`cd email-server && railway up`)
- [ ] Service names noted (`railway service list`)
- [ ] Databases added (`railway add --database postgres/redis`)
- [ ] Variables set with correct service names
- [ ] Services restarted (`railway service restart <name>`)
- [ ] Deployment verified (`railway status` and `railway logs`)

## Getting Help

If you encounter issues:

1. **Check service names**: `railway service list`
2. **View logs**: `railway logs --service <name>`
3. **Check status**: `railway status`
4. **View variables**: `railway variables`
5. **Check CLI help**: `railway --help`
6. **Read docs**: [docs.railway.app](https://docs.railway.app)

## Next Steps

After successful deployment:
- [ ] Set up custom domains
- [ ] Configure CI/CD (GitHub Actions)
- [ ] Set up monitoring and alerts
- [ ] Test all endpoints
- [ ] Run database migrations
- [ ] Set up backups

---

**Pro Tip**: Save your service names in a local file for reference:
```bash
railway service list > .railway-services.txt
```

**Remember**: Services first, variables second, databases third! 🚀
