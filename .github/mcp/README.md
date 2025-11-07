# Railway MCP Agent - README

## 🎯 Overview

The Railway MCP (Model Context Protocol) Agent provides intelligent automation for deploying and managing the Liffey Founders Club application on Railway. This agent streamlines deployment workflows, environment management, and monitoring.

## 📁 Files in This Directory

- **`railway-agent.json`** - MCP agent configuration with tools and workflows
- **`railway-agent.md`** - Comprehensive documentation and best practices
- **`railway-setup.sh`** - Automated setup script for initial configuration
- **`RAILWAY_QUICK_REF.md`** - Quick reference guide for common commands
- **`README.md`** - This file

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)
```bash
# Run the setup script
./.github/mcp/railway-setup.sh
```

This script will:
1. Install Railway CLI if needed
2. Authenticate with Railway
3. Link or create Railway project
4. Configure service settings
5. Set up database and Redis
6. Guide you through environment variable setup

### Option 2: Manual Setup
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Link to your project
railway link

# 4. Deploy backend
cd backend && railway up

# 5. Deploy email server
cd email-server && railway up
```

## 🛠️ MCP Agent Features

### Available Tools

#### Deployment & Management
- `railway_deploy_backend` - Deploy backend service
- `railway_deploy_email_server` - Deploy email server
- `railway_status` - Check deployment status
- `railway_logs` - View and follow service logs
- `railway_restart` - Restart services

#### Configuration
- `railway_set_env` - Set environment variables
- `railway_get_env` - View all environment variables
- `railway_domain` - Manage domains

#### Service Management
- `railway_list_services` - List all services
- `railway_create_service` - Create new service
- `railway_delete_service` - Delete service

### Pre-Configured Workflows

#### 1. Full Deployment
Deploys all services in the correct order with health checks.

#### 2. Backend Only
Quick deployment for backend-only changes.

#### 3. Setup Environment
Configures all required environment variables.

#### 4. Rollback
Safely rollback to previous deployment.

## 📋 Railway Project Structure

Your Railway project should include these services:

```
Railway Project: liffeyfc
├── Backend (NestJS)
│   ├── Port: 3000
│   ├── Health: /health
│   └── Env: JWT_SECRET, DATABASE_URL, REDIS_URL, etc.
├── Email Server (Node.js)
│   ├── Port: 3001
│   ├── Health: /health
│   └── Env: SMTP_*, FROM_EMAIL
├── PostgreSQL (Database)
│   └── Auto-configured DATABASE_URL
└── Redis (Cache/Nonce Storage)
    └── Auto-configured REDIS_URL
```

## 🔧 Configuration

### Backend Service (`backend/railway.json`)
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

**Key Features:**
- Runs database migrations automatically before start
- Health check endpoint for monitoring
- Automatic restart on failure (up to 10 retries)
- Extended timeout for migration execution

### Email Server (`email-server/railway.json`)
```json
{
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300
  }
}
```

## 🔐 Environment Variables

### Backend Required Variables
```bash
# Authentication & Security
JWT_SECRET=<strong-random-secret>
RECAPTCHA_SECRET_KEY=<your-recaptcha-secret>
WEB3FORMS_ACCESS_KEY=<your-web3forms-key>

# Database & Cache (Auto-set by Railway)
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# Configuration
NODE_ENV=production
TYPEORM_SYNCHRONIZE=false
PORT=3000

# Optional
CORS_ORIGIN=https://your-frontend.com
```

### Email Server Required Variables
```bash
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=noreply@liffeyfc.com
SMTP_PASSWORD=<your-smtp-password>
FROM_EMAIL=noreply@liffeyfc.com
```

## 📖 Usage Examples

### Deploy Backend
```bash
cd backend
railway up
railway logs --service backend --follow
```

### Update Environment Variable
```bash
railway variables --set "JWT_SECRET=new-secret" --service backend
railway service restart backend
```

### Run Database Migrations
```bash
cd backend
railway run -- pnpm run migration:run
```

### View Logs
```bash
# All services
railway logs

# Specific service
railway logs --service backend

# Follow in real-time
railway logs --service backend --follow

