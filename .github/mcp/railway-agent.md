# Railway MCP Agent Documentation

## Overview
This MCP (Model Context Protocol) agent provides intelligent automation for Railway deployments of the Liffey Founders Club application.

## Prerequisites

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
```

### 2. Authenticate
```bash
railway login
```

### 3. Set Environment Variables
Create a `.env.railway` file in the project root:
```bash
RAILWAY_TOKEN=your_railway_token_here
JWT_SECRET=your_jwt_secret_here
DATABASE_URL=postgresql://user:pass@host:port/db
REDIS_URL=redis://host:port
RECAPTCHA_SECRET_KEY=your_recaptcha_secret
WEB3FORMS_ACCESS_KEY=your_web3forms_key
```

## Agent Capabilities

### Available Tools

#### Authentication & Setup
- `railway_login` - Authenticate with Railway
- `railway_link_project` - Link local directory to Railway project
- `railway_unlink_project` - Unlink from Railway project

#### Deployment
- `railway_deploy_backend` - Deploy backend service
- `railway_deploy_email_server` - Deploy email server
- `railway_status` - Check deployment status
- `railway_logs` - View service logs

#### Service Management
- `railway_list_services` - List all services
- `railway_create_service` - Create new service
- `railway_delete_service` - Delete service
- `railway_restart` - Restart service

#### Configuration
- `railway_set_env` - Set environment variable
- `railway_get_env` - Get environment variables
- `railway_domain` - Manage domains

## Workflows

### 1. Full Stack Deployment
Deploys all services in the correct order:
```bash
# Use via MCP agent
workflow: full_deployment
```

Steps:
1. Check Railway CLI status
2. Deploy backend service
3. Deploy email server
4. Verify deployment status
5. Check logs for errors

### 2. Backend Only Deployment
Quick deployment for backend changes:
```bash
# Use via MCP agent
workflow: backend_only
```

Steps:
1. Build backend locally
2. Deploy to Railway
3. Check logs

### 3. Setup Environment
Configure all environment variables:
```bash
# Use via MCP agent
workflow: setup_environment
```

Steps:
1. Set JWT_SECRET
2. Set DATABASE_URL
3. Set REDIS_URL
4. Set RECAPTCHA_SECRET_KEY
5. Set WEB3FORMS_ACCESS_KEY
6. Verify all variables

### 4. Rollback
Rollback to previous deployment:
```bash
# Use via MCP agent
workflow: rollback
```

## Railway Project Structure

### Services
The Railway project should have these services:

#### 1. Backend (NestJS)
- **Build Command**: `pnpm install --frozen-lockfile && pnpm build`
- **Start Command**: `node dist/main.js`
- **Environment**: Node.js
- **Port**: 3000
- **Health Check**: `/health`

#### 2. Email Server (Node.js)
- **Start Command**: `npm start`
- **Environment**: Node.js
- **Port**: 3001
- **Health Check**: `/health`

#### 3. PostgreSQL Database
- **Template**: PostgreSQL
- **Version**: 15
- **Connection**: Automatic via DATABASE_URL

#### 4. Redis
- **Template**: Redis
- **Version**: 7
- **Connection**: Automatic via REDIS_URL

### Environment Variables

#### Backend Service
```bash
# Required
NODE_ENV=production
JWT_SECRET=<strong-secret>
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
RECAPTCHA_SECRET_KEY=<your-key>
WEB3FORMS_ACCESS_KEY=<your-key>

# Optional
PORT=3000
TYPEORM_SYNCHRONIZE=false
CORS_ORIGIN=https://your-frontend.com
```

#### Email Server Service
```bash
# Required
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=<your-email>
SMTP_PASSWORD=<your-password>
FROM_EMAIL=<your-email>
```

## Usage Examples

### Example 1: First-Time Setup
```typescript
// 1. Link project
await agent.use_tool("railway_link_project", {
  project_id: "your-project-id"
});

// 2. Create services
await agent.use_tool("railway_create_service", {
  name: "backend"
});

