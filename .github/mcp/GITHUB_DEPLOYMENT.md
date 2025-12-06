# Railway Deployment via GitHub (Recommended)

## Problem: Direct Upload Too Large

If you get this error when running `railway up`:
```
Failed to upload code. File too large (391MB+)
```

This happens even with `.railwayignore` because Railway CLI uploads the entire directory before applying ignore rules.

## Solution: Deploy from GitHub

Railway's **GitHub integration** is the recommended deployment method because:
- ✅ Only clones your git repository (no node_modules, build artifacts)
- ✅ Automatic deployments on git push
- ✅ Built-in CI/CD
- ✅ No file size limits
- ✅ Better for teams

---

## Step-by-Step: Deploy from GitHub

### 1. Ensure Code is Pushed to GitHub

```bash
# From project root
cd /home/karlitoyo/Development/liffeyfc/liffeyfc_v2

# Check git status
git status

# Add and commit any changes
git add .
git commit -m "Add Railway configuration and MCP agent"

# Push to GitHub
git push origin main
```

### 2. Deploy via Railway Dashboard

#### Option A: New Project from GitHub

1. Go to [railway.app/new](https://railway.app/new)
2. Click **"Deploy from GitHub repo"**
3. Authorize Railway to access your GitHub account
4. Select repository: **`kar1timmins/liffeyfc_v2`**
5. Railway will detect the monorepo structure

#### Option B: Add Service to Existing Project

1. Go to your Railway project dashboard
2. Click **"+ New"** → **"GitHub Repo"**
3. Select **`kar1timmins/liffeyfc_v2`**
4. Railway will create a new service

### 3. Configure Backend Service

Once Railway detects your repo:

1. **Service Name**: Name it "backend"
2. **Root Directory**: Set to `backend`
   - Click service → **Settings** → **Root Directory** → Enter `backend`
3. **Build Command**: Should auto-detect from `railway.json`
   - `pnpm install --frozen-lockfile && pnpm build`
4. **Start Command**: Should auto-detect
   - `pnpm run migration:run && node dist/main.js`

### 4. Configure Email Server Service

Repeat for email server:

1. Click **"+ New"** → **"GitHub Repo"** → Select same repo
2. **Service Name**: Name it "email-server"
3. **Root Directory**: Set to `email-server`
4. **Start Command**: `npm start`

### 5. Add Databases

In your Railway project:

1. Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
   - This creates `Postgres.DATABASE_URL` automatically
2. Click **"+ New"** → **"Database"** → **"Add Redis"**
   - This creates `Redis.REDIS_URL` automatically

### 6. Set Environment Variables

For **backend** service, go to **Variables** tab:

```bash
JWT_SECRET=7b2a989f48a96936b8a1dbc68060b5cc9601f692d417a7adbfe58614eb2a204b
NODE_ENV=production
RECAPTCHA_SECRET_KEY=6LfLPNorAAAAAP0MpC3rtovBY6fuG8-HGue14ae8
WEB3FORMS_ACCESS_KEY=your_web3forms_access_key_here
TYPEORM_SYNCHRONIZE=false
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
FRONTEND_URL=https://your-frontend-domain.com
```

For **email-server** service:

```bash
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=noreply@liffeyfc.com
SMTP_PASSWORD=your_smtp_password
FROM_EMAIL=noreply@liffeyfc.com
```

### 7. Deploy

Railway will automatically deploy after you set the root directory. Or click **"Deploy"** button.

### 8. Generate Domains

For each service:
1. Go to service → **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy the domain (e.g., `backend-production-a1b2.up.railway.app`)

---

## Alternative: Link Railway CLI to GitHub Deployment

If you've already deployed via GitHub, you can link your local Railway CLI:

```bash
# From project root
railway link

# Select your project
# The CLI will now use the GitHub-based deployment
```

Then you can still use CLI commands:
```bash
# View logs
railway logs --service backend

# Check status
railway status

# Set variables
railway variables --set "KEY=value" --service backend

# But deployment happens via GitHub push, not `railway up`
```

---

## Automatic Deployments

Once set up with GitHub:

```bash
# Make changes to your code
vim backend/src/main.ts

# Commit and push
git add .
git commit -m "Update backend"
git push

# Railway automatically deploys! 🚀
```

Watch deployment in Railway dashboard or:
```bash
railway logs --service backend --follow
```

---

## Monorepo Configuration

Railway has already detected your monorepo! The `railway.json` files in each directory tell Railway how to build:

**backend/railway.json**:
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

---

## GitHub Actions CI/CD (Optional)

For even more control, use the GitHub Actions template:

```bash
# Activate the workflow
mv .github/workflows/deploy-railway.yml.template .github/workflows/deploy-railway.yml

# Add Railway token to GitHub secrets
# 1. Get token: railway login --browserless
# 2. Add to GitHub: Settings → Secrets → RAILWAY_TOKEN

# Now every push triggers automated deployment
```

---

## Troubleshooting

### Error: "No service detected"
**Solution**: Set the root directory in service settings

### Error: "Build failed"
**Solution**: Check build logs in Railway dashboard

### Error: "Cannot find module"
**Solution**: Ensure `pnpm-lock.yaml` is committed to git

### Deployment is slow
**Solution**: Railway caches dependencies after first build

---

## Benefits of GitHub Deployment

| Feature | Direct Upload | GitHub Integration |
|---------|---------------|-------------------|
| File size limit | 100MB | Unlimited |
| Auto-deploy | ❌ | ✅ |
| CI/CD | ❌ | ✅ |
| Team collaboration | ❌ | ✅ |
| Deployment speed | Slow (uploads all) | Fast (git clone) |
| Rollback | Manual | Easy (redeploy commit) |

---

## Summary: Recommended Workflow

```bash
# 1. Push code to GitHub
git push origin main

# 2. Deploy via Railway dashboard
# - railway.app/new → Deploy from GitHub
# - Select kar1timmins/liffeyfc_v2
# - Set root directories

# 3. Add databases
# - Add PostgreSQL
# - Add Redis

# 4. Set environment variables
# - In Railway dashboard

# 5. Watch deployment
railway logs --service backend --follow

# 6. Test
curl https://your-backend.railway.app/health
```

---

**Next Steps**: Follow the instructions above to deploy via GitHub instead of `railway up`.

**Documentation**: 
- [Railway GitHub Integration](https://docs.railway.app/deploy/deployments#github)
- [Railway Monorepo Support](https://docs.railway.app/deploy/monorepo)
