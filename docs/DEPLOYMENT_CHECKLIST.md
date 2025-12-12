# Frontend Deployment Checklist

## ✅ Code Changes Complete

The frontend code has been updated to use `PUBLIC_API_URL` environment variable:

- ✅ `frontend/src/lib/stores/auth.ts` - All auth endpoints
- ✅ `frontend/src/lib/config.ts` - API base URL configuration  
- ✅ `frontend/src/routes/login/callback/+page.svelte` - OAuth callback
- ✅ `frontend/src/lib/stores/walletStore.ts` - Web3 endpoints (uses config.ts)
- ✅ `frontend/src/routes/profile/+page.svelte` - User profile endpoints

## 🚀 Deploy to Your Hosting Platform

### Option 1: Cloudflare Pages

1. **Set Environment Variable** in Cloudflare Pages dashboard:
   ```
   PUBLIC_API_URL=https://liffeyfcv2-production.up.railway.app
   ```

2. **Trigger Redeploy**:
   - Changes already pushed to GitHub (commit 8366fc1)
   - Cloudflare Pages will auto-deploy from `main` branch
   - Or manually trigger redeploy in dashboard

3. **Verify**:
   - Check build logs for successful build
   - Visit https://www.liffeyfoundersclub.com
   - Open browser console and check API calls

### Option 2: Vercel

1. **Set Environment Variable** in Vercel dashboard:
   ```
   PUBLIC_API_URL=https://liffeyfcv2-production.up.railway.app
   ```

2. **Redeploy**:
   - Go to Vercel dashboard → Your project
   - Click "Deployments" → Latest deployment → "Redeploy"
   - Or push to trigger new deployment

3. **Verify**:
   - Check deployment logs
   - Visit deployed URL
   - Test registration/login flow

### Option 3: Netlify

1. **Set Environment Variable**:
   ```
   PUBLIC_API_URL=https://liffeyfcv2-production.up.railway.app
   ```

2. **Trigger Build**:
   - Settings → Build & deploy → Trigger deploy
   - Or push to GitHub

## 🧪 Testing After Deployment

### 1. Check Browser Console
Open https://www.liffeyfoundersclub.com and check DevTools:

**Expected** (✅ Correct):
```
POST https://liffeyfcv2-production.up.railway.app/auth/register 201
```

**Before Fix** (❌ Wrong):
```
POST https://www.liffeyfoundersclub.com/api/auth/register 404
```

### 2. Test Registration Flow
1. Go to `/auth` page
2. Fill out registration form
3. Submit
4. Check for successful response
5. Verify redirect to dashboard

### 3. Test Login Flow
1. Go to `/auth` page
2. Switch to login tab
3. Enter credentials
4. Submit
5. Check for JWT token in localStorage
6. Verify redirect to dashboard

### 4. Test Protected Routes
1. Try accessing `/dashboard` while logged out → should redirect to `/auth`
2. Login successfully
3. Access `/dashboard` → should load user data
4. Check `/profile` → should show user profile

## 🔍 Troubleshooting

### Issue: Still seeing 404 errors

**Solution**: Environment variable not set or not picked up by build

1. Verify `PUBLIC_API_URL` is set in hosting platform
2. Trigger a **new build** (not just redeploy)
3. Check build logs for environment variable
4. Clear browser cache and hard refresh (Ctrl+Shift+R)

### Issue: CORS errors

**Solution**: Backend CORS configuration

Backend is configured to accept requests from your frontend domain. If you see CORS errors:

1. Check `backend/src/main.ts` - CORS origins
2. Add your frontend domain to allowed origins
3. Redeploy backend service

### Issue: 502 Bad Gateway

**Solution**: Backend might be down

1. Check backend health: `curl https://liffeyfcv2-production.up.railway.app/health`
2. Check Railway logs: `railway logs --service liffeyfc_v2`
3. Verify database and Redis are connected

## 📦 Build Output

Frontend has been built locally and is ready:
- Location: `frontend/build/`
- Adapter: `@sveltejs/adapter-static` (SPA mode)
- Assets: HTML files, JavaScript chunks, CSS
- Sitemap: Generated with 3 URLs

## 🎯 Final Checklist

Before marking deployment complete:

- [ ] Frontend environment variable set in hosting platform
- [ ] New build triggered (not just redeploy)
- [ ] Frontend deployed successfully
- [ ] Browser console shows correct API URL (Railway backend)
- [ ] Registration test passes
- [ ] Login test passes
- [ ] Dashboard loads with user data
- [ ] No 404 errors in console
- [ ] No CORS errors in console

## 📞 Support

If you encounter issues:

1. **Check Backend Health**: `curl https://liffeyfcv2-production.up.railway.app/health`
2. **Check Railway Logs**: `railway logs --service liffeyfc_v2`
3. **Check Browser Console**: Look for API errors
4. **Verify Environment Variables**: Ensure `PUBLIC_API_URL` is set correctly

---

**Last Updated**: December 1, 2025  
**Git Commit**: 8366fc1  
**Backend URL**: https://liffeyfcv2-production.up.railway.app  
**Frontend URL**: https://www.liffeyfoundersclub.com (pending redeploy)