// 3. Setup environment
await agent.run_workflow("setup_environment");

// 4. Deploy
await agent.run_workflow("full_deployment");
```

### Example 2: Quick Backend Update
```typescript
// 1. Deploy backend only
await agent.run_workflow("backend_only");

// 2. Check logs
await agent.use_tool("railway_logs", {
  service: "backend",
  follow: true
});
```

### Example 3: Environment Update
```typescript
// Update a single variable
await agent.use_tool("railway_set_env", {
  key: "JWT_SECRET",
  value: "new-secret-key",
  service: "backend"
});

// Restart service to apply changes
await agent.use_tool("railway_restart", {
  service: "backend"
});
```

## Monitoring & Health Checks

### Health Check Configuration
The agent monitors service health:

- **Backend**: `GET /health` every 60 seconds
- **Email Server**: `GET /health` every 60 seconds
- **Timeout**: 30 seconds

### Alerts
Configured alerts:
- **Deployment Failed**: Critical (email + Slack)
- **Service Down**: Critical (email + Slack)
- **High Error Rate**: Warning (Slack only)

## Database Migrations

### Running Migrations on Railway

#### Option 1: Via Railway CLI
```bash
# From local machine
cd backend
railway run pnpm run migration:run
```

#### Option 2: Via Release Command (Recommended)
Add to `railway.json`:
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install --frozen-lockfile && pnpm build"
  },
  "deploy": {
    "startCommand": "pnpm run migration:run && node dist/main.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### Option 3: Via MCP Agent
```typescript
// Add to workflows
await agent.run_command("cd backend && railway run pnpm run migration:run");
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check DATABASE_URL is set
railway variables

# Test connection
railway run -- psql $DATABASE_URL -c "SELECT 1"
```

#### 2. Redis Connection Failed
```bash
# Check REDIS_URL is set
railway variables

# Test connection
railway run -- redis-cli -u $REDIS_URL ping
```

#### 3. Build Failures
```bash
# Check logs
railway logs --service backend

# Common fixes:
# - Ensure pnpm-lock.yaml is committed
# - Check Node.js version in package.json
# - Verify all dependencies are installed
```

#### 4. Deployment Timeout
```bash
# Increase healthcheck timeout in railway.json
{
  "deploy": {
    "healthcheckTimeout": 300,
    "healthcheckPath": "/health"
  }
}
```

## Best Practices

### 1. Environment Management
- Use Railway's built-in secrets management
- Never commit `.env` files
- Use `${{SERVICE.VARIABLE}}` for service references

### 2. Deployment Strategy
- Deploy during low-traffic periods
- Always run migrations before deployment
- Monitor logs immediately after deployment
- Keep rollback plan ready

### 3. Database Management
- Set `TYPEORM_SYNCHRONIZE=false` in production
- Always use migrations for schema changes
- Backup database before major updates
- Test migrations in staging first

### 4. Monitoring
- Set up Railway webhooks for deployment notifications
- Monitor error rates in application logs
- Use Railway metrics dashboard
- Set up external uptime monitoring

## Security Considerations

### 1. Secrets Management
- Rotate JWT_SECRET regularly
- Use strong, unique secrets for each environment
- Never log sensitive environment variables
- Use Railway's encrypted variables

### 2. Database Security
- Use SSL/TLS for database connections
- Enable authentication on Redis
- Restrict network access to services
- Regular security audits

### 3. API Security
- Enable rate limiting
- Use CORS properly
- Validate all inputs
- Keep dependencies updated

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Deploy to Railway
on:
  push:
    branches: [main]
    
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Railway CLI
        run: npm install -g @railway/cli
        
      - name: Deploy Backend
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: railway up --service backend
```

## Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Railway CLI Reference](https://docs.railway.app/develop/cli)
- [Railway Templates](https://railway.app/templates)
- [MCP Protocol Specification](https://modelcontextprotocol.io)

## Support

For issues or questions:
1. Check Railway logs: `railway logs`
2. Check Railway status: `railway status`
3. Review this documentation
4. Contact Railway support: https://railway.app/help
