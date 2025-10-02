# Quick Fix: Railway Email Server Setup

## 🚨 Immediate Steps to Fix CSP and Email Issues

### 1. Deploy Your Email Server to Railway

```bash
cd email-server
railway login
railway up
```

**Get your Railway URL**: After deployment, Railway will give you a URL like:
`https://your-app-name-production.up.railway.app`

### 2. Update Environment Variable

In `frontend/.env.public`, update line 6:

**BEFORE:**
```bash
PUBLIC_EMAIL_SERVER_URL=https://your-railway-email-server.railway.app
```

**AFTER:**
```bash
PUBLIC_EMAIL_SERVER_URL=https://your-actual-railway-url.railway.app
```

### 3. Set Railway Environment Variables

In your Railway dashboard, set these environment variables:

```bash
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=info@liffeyfoundersclub.com
SMTP_PASS=your_zoho_app_password
PORT=3001
NODE_ENV=production
ALLOWED_ORIGINS=https://liffeyfoundersclub.com,https://www.liffeyfoundersclub.com
```

### 4. Rebuild Frontend

```bash
cd frontend
npm run build
```

### 5. Test the Fix

1. **Test Railway Health**: Visit `https://your-railway-url.railway.app/health`
2. **Test Form**: Submit the registration form
3. **Check Console**: Should see "✅ Welcome email sent successfully"

## 🔧 What Was Fixed

- ✅ **CSP Updated**: Added `https://*.railway.app` to connect-src
- ✅ **Environment Variable**: Centralized Railway URL configuration  
- ✅ **Fallback Logic**: Graceful handling when email server is unavailable
- ✅ **Error Messages**: Better logging for debugging

## 🛟 Quick Rollback

If issues persist, comment out lines 252-282 in `+page.svelte`:

```javascript
// // Send welcome email via Railway server
// try {
//   ... (comment out the entire welcome email block)
// } catch (welcomeError) {
//   ...
// }
```

This will disable welcome emails but keep form submission working via Web3Forms.

## 📧 Expected Flow After Fix

1. User submits form → Web3Forms sends admin notification ✅
2. Form succeeds → Railway sends welcome email to user 🆕  
3. User sees success message + receives professional welcome email ✨

The CSP error will be resolved once you update the Railway URL!