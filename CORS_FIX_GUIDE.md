# 🚨 CORS & Railway Fix Instructions

## Issue Analysis
- ✅ Frontend URL updated to actual Railway domain
- ❌ CORS policy blocking `www.liffeyfoundersclub.com`
- ❌ Railway environment variables may not be set correctly

## Immediate Fixes

### 1. Deploy Updated Email Server
```bash
cd email-server
railway up
```

### 2. Set Railway Environment Variables
**In Railway Dashboard > Variables, ensure these are set:**

```bash
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_USER=info@liffeyfoundersclub.com
SMTP_PASS=your_zoho_app_password_here
ALLOWED_ORIGINS=https://liffeyfoundersclub.com,https://www.liffeyfoundersclub.com
NODE_ENV=production
PORT=3001
```

### 3. Test CORS Fix
Visit your Railway health check:
```
https://liffeyfcform-production.up.railway.app/health
```

Should show:
```json
{
  "status": "ok",
  "allowed_origins": ["https://liffeyfoundersclub.com", "https://www.liffeyfoundersclub.com"],
  "request_origin": "none"
}
```

### 4. Test Frontend CORS
Open browser console on `https://www.liffeyfoundersclub.com/learnMore` and run:
```javascript
fetch('https://liffeyfcform-production.up.railway.app/cors-test')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

Should work without CORS errors.

### 5. Rebuild Frontend
```bash
cd frontend
npm run build
```

## What Was Fixed

- ✅ **Enhanced CORS**: More explicit origin checking with debugging
- ✅ **Environment Support**: Uses `ALLOWED_ORIGINS` from Railway vars
- ✅ **Debug Endpoints**: `/cors-test` and enhanced `/health`
- ✅ **Better Logging**: Shows blocked origins in Railway logs

## Alternative: Temporary CORS Bypass

If issues persist, add this to Railway environment variables as a temporary fix:
```bash
ALLOWED_ORIGINS=*
```

⚠️ **Warning**: Only use `*` for testing - revert to specific domains for production.

## Expected Flow After Fix

1. User submits form on `www.liffeyfoundersclub.com`
2. Web3Forms processes admin notification ✅
3. Frontend calls Railway email server (CORS now works) ✅
4. Railway sends welcome email to user ✅
5. Console shows: "✅ Welcome email sent successfully"

## Debug Railway Logs

Check Railway logs for:
- `🔧 CORS allowed origins: [...]`
- `📧 SMTP transporter configured`
- Any `❌ CORS blocked origin:` messages