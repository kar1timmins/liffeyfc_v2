# Railway MCP Agent - Quick Reference

## 🚀 Quick Start

### 1. Setup (One-Time)
```bash
# Run automated setup script
./.github/mcp/railway-setup.sh
```

Or manually:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link
```

### 2. Deploy Services
```bash
# Deploy backend
cd backend && railway up

# Deploy email server
cd email-server && railway up
```

### 3. Manage Environment
```bash
# View all variables
railway variables

# Set a variable
railway variables set KEY="value" --service backend

# Link database
railway add --database postgres
```

## 🛠️ Common Commands

### Deployment
```bash
# Deploy current service
railway up

# Deploy specific service
railway up --service backend

# Check deployment status
railway status
```

### Logs & Debugging
```bash
# View logs (all services)
railway logs

# View specific service logs
railway logs --service backend

# Follow logs in real-time
railway logs --service backend --follow

# View last 100 lines
railway logs --service backend --tail 100
```

### Service Management
```bash
# List all services
railway service list

# Restart a service
railway service restart backend

# Delete a service
railway service delete old-service
```

### Environment Variables
```bash
# View all variables
railway variables

# Set variable for specific service
railway variables --set "JWT_SECRET=your-secret" --service backend

# Set multiple variables at once
railway variables --set "KEY1=value1" --set "KEY2=value2" --service backend
```

### Database & Redis
```bash
# Add PostgreSQL
railway add --database postgres

# Add Redis
railway add --database redis

# Connect to database
railway connect postgres

# Run command in service context
railway run -- pnpm run migration:run
```

### Domains
```bash
# Generate Railway domain
railway domain

# Add custom domain
railway domain add yourdomain.com --service backend
```

## 📋 MCP Agent Workflows

### Full Deployment
```bash
# Use MCP agent to run full deployment workflow
# This deploys all services in correct order
railway up --service backend && railway up --service email-server
```

### Backend Only
```bash
cd backend
pnpm install
pnpm build
railway up
railway logs --service backend
```

### Environment Setup
```bash
# Set all required environment variables
railway variables --set "NODE_ENV=production" --service backend
railway variables --set "JWT_SECRET=your-secret" --service backend
railway variables --set "DATABASE_URL=\${{Postgres.DATABASE_URL}}" --service backend
railway variables --set "REDIS_URL=\${{Redis.REDIS_URL}}" --service backend
railway variables --set "RECAPTCHA_SECRET_KEY=your-key" --service backend
railway variables --set "WEB3FORMS_ACCESS_KEY=your-key" --service backend
railway variables --set "TYPEORM_SYNCHRONIZE=false" --service backend
```

### Database Migrations
```bash
# Run migrations on Railway
cd backend
railway run -- pnpm run migration:run

# Generate new migration locally
pnpm run migration:generate -- src/migrations/my-migration

# Run migrations locally against Railway DB
railway run -- pnpm run migration:run
```

### Rollback
```bash
# View recent deployments
railway status

# Redeploy previous version
railway up --detach

# Or restart service to pick up changes
railway service restart backend
```

## 🔍 Monitoring & Health Checks

### Check Service Health
```bash
# Check if services are running
railway status

# View metrics (in Railway dashboard)
railway open

# Check specific endpoint
curl https://your-backend.railway.app/health
```

### View Logs for Errors
```bash
# Search logs for errors
railway logs --service backend | grep ERROR

# View recent errors
railway logs --service backend --tail 100 | grep -i error
```

## 🚨 Troubleshooting

### Build Failures
```bash
# View build logs
railway logs --service backend

# Common fixes:
# 1. Check pnpm-lock.yaml is committed
# 2. Verify Node.js version in package.json
# 3. Check railway.json build command
```

### Database Connection Issues
```bash
# Check DATABASE_URL is set
railway variables | grep DATABASE_URL

# Test connection
railway run -- psql $DATABASE_URL -c "SELECT 1"

# Check PostgreSQL service status
railway status
```

### Redis Connection Issues
```bash
# Check REDIS_URL is set
railway variables | grep REDIS_URL

# Test connection
railway run -- redis-cli -u $REDIS_URL ping
```

### Deployment Timeout
```bash
# Increase timeout in backend/railway.json:
{
  "deploy": {
    "healthcheckTimeout": 300
  }
}
```

## 📦 Service Configuration

### Backend (railway.json)
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install --frozen-lockfile && pnpm build"
  },
  "deploy": {
    "startCommand": "pnpm run migration:run && node dist/main.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300
  }
}
```

### Email Server (railway.json)
```json
{
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300
  }
}
```

## 🔐 Required Environment Variables

### Backend Service
- `JWT_SECRET` - Strong secret for JWT tokens
- `DATABASE_URL` - PostgreSQL connection string (auto-set)
- `REDIS_URL` - Redis connection string (auto-set)
- `RECAPTCHA_SECRET_KEY` - Google reCAPTCHA secret
- `WEB3FORMS_ACCESS_KEY` - Web3Forms API key
- `NODE_ENV` - Set to "production"
- `TYPEORM_SYNCHRONIZE` - Set to "false"

### Email Server Service
- `SMTP_HOST` - SMTP server (e.g., smtp.zoho.com)
- `SMTP_PORT` - SMTP port (465 or 587)
- `SMTP_USER` - Email address
- `SMTP_PASSWORD` - Email password
- `FROM_EMAIL` - Sender email address

## 📚 Resources

- **MCP Agent Docs**: `.github/mcp/railway-agent.md`
- **Railway Docs**: https://docs.railway.app
- **Railway CLI**: https://docs.railway.app/develop/cli
- **Project README**: `/backend/README.md`

## 💡 Tips

1. **Always run migrations**: Before deploying schema changes
2. **Monitor logs**: After every deployment
3. **Use staging**: Test in staging environment first
4. **Backup database**: Before major updates
5. **Keep secrets secure**: Use Railway's encrypted variables
6. **Set health checks**: For automatic restart on failures
7. **Use build cache**: Speeds up deployments
8. **Monitor costs**: Check Railway usage dashboard regularly

---

For detailed documentation, see `.github/mcp/railway-agent.md`
