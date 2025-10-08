# Railway Nodemailer Troubleshooting

## Current Issue Analysis

Based on the logs:
```
✅ Nodemailer loaded successfully
📦 Nodemailer version: 6.10.1
📮 SMTP Configuration: smtp.gmail.com:587 (secure: true)  ← PROBLEM!
Error: Nodemailer not properly loaded - createTransporter is not available
```

## Two Separate Issues

### Issue 1: `secure: true` (Should be `false` for port 587)
**Cause:** Railway has environment variable `SMTP_SECURE=true`  
**Fix:** Delete or change `SMTP_SECURE` in Railway

### Issue 2: `createTransporter is not a function`
**Cause:** Nodemailer 6.10.1 might have module export differences  
**Fix:** Code updated to handle both CommonJS and ES module exports

---

## ✅ Immediate Fix Steps

### Step 1: Update Code (Already Done)
The code now includes:
- Better nodemailer import handling
- Checks for both `nodemailer.createTransporter` and `nodemailer.default.createTransporter`
- Detailed debugging logs
- Better SMTP_SECURE environment variable handling

### Step 2: Fix Railway Environment Variables

**Go to Railway Dashboard → Your Service → Variables**

#### Option A: Delete SMTP_SECURE (Recommended)
1. Find the `SMTP_SECURE` variable
2. Click the trash icon to delete it
3. Code will auto-detect: `false` for port 587

#### Option B: Set to false
1. Find `SMTP_SECURE`
2. Change value to: `false` (lowercase, no quotes)
3. Save

### Step 3: Deploy Updated Code

```bash
cd /home/karlitoyo/Development/liffeyfc/liffeyfc_v2
git add email-server/server.js
git commit -m "fix: improve nodemailer loading and SMTP configuration"
git push origin main
```

### Step 4: Check New Logs

After deployment, Railway logs should show:

**Good Logs:**
```
✅ Nodemailer loaded successfully
📦 Nodemailer version: 6.10.1
🔍 Nodemailer type: object
🔍 Has createTransporter? function
🔍 Nodemailer keys: createTransporter, createTestAccount, getTestMessageUrl, ...
🔍 Environment SMTP_SECURE: undefined (or false)
🔧 Auto-detected secure setting for port 587: false
📮 SMTP Configuration: smtp.gmail.com:587 (secure: false)  ← CORRECT!
📧 Gmail SMTP detected - optimizing configuration
🔧 Creating transporter with config: { host: 'smtp.gmail.com', port: 587, secure: false, user: '***' }
🚀 Email server listening on port 3001
✅ SMTP connection verified successfully
```

**Bad Logs (if nodemailer export issue):**
```
🔍 Has createTransporter? undefined
🔧 Using nodemailer.default
✅ Now using nodemailer.default.createTransporter
```

---

## Alternative: Downgrade Nodemailer

If the issue persists with version 6.10.1, try an older stable version:

### Update package.json
```json
{
  "dependencies": {
    "nodemailer": "^6.9.7"
  }
}
```

### Deploy
```bash
cd email-server
rm -rf node_modules package-lock.json
npm install
git add package.json package-lock.json
git commit -m "fix: use nodemailer 6.9.7"
git push
```

---

## Nuclear Option: Fresh Railway Service

If all else fails:

### 1. Export Environment Variables
Copy all your Railway environment variables:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=hello@liffeyfoundersclub.com
FROM_NAME=Liffey Founders Club
ALLOWED_ORIGINS=https://liffeyfoundersclub.com,https://www.liffeyfoundersclub.com
```

**DO NOT SET:** `SMTP_SECURE` (let code auto-detect)

### 2. Delete Old Service
1. Railway Dashboard → Your Service
2. Settings → Remove Service
3. Confirm deletion

### 3. Create New Service
1. Railway Dashboard → New Service
2. Deploy from GitHub repository
3. Select your repo
4. Set root directory to: `/email-server`
5. Add environment variables (without SMTP_SECURE)
6. Deploy

---

## Testing After Fix

### Test 1: Health Check
```bash
curl https://your-railway-url.up.railway.app/
```
Expected: `"Email server is running"`

### Test 2: Send Email
```bash
curl -X POST https://your-railway-url.up.railway.app/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "interest": "Testing",
    "message": "Test message"
  }'
```
Expected: `{"message": "Email sent successfully!", "timestamp": "..."}`

### Test 3: Via Your Website
1. Go to: https://liffeyfoundersclub.com/learnMore
2. Fill out the form
3. Submit
4. Check your email for welcome message

---

## Understanding the Logs

### What the New Logs Tell Us

```javascript
🔍 Nodemailer type: object        // Module loaded correctly
🔍 Has createTransporter? function // Method available
🔍 Nodemailer keys: ...           // Shows all available methods
```

If you see:
```javascript
🔍 Has createTransporter? undefined
🔧 Using nodemailer.default
```
This means nodemailer uses ES module format, and we're automatically fixing it.

### SMTP_SECURE Detection

```javascript
🔍 Environment SMTP_SECURE: true
🔧 Using SMTP_SECURE from env: true
📮 SMTP Configuration: smtp.gmail.com:587 (secure: true)  ← WRONG!
```

vs

```javascript
🔍 Environment SMTP_SECURE: undefined
🔧 Auto-detected secure setting for port 587: false
📮 SMTP Configuration: smtp.gmail.com:587 (secure: false)  ← CORRECT!
```

---

## Common Mistakes

### ❌ Wrong: Setting SMTP_SECURE=true for port 587
Port 587 uses **STARTTLS** (starts unencrypted, upgrades to encrypted)  
This requires `secure: false`

### ✅ Right: Let code auto-detect or set SMTP_SECURE=false
The code automatically detects:
- Port 465 → `secure: true` (direct SSL/TLS)
- Port 587 → `secure: false` (STARTTLS)

### ❌ Wrong: Using port 465 with STARTTLS
Port 465 requires `secure: true` (immediate SSL/TLS)

### ✅ Right: Gmail Configuration
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false (or don't set it)
```

---

## Summary

### What We Fixed:
1. ✅ Better nodemailer module loading (handles both export types)
2. ✅ Added detailed debugging logs
3. ✅ Improved SMTP_SECURE environment variable handling
4. ✅ Better validation and error messages

### What You Need to Do:
1. **Delete `SMTP_SECURE` from Railway** (or set to `false`)
2. **Commit and push the updated code**
3. **Redeploy on Railway**
4. **Check logs** - should see `secure: false` for port 587
5. **Test the form** - welcome emails should send

---

## Quick Commands

```bash
# Commit changes
git add email-server/server.js
git commit -m "fix: improve nodemailer and SMTP configuration"
git push origin main

# Check Railway logs after deploy
railway logs

# Test endpoint
curl https://your-railway-url.up.railway.app/
```

---

**The code is ready - just fix Railway's SMTP_SECURE variable and deploy!** 🚀
