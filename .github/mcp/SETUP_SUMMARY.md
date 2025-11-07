# Railway MCP Agent Setup - Summary

## ✅ What Has Been Created

### 1. MCP Agent Configuration
**Location**: `.github/mcp/railway-agent.json`
- Complete MCP agent definition
- 15+ tools for Railway management
- 4 pre-configured workflows
- Health check monitoring
- Alert configuration

### 2. Documentation
**Location**: `.github/mcp/railway-agent.md`
- Comprehensive guide (40+ pages)
- Prerequisites and setup instructions
- Tool and workflow documentation
- Troubleshooting guide
- Security best practices
- CI/CD integration examples

### 3. Quick Reference
**Location**: `.github/mcp/RAILWAY_QUICK_REF.md`
- Common commands cheat sheet
- Quick troubleshooting guide
- Configuration examples
- Tips and best practices

### 4. Automated Setup Script
**Location**: `.github/mcp/railway-setup.sh`
- Interactive setup wizard
- Checks and installs Railway CLI
- Authenticates with Railway
- Creates/links Railway project
- Configures services
- Sets up environment variables
- Adds database and Redis

### 5. GitHub Actions Template
**Location**: `.github/workflows/deploy-railway.yml.template`
- Automated CI/CD pipeline
- Conditional deployments
- Health checks
- Deployment notifications
- Path-based triggers

### 6. Updated Service Configurations
**Backend** (`backend/railway.json`):
- Added automatic migration execution
- Health check endpoint
- Extended timeout for migrations
- Auto-restart on failure

**Email Server** (`email-server/railway.json`):
- Already configured with health checks

## 🎯 Key Features

### MCP Agent Tools
1. **Deployment**: `railway_deploy_backend`, `railway_deploy_email_server`
2. **Monitoring**: `railway_logs`, `railway_status`
3. **Configuration**: `railway_set_env`, `railway_get_env`
4. **Service Management**: `railway_list_services`, `railway_restart`
5. **Infrastructure**: `railway_domain`, `railway_link_project`

### Pre-Configured Workflows
1. **Full Deployment**: Deploy all services in order
2. **Backend Only**: Quick backend updates
3. **Setup Environment**: Configure all env vars
4. **Rollback**: Safe rollback procedure

### Monitoring & Health Checks
- **Backend**: Health check every 60s at `/health`
- **Email Server**: Health check every 60s at `/health`
- **Automatic Alerts**: Critical and warning level alerts
- **Log Monitoring**: Built-in error detection

## 📋 Next Steps

### 1. Initial Setup (Choose One Method)

#### Option A: Automated (Recommended)
```bash
# Run the setup script
./.github/mcp/railway-setup.sh
```

#### Option B: Manual
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy services
cd backend && railway up
cd ../email-server && railway up
```

### 2. Configure Environment Variables

**Required for Backend:**
```bash
railway variables --set "JWT_SECRET=your-strong-secret" --service backend
railway variables --set "RECAPTCHA_SECRET_KEY=your-key" --service backend
railway variables --set "WEB3FORMS_ACCESS_KEY=your-key" --service backend
railway variables --set "NODE_ENV=production" --service backend
railway variables --set "TYPEORM_SYNCHRONIZE=false" --service backend
```

**Required for Email Server:**
```bash
railway variables --set "SMTP_HOST=smtp.zoho.com" --service email-server
railway variables --set "SMTP_PORT=465" --service email-server
railway variables --set "SMTP_USER=noreply@liffeyfc.com" --service email-server
railway variables --set "SMTP_PASSWORD=your-password" --service email-server
railway variables --set "FROM_EMAIL=noreply@liffeyfc.com" --service email-server
```

### 3. Add Database & Redis
```bash
# Add PostgreSQL (creates DATABASE_URL automatically)
railway add --database postgres

# Add Redis (creates REDIS_URL automatically)
railway add --database redis
```

### 4. Deploy Services
```bash
# Deploy backend
cd backend
railway up

# Deploy email server
cd ../email-server
railway up

# Check status
railway status

# View logs
railway logs --follow
```

### 5. Set Up CI/CD (Optional)

1. **Get Railway Token:**
   ```bash
   railway login --browserless
   # Copy the token shown
   ```

2. **Add to GitHub Secrets:**
   - Go to repository settings > Secrets and variables > Actions
   - Add `RAILWAY_TOKEN` with your token

3. **Activate workflow:**
   ```bash
   # Rename template to active workflow
   mv .github/workflows/deploy-railway.yml.template .github/workflows/deploy-railway.yml
   
   # Commit and push
   git add .github/workflows/deploy-railway.yml
   git commit -m "Enable Railway CI/CD"
   git push
   ```

### 6. Verify Deployment

```bash
# Check all services are running
railway status

# Test backend health
curl https://your-backend.railway.app/health

# Test email server health  
curl https://your-email-server.railway.app/health

# View logs for errors
railway logs --service backend | grep -i error
```

### 7. Configure Custom Domain (Optional)

```bash
# Generate Railway domain
railway domain --service backend

