# Complete Deployment Guide - Liffey Founders Club

## Overview

Your application has two parts that need to be deployed separately:

1. **Backend (NestJS)** → Railway (Node.js hosting)
2. **Frontend (SvelteKit)** → Blacknight (Static file hosting)

---

## 🚀 Quick Start Deployment (Step-by-Step)

### Phase 1: Deploy Backend to Railway (15 minutes)

#### Option A: Via Railway Dashboard (Easiest)

1. **Sign up/Login**: Go to [railway.app](https://railway.app)

2. **Create New Project**:
   - Click **"New Project"**
   - Select **"Deploy from GitHub repo"**
   - Choose your repository: `Karlitoyo/liffeyfc_v2`

3. **Configure Backend Service**:
   - Click on the deployed service
   - Go to **Settings** → **Root Directory**: Set to `backend`
   - Go to **Settings** → **Builder**: Should auto-detect as Nixpacks

4. **Set Environment Variables**:
   - Click **Variables** tab
   - Add these variables:
     ```
     RECAPTCHA_SECRET_KEY=<your_recaptcha_secret>
     WEB3FORMS_ACCESS_KEY=<your_web3forms_key>
     NODE_ENV=production
     FRONTEND_URL=https://liffeyfoundersclub.com
     ```

5. **Generate Public URL**:
   - Go to **Settings** → **Networking**
   - Click **"Generate Domain"**
   - Copy the URL (e.g., `https://liffeyfc-backend.up.railway.app`)
   - **SAVE THIS URL!** You'll need it for the frontend.

6. **Verify Deployment**:
   ```bash
   curl https://your-backend-url.railway.app/
   # Should return: "Liffey Founders Club Backend API"
   
   curl https://your-backend-url.railway.app/web3/chains
   # Should return: JSON array of supported blockchain networks
   ```

#### Option B: Via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Navigate to backend
cd backend

# Initialize and deploy
railway init
railway up

# Set environment variables
railway variables set RECAPTCHA_SECRET_KEY="your_key"
railway variables set WEB3FORMS_ACCESS_KEY="your_key"
railway variables set NODE_ENV="production"
railway variables set FRONTEND_URL="https://liffeyfoundersclub.com"

# Generate domain
railway domain

# View logs
railway logs
```

---

### Phase 2: Build Frontend with Backend URL (5 minutes)

1. **Copy your Railway backend URL** from Phase 1

2. **Build frontend** with the backend URL:
   ```bash
   cd frontend
   ./build-production.sh https://your-backend-url.railway.app
   ```

   Or manually:
   ```bash
   # Create .env.production
   echo "VITE_API_URL=https://your-backend-url.railway.app" > .env.production
   
   # Build
   pnpm build
   ```

3. **Test locally** (optional but recommended):
   ```bash
   pnpm preview
   # Visit http://localhost:4173
   # Test FAB, contact form, wallet connection
   ```

---

### Phase 3: Deploy Frontend to Blacknight (10 minutes)

1. **Access Blacknight File Manager** or use FTP/SFTP

2. **Upload build directory**:
   - Upload entire `/frontend/build/` directory
   - Make sure to include:
     - `index.html`
     - `_app/` folder (all JS/CSS bundles)
     - `img/` folder
     - `videos/` folder
     - All other HTML files

3. **Set file permissions** (if needed):
   ```bash
   chmod 644 *.html
   chmod 755 _app/
   ```

4. **Test deployment**:
   - Visit your site: `https://liffeyfoundersclub.com`
   - Open DevTools (F12) → Console
   - Check for errors
   - Test FAB button
   - Test contact form
   - Test wallet connection

---

## 📋 Pre-Deployment Checklist

### Backend Requirements

- [ ] **Railway account** created and verified
- [ ] **GitHub repository** accessible by Railway
- [ ] **reCAPTCHA secret key** obtained from [Google reCAPTCHA](https://www.google.com/recaptcha/admin)
- [ ] **Web3Forms access key** obtained from [Web3Forms](https://web3forms.com)
- [ ] Backend builds successfully locally: `cd backend && pnpm build`

### Frontend Requirements

- [ ] **Railway backend URL** copied and saved
- [ ] Frontend builds successfully locally: `cd frontend && pnpm build`
- [ ] **Blacknight hosting** access (FTP/File Manager)
- [ ] Domain configured: `liffeyfoundersclub.com`

---

## 🔧 Environment Variables Reference

### Backend (Railway)

| Variable | Required | Description | Where to Get |
|----------|----------|-------------|--------------|
| `PORT` | Auto-set | Railway provides automatically | N/A |
| `NODE_ENV` | Yes | Set to `production` | Manual |
| `RECAPTCHA_SECRET_KEY` | Yes | Google reCAPTCHA v3 secret key | [reCAPTCHA Admin](https://www.google.com/recaptcha/admin) |
| `WEB3FORMS_ACCESS_KEY` | Yes | Web3Forms API access key | [Web3Forms Dashboard](https://web3forms.com/dashboard) |
| `FRONTEND_URL` | Optional | Additional CORS origin | Your domain |

### Frontend (Build-time)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_URL` | Yes | Backend API URL from Railway | `https://liffeyfc-backend.up.railway.app` |

---

## 🧪 Testing Checklist

### After Backend Deployment

Test these endpoints:

```bash
# Health check
curl https://your-backend.railway.app/

# Web3 chains
curl https://your-backend.railway.app/web3/chains

# Contact endpoint (should reject without data)
curl -X POST https://your-backend.railway.app/contact/interest
```

### After Frontend Deployment

Test these features:

- [ ] Homepage loads correctly
- [ ] FAB button opens/closes menu
- [ ] Navigation works (Home, Pitch, Learn More)
- [ ] Theme switcher works
- [ ] Contact form submits successfully
- [ ] Web3 wallet connection button shows
- [ ] No console errors in DevTools

---

## 🐛 Troubleshooting

### Backend Issues

**Problem**: Build fails on Railway
```
Solution: Check railway.json configuration and pnpm-lock.yaml exists
```

**Problem**: Backend returns 500 errors
```
Solution: Check Railway logs for missing environment variables
```

**Problem**: CORS errors in browser console
```
Solution: Verify FRONTEND_URL is set in Railway and matches your domain
```

### Frontend Issues

**Problem**: FAB button doesn't open
```
Solution: 
1. Clear browser cache (Ctrl+Shift+R)
2. Ensure you uploaded the entire build directory
3. Check console for JavaScript errors
```

**Problem**: API calls fail (Network Error)
```
Solution: 
1. Verify VITE_API_URL in .env.production before build
2. Check backend is running: curl https://your-backend.railway.app/
3. Verify CORS settings in backend/src/main.ts
```

**Problem**: 404 errors on page refresh
```
Solution: Configure Blacknight .htaccess for SPA routing
```

Add this `.htaccess` in your Blacknight root:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## 📊 Monitoring & Maintenance

### Railway Dashboard

- **View logs**: Deployments → Logs
- **Metrics**: View CPU, Memory, Network usage
- **Redeploy**: Deployments → Redeploy latest

### Frontend (Blacknight)

- Check error logs in Blacknight control panel
- Monitor site uptime
- Test critical flows weekly

---

## 💰 Cost Estimates

### Railway (Backend)
- **Free Tier**: $5/month credit
- **Expected usage**: $0.50-2/month
- **Included**: 500 hours execution, 100GB bandwidth

### Blacknight (Frontend)
- Your existing hosting plan
- Static files only, minimal resource usage

---

## 🚨 Quick Fix Commands

### Redeploy Backend
```bash
cd backend
railway up
```

### Rebuild Frontend
```bash
cd frontend
./build-production.sh https://your-backend.railway.app
```

### View Backend Logs
```bash
cd backend
railway logs --tail
```

---

## 📚 Additional Resources

- **Railway Documentation**: [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)
- **FAB Debug Guide**: [DEPLOYMENT_DEBUG.md](./DEPLOYMENT_DEBUG.md)
- **Web3 Integration**: [WEB3_INTEGRATION.md](./WEB3_INTEGRATION.md)

---

## 🎯 Success Criteria

Your deployment is successful when:

✅ Backend responds at Railway URL  
✅ Frontend loads at Blacknight URL  
✅ FAB button works  
✅ Contact form submits without errors  
✅ Web3 wallet connection button appears  
✅ No console errors  
✅ All pages accessible (Home, Pitch, Learn More)

---

## Need Help?

1. Check logs in Railway dashboard
2. Review browser console (F12)
3. Test backend endpoints with curl
4. Verify environment variables are set correctly
5. Join Railway Discord: [discord.gg/railway](https://discord.gg/railway)

Good luck with your deployment! 🚀
