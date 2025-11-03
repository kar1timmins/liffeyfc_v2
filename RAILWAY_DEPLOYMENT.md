# Railway Deployment Guide for Backend

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **Railway CLI** (optional): `npm install -g @railway/cli`
3. **GitHub Repository**: Backend code pushed to GitHub

## Deployment Options

### Option A: Deploy via Railway Dashboard (Recommended for First Time)

#### Step 1: Create New Project

1. Go to [railway.app/new](https://railway.app/new)
2. Click **"Deploy from GitHub repo"**
3. Connect your GitHub account if not already connected
4. Select your repository: `Karlitoyo/liffeyfc_v2`
5. Railway will detect it's a Node.js project

#### Step 2: Configure Service

1. **Set Root Directory**:
   - Click on the service
   - Go to **Settings** → **Root Directory**
   - Set to: `backend`

2. **Set Build Command** (if not auto-detected):
   - **Build Command**: `pnpm install --frozen-lockfile && pnpm build`
   - **Start Command**: `node dist/main.js`

3. **Configure Port**:
   - Railway automatically provides `PORT` environment variable
   - Your app uses `process.env.PORT ?? 3000` ✅

#### Step 3: Add Environment Variables

Click **Variables** tab and add:

```
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
WEB3FORMS_ACCESS_KEY=your_web3forms_access_key
NODE_ENV=production
FRONTEND_URL=https://liffeyfoundersclub.com
```

**Where to get these keys:**
- **RECAPTCHA_SECRET_KEY**: [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
- **WEB3FORMS_ACCESS_KEY**: [Web3Forms Dashboard](https://web3forms.com/dashboard)

#### Step 4: Deploy

1. Click **Deploy** or push to GitHub
2. Railway will automatically build and deploy
3. Wait for deployment to complete (2-3 minutes)
4. Copy the public URL (e.g., `https://your-app.up.railway.app`)

#### Step 5: Generate Public Domain

1. Click **Settings** → **Networking**
2. Click **Generate Domain**
3. You'll get a URL like: `https://liffeyfc-backend.up.railway.app`
4. **Save this URL** - you'll need it for frontend configuration!

---

### Option B: Deploy via Railway CLI

#### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
```

#### Step 2: Login

```bash
railway login
```

This will open a browser for authentication.

#### Step 3: Initialize Project

```bash
cd backend
railway init
```

Select **"Create new project"** or link to existing.

#### Step 4: Set Environment Variables

```bash
railway variables set RECAPTCHA_SECRET_KEY="your_key"
railway variables set WEB3FORMS_ACCESS_KEY="your_key"
railway variables set NODE_ENV="production"
railway variables set FRONTEND_URL="https://liffeyfoundersclub.com"
```

#### Step 5: Deploy

```bash
railway up
```

Wait for deployment to complete.

#### Step 6: Get Your URL

```bash
railway domain
```

Or generate one:

```bash
railway domain create
```

---

## Post-Deployment

### 1. Test Backend Endpoints

Visit your Railway URL to test:

```bash
# Health check
curl https://your-app.up.railway.app/

# Web3 chains
curl https://your-app.up.railway.app/web3/chains
```

### 2. Update Frontend Configuration

Create `/frontend/.env.production`:

```bash
VITE_API_URL=https://your-app.up.railway.app
```

### 3. Rebuild Frontend

```bash
cd frontend
pnpm build
```

### 4. Deploy Frontend to Blacknight

Upload `/frontend/build/*` to Blacknight.

---

## Monitoring & Logs

### View Logs (Dashboard)
1. Go to your project in Railway dashboard
2. Click **Deployments** tab
3. View real-time logs

### View Logs (CLI)
```bash
cd backend
railway logs
```

---

## Troubleshooting

### Build Fails

**Issue**: `pnpm not found`
**Solution**: Railway should auto-detect pnpm from `pnpm-lock.yaml`

If it doesn't work, add to `railway.json`:
```json
{
  "build": {
    "builder": "NIXPACKS",
    "nixpacksPlan": {
      "phases": {
        "setup": {
          "nixPkgs": ["nodejs_20", "pnpm"]
        }
      }
    }
  }
}
```

### CORS Errors

**Issue**: Frontend can't connect to backend
**Solution**: 
1. Check CORS origins in `src/main.ts`
2. Ensure your Blacknight domain is in the allowed origins
3. Verify `FRONTEND_URL` environment variable is set

### Port Issues

**Issue**: Backend doesn't start
**Solution**: Railway sets `PORT` automatically. Ensure your app uses:
```typescript
await app.listen(process.env.PORT ?? 3000);
```

---

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | Auto-set | Railway provides this automatically | `3000` |
| `NODE_ENV` | Yes | Environment mode | `production` |
| `RECAPTCHA_SECRET_KEY` | Yes | Google reCAPTCHA v3 secret | `6Lc...` |
| `WEB3FORMS_ACCESS_KEY` | Yes | Web3Forms API key | `abc123...` |
| `FRONTEND_URL` | Optional | Additional CORS origin | `https://liffeyfoundersclub.com` |

---

## Auto-Deploy from GitHub

### Enable Auto-Deploy

1. In Railway dashboard, go to **Settings**
2. Under **Source**, ensure GitHub repo is connected
3. Select **main** branch
4. Every push to `main` will auto-deploy! 🚀

### Deployment Triggers

- ✅ Push to GitHub `main` branch → Auto-deploys
- ✅ Environment variable change → Auto-redeploys
- ✅ Manual redeploy from dashboard

---

## Cost & Limits

### Free Tier (Hobby Plan)
- **$5/month** credit
- **500 hours** execution time
- **100GB** outbound bandwidth
- **8GB** RAM / **8 vCPU** per service

### Typical Usage
- **Backend API**: ~$0.50-2/month (well within free tier)
- **Sleeps after 15 min inactivity** (can disable with paid plan)

---

## Next Steps After Deployment

1. ✅ Copy Railway backend URL
2. ✅ Update frontend `.env.production` with backend URL
3. ✅ Rebuild frontend: `pnpm build`
4. ✅ Deploy frontend to Blacknight
5. ✅ Test full application flow
6. ✅ Set up monitoring (Railway provides basic metrics)

---

## Useful Railway Commands

```bash
# Check status
railway status

# View environment variables
railway variables

# Open project in dashboard
railway open

# Link to existing project
railway link

# Unlink project
railway unlink

# View deployment logs
railway logs --tail

# Restart service
railway restart
```

---

## Support

- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **Railway Discord**: [discord.gg/railway](https://discord.gg/railway)
- **Status Page**: [status.railway.app](https://status.railway.app)