# Or add custom domain
railway domain add api.liffeyfc.com --service backend
```

## 📊 Railway Project Architecture

After setup, your Railway project will have:

```
Liffey Founders Club (Railway Project)
│
├── Backend Service
│   ├── Type: NestJS Application
│   ├── Port: 3000
│   ├── Health: /health
│   ├── Auto-migrations: Yes
│   └── Variables: JWT_SECRET, RECAPTCHA_SECRET_KEY, etc.
│
├── Email Server Service  
│   ├── Type: Node.js/Express
│   ├── Port: 3001
│   ├── Health: /health
│   └── Variables: SMTP_*, FROM_EMAIL
│
├── PostgreSQL Database
│   ├── Type: Managed PostgreSQL 15
│   ├── Auto-backup: Yes
│   └── Exposes: DATABASE_URL
│
└── Redis Cache
    ├── Type: Managed Redis 7
    ├── Use: Nonce storage, caching
    └── Exposes: REDIS_URL
```

## 🔍 Testing the Setup

### 1. Test Backend API
```bash
# Health check
curl https://your-backend.railway.app/health

# Test authentication endpoint
curl https://your-backend.railway.app/auth/status

# Check database connection
railway run -- psql $DATABASE_URL -c "SELECT 1"
```

### 2. Test Email Server
```bash
# Health check
curl https://your-email-server.railway.app/health

# Test email sending (if endpoint exists)
curl -X POST https://your-email-server.railway.app/send \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test"}'
```

### 3. View Logs
```bash
# All services
railway logs

# Specific service, real-time
railway logs --service backend --follow

# Search for errors
railway logs --service backend | grep -i "error\|exception"
```

## 📚 Documentation Reference

| Document | Purpose | Location |
|----------|---------|----------|
| MCP Agent Config | Tool and workflow definitions | `.github/mcp/railway-agent.json` |
| Full Documentation | Complete guide and best practices | `.github/mcp/railway-agent.md` |
| Quick Reference | Common commands cheat sheet | `.github/mcp/RAILWAY_QUICK_REF.md` |
| This Summary | Setup overview and next steps | `.github/mcp/SETUP_SUMMARY.md` |
| README | Overview and getting started | `.github/mcp/README.md` |
| CI/CD Template | GitHub Actions workflow | `.github/workflows/deploy-railway.yml.template` |

## 🔐 Security Checklist

Before deploying to production:

- [ ] Generate strong `JWT_SECRET` (at least 32 characters)
- [ ] Set `TYPEORM_SYNCHRONIZE=false`
- [ ] Configure `CORS_ORIGIN` to your frontend domain
- [ ] Use environment-specific secrets (not from `.env`)
- [ ] Enable Railway's encrypted variables
- [ ] Set up database backups
- [ ] Configure Redis authentication (if available)
- [ ] Enable HTTPS/TLS for all connections
- [ ] Set up monitoring and alerts
- [ ] Review and restrict service permissions
- [ ] Test rollback procedure

## 💡 Best Practices

### Development Workflow
1. Test locally with docker-compose first
2. Deploy to Railway staging environment
3. Run tests and verify functionality
4. Deploy to production
5. Monitor logs for 15-30 minutes after deployment

### Database Management
1. Always run migrations before deploying code changes
2. Test migrations in staging first
3. Backup database before major schema changes
4. Never use `TYPEORM_SYNCHRONIZE=true` in production

### Monitoring
1. Check Railway dashboard daily
2. Set up external uptime monitoring
3. Configure Slack/email alerts
4. Review error logs weekly
5. Monitor Railway usage and costs

### Security
1. Rotate secrets every 90 days
2. Review access permissions quarterly
3. Keep dependencies updated
4. Monitor for security advisories
5. Use Railway's security features

## 🆘 Common Issues & Solutions

### Issue 1: Build Failures
**Problem**: Deployment fails during build
**Solution**: 
```bash
railway logs --service backend
# Check for missing dependencies or build errors
# Ensure pnpm-lock.yaml is committed
```

### Issue 2: Migration Failures  
**Problem**: Migrations fail during deployment
**Solution**:
```bash
# Run migrations manually
railway run -- pnpm run migration:run

# Check migration logs
railway logs --service backend | grep migration
```

### Issue 3: Connection Timeout
**Problem**: Services can't connect to database/Redis
**Solution**:
```bash
# Verify URLs are set
railway variables | grep -E "DATABASE_URL|REDIS_URL"

# Check service status
railway status

# Test connections
railway run -- psql $DATABASE_URL -c "SELECT 1"
railway run -- redis-cli -u $REDIS_URL ping
```

### Issue 4: Environment Variable Not Applied
**Problem**: Changed variable but service still uses old value
**Solution**:
```bash
# Restart service to pick up changes
railway service restart backend

# Verify variable is set
railway variables | grep YOUR_VAR
```

## 📞 Getting Help

1. **Documentation**: Check `.github/mcp/railway-agent.md`
2. **Quick Reference**: See `.github/mcp/RAILWAY_QUICK_REF.md`
3. **Railway Docs**: https://docs.railway.app
4. **Railway Discord**: https://discord.gg/railway
5. **GitHub Issues**: Create issue in this repository

## 🎉 You're All Set!

Your Railway MCP agent is configured and ready to use. The agent provides:
- ✅ Automated deployment workflows
- ✅ Comprehensive monitoring
- ✅ Health checks and alerts
- ✅ Environment management
- ✅ CI/CD integration
- ✅ Rollback capabilities

Start with the automated setup script or follow the manual steps above. Refer to the documentation for detailed guidance on using specific features.

---

**Created**: November 7, 2025  
**Version**: 1.0.0  
**For**: Liffey Founders Club