# Last 100 lines
railway logs --service backend --tail 100
```

### Check Service Health
```bash
railway status
curl https://your-backend.railway.app/health
```

## 🐛 Troubleshooting

### Build Failures
**Symptom:** Deployment fails during build
**Solution:**
1. Check `railway logs --service backend`
2. Verify `pnpm-lock.yaml` is committed
3. Ensure Node.js version matches local development
4. Check `railway.json` build command

### Database Connection Errors
**Symptom:** Backend can't connect to database
**Solution:**
```bash
# Check DATABASE_URL is set
railway variables | grep DATABASE_URL

# Test connection
railway run -- psql $DATABASE_URL -c "SELECT 1"

# Verify PostgreSQL service is running
railway status
```

### Redis Connection Errors
**Symptom:** Nonce service or cache failures
**Solution:**
```bash
# Check REDIS_URL is set
railway variables | grep REDIS_URL

# Test connection
railway run -- redis-cli -u $REDIS_URL ping

# Verify Redis service is running
railway status
```

### Migration Failures
**Symptom:** Migrations fail during deployment
**Solution:**
1. Run migrations manually: `railway run -- pnpm run migration:run`
2. Check migration files in `backend/src/migrations/`
3. Verify database schema compatibility
4. Review migration logs: `railway logs --service backend`

### Deployment Timeout
**Symptom:** Deployment times out during startup
**Solution:** Increase timeout in `railway.json`:
```json
{
  "deploy": {
    "healthcheckTimeout": 600
  }
}
```

## 📊 Monitoring

### Health Checks
The MCP agent monitors service health:
- **Backend**: `GET /health` every 60 seconds
- **Email Server**: `GET /health` every 60 seconds
- **Timeout**: 30 seconds per check

### Alerts
Configure alerts in Railway dashboard for:
- Deployment failures (Critical)
- Service crashes (Critical)
- High error rates (Warning)
- Database connection issues (Critical)

### Logs
Monitor logs for errors:
```bash
# Search for errors
railway logs --service backend | grep -i error

# Monitor in real-time
railway logs --service backend --follow | grep -i "error\|warn"
```

## 🔄 CI/CD Integration

### GitHub Actions Example
Create `.github/workflows/deploy-railway.yml`:
```yaml
name: Deploy to Railway

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install Railway CLI
        run: npm install -g @railway/cli
      
      - name: Deploy Backend
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: |
          cd backend
          railway up --service backend
      
      - name: Check Deployment
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: railway status

  deploy-email:
    runs-on: ubuntu-latest
    needs: deploy-backend
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Railway CLI
        run: npm install -g @railway/cli
      
      - name: Deploy Email Server
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: |
          cd email-server
          railway up --service email-server
```

## 🔒 Security Best Practices

### 1. Secrets Management
- Use Railway's encrypted variables for all secrets
- Rotate `JWT_SECRET` regularly (every 90 days)
- Never commit `.env` files to git
- Use different secrets for staging/production

### 2. Database Security
- Enable SSL for database connections
- Use strong passwords
- Regular backups (Railway automatic backups)
- Monitor query logs for suspicious activity

### 3. API Security
- Enable rate limiting (configured in backend)
- Use CORS restrictions
- Validate all inputs
- Keep dependencies updated

### 4. Monitoring
- Enable Railway webhooks for deployment notifications
- Set up uptime monitoring (UptimeRobot, Pingdom)
- Monitor error rates in logs
- Regular security audits

## 📚 Additional Resources

- **Detailed Documentation**: `.github/mcp/railway-agent.md`
- **Quick Reference**: `.github/mcp/RAILWAY_QUICK_REF.md`
- **Railway Documentation**: https://docs.railway.app
- **Railway CLI Reference**: https://docs.railway.app/develop/cli
- **Backend README**: `/backend/README.md`
- **Project Instructions**: `.github/instructions/lfc_project_instructions.instructions.md`

## 🆘 Support

### Getting Help
1. Check this documentation and quick reference
2. Review Railway logs: `railway logs`
3. Check Railway status: `railway status`
4. Visit Railway docs: https://docs.railway.app
5. Railway Discord: https://discord.gg/railway

### Common Commands Reference
```bash
# Quick deployment
railway up

# View status
railway status

# View logs
railway logs --service backend --follow

# Set variable
railway variables set KEY="value" --service backend

# Restart service
railway service restart backend

# Open Railway dashboard
railway open
```

---

**Last Updated**: November 7, 2025  
**Version**: 1.0.0  
**Maintainer**: Liffey Founders Club Team
