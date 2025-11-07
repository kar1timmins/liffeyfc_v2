# Railway CLI v4 - Command Syntax Reference

> **Version**: Railway CLI 4.10.0+  
> **Updated**: November 7, 2025

## Breaking Changes from v3

Railway CLI v4 introduced syntax changes. This document shows the correct v4 syntax.

## Environment Variables

### ❌ Old Syntax (v3)
```bash
railway variables set KEY="value"
railway variables delete KEY
```

### ✅ New Syntax (v4)
```bash
# Set single variable
railway variables --set "KEY=value"

# Set multiple variables
railway variables --set "KEY1=value1" --set "KEY2=value2"

# Set for specific service
railway variables --set "KEY=value" --service backend

# Set for specific environment
railway variables --set "KEY=value" --environment production

# Skip triggering deploys
railway variables --set "KEY=value" --skip-deploys

# View all variables
railway variables

# View in KV format
railway variables --kv

# View as JSON
railway variables --json
```

## Common Commands

### Project & Service Management
```bash
# Login
railway login

# Initialize project
railway init

# Link to existing project
railway link

# Unlink from project
railway unlink

# List services
railway service list

# Create service
railway service create <name>

# Delete service
railway service delete <name>

# Restart service
railway service restart <name>
```

### Deployment
```bash
# Deploy current directory
railway up

# Deploy specific service
railway up --service backend

# Deploy with detached mode
railway up --detach

# Check deployment status
railway status

# View logs
railway logs

# View logs for specific service
railway logs --service backend

# Follow logs in real-time
railway logs --service backend --follow

# View last N lines
railway logs --service backend --tail 100
```

### Domains
```bash
# Generate Railway domain
railway domain

# Add custom domain
railway domain add yourdomain.com --service backend

# List domains
railway domain list
```

### Database & Services
```bash
# Add PostgreSQL
railway add --database postgres

# Add Redis
railway add --database redis

# Add MySQL
railway add --database mysql

# Add MongoDB
railway add --database mongodb

# Connect to database
railway connect postgres
```

### Running Commands
```bash
# Run command in service context
railway run -- <command>

# Examples:
railway run -- pnpm run migration:run
railway run -- psql $DATABASE_URL -c "SELECT 1"
railway run -- redis-cli -u $REDIS_URL ping
```

### Project Information
```bash
# Show current project
railway whoami

# Open Railway dashboard
railway open

# List environments
railway environment list

# Switch environment
railway environment <name>
```

## Setting Multiple Variables Example

### Backend Service Setup
```bash
railway variables \
  --set "JWT_SECRET=your-secret-here" \
  --set "NODE_ENV=production" \
  --set "RECAPTCHA_SECRET_KEY=your-key" \
  --set "WEB3FORMS_ACCESS_KEY=your-key" \
  --set "TYPEORM_SYNCHRONIZE=false" \
  --service backend
```

### Email Server Setup
```bash
railway variables \
  --set "SMTP_HOST=smtp.zoho.com" \
  --set "SMTP_PORT=465" \
  --set "SMTP_USER=noreply@liffeyfc.com" \
  --set "SMTP_PASSWORD=your-password" \
  --set "FROM_EMAIL=noreply@liffeyfc.com" \
  --service email-server
```

## Using Service References

Reference other service variables:
```bash
# Reference PostgreSQL URL
railway variables --set "DATABASE_URL=\${{Postgres.DATABASE_URL}}" --service backend

# Reference Redis URL
railway variables --set "REDIS_URL=\${{Redis.REDIS_URL}}" --service backend
```

**Note**: Escape the `$` with `\` in bash to prevent shell expansion.

## Help Commands

```bash
# General help
railway --help

# Command-specific help
railway variables --help
railway up --help
railway logs --help
railway service --help
```

## Common Patterns

### Pattern 1: Full Setup
```bash
# 1. Login
railway login

# 2. Create/link project
railway init

# 3. Add databases
railway add --database postgres
railway add --database redis

# 4. Set environment variables
railway variables --set "JWT_SECRET=secret" --service backend

# 5. Deploy
cd backend && railway up
```

### Pattern 2: Quick Deploy
```bash
# Deploy and view logs
cd backend && railway up && railway logs --service backend --follow
```

### Pattern 3: Environment Update
```bash
# Update variable and restart
railway variables --set "NEW_VAR=value" --service backend && \
railway service restart backend
```

### Pattern 4: Database Migration
```bash
# Run migrations on Railway
cd backend && railway run -- pnpm run migration:run
```

## Troubleshooting

### Check Current Configuration
```bash
# Show all variables
railway variables --json | jq

# Show service info
railway status

# Check who you're logged in as
railway whoami
```

### Reset if Needed
```bash
# Unlink and relink
railway unlink
railway link <project-id>
```

## Railway CLI Installation

```bash
# Install globally
npm install -g @railway/cli

# Or use with npx (no install needed)
npx @railway/cli <command>

# Update to latest version
npm update -g @railway/cli

# Check version
railway --version
```

## Environment Variables Priority

Railway resolves variables in this order:
1. Service-specific variables
2. Shared environment variables
3. Template variables (e.g., `${{Postgres.DATABASE_URL}}`)
4. Default values

## Tips

1. **Use `--skip-deploys`** when setting multiple variables to avoid multiple deploys
2. **Quote values** with spaces: `--set "KEY=value with spaces"`
3. **Escape special characters** in bash: `\$`, `\!`, etc.
4. **Use JSON output** for scripting: `railway variables --json`
5. **Check syntax** with `--help` if unsure

## Migration Guide (v3 → v4)

| Old (v3) | New (v4) |
|----------|----------|
| `railway variables set KEY="value"` | `railway variables --set "KEY=value"` |
| `railway variables delete KEY` | *(Remove via dashboard)* |
| `railway logs` | `railway logs` (same) |
| `railway up` | `railway up` (same) |

---

**Documentation**: https://docs.railway.app/develop/cli  
**Changelog**: https://github.com/railwayapp/cli/releases
