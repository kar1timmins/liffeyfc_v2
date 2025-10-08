# Railway Email Server Deployment Fix

## Issue: `nodemailer.createTransporter is not a function`

This error on Railway indicates that nodemailer isn't being installed or loaded correctly.

---

## ✅ Quick Fix

### Step 1: Redeploy with Clean Install

**Option A: Via Railway Dashboard**
1. Go to your Railway project
2. Click on the email-server service
3. Go to "Settings" tab
4. Scroll to "Danger Zone"
5. Click "Remove Service" then re-add it
6. Or click "Redeploy" to trigger a fresh build

**Option B: Force Clean Install (Recommended)**
1. Go to Railway Dashboard
2. Click your email-server service
3. Go to "Variables" tab
4. Add a new variable:
   - Key: `NPM_CONFIG_LOGLEVEL`
   - Value: `verbose`
5. Add another variable:
   - Key: `NODE_ENV`
   - Value: `production`
6. Click "Redeploy"

---

## Step 2: Verify Railway Environment

Make sure these variables are set in Railway:

### Required Variables
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_SECURE=false
FROM_EMAIL=hello@liffeyfoundersclub.com
FROM_NAME=Liffey Founders Club
ALLOWED_ORIGINS=https://liffeyfoundersclub.com,https://www.liffeyfoundersclub.com
```

### Important Notes:
- ✅ `SMTP_SECURE` should be `false` (not `true`) for port 587
- ✅ Make sure there are no extra spaces in values
- ✅ FROM_EMAIL can be different from SMTP_USER (Gmail allows this)

---

## Step 3: Check Railway Build Logs

After redeploying, check the logs for:

**Good Signs:**
```
✅ Nodemailer loaded successfully
📦 Nodemailer version: 6.9.7
📮 SMTP Configuration: smtp.gmail.com:587 (secure: false)
📧 Gmail SMTP detected - optimizing configuration
🚀 Email server listening on port 3001
✅ SMTP connection verified successfully
```

**Bad Signs:**
```
❌ Failed to load nodemailer
TypeError: nodemailer.createTransporter is not a function
```

If you see bad signs, continue to Step 4.

---

## Step 4: Nuclear Option - Rebuild From Scratch

If the issue persists, Railway might have cached a corrupted build:

### Via GitHub (Recommended)
```bash
# 1. Commit the fixes
cd /home/karlitoyo/Development/liffeyfc/liffeyfc_v2
git add email-server/
git commit -m "fix: improve nodemailer loading and Railway compatibility"
git push origin main

# 2. In Railway Dashboard:
# - Click "Deploy" → "Redeploy"
# - Or set up auto-deploy from GitHub (recommended)
```

### Manual Upload
1. Delete the existing email-server service in Railway
2. Create a new service
3. Choose "Deploy from GitHub repo"
4. Select your repo and `/email-server` directory
5. Add all environment variables again
6. Deploy

---

## Step 5: Test the Deployment

After deploying, test with curl:

```bash
# Test 1: Health check
curl https://your-railway-url.up.railway.app/

# Expected: "Email server is running"

# Test 2: Send test email
curl -X POST https://your-railway-url.up.railway.app/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "interest": "Testing",
    "message": "Test message"
  }'

# Expected: "Email sent successfully!"
```

---

## Common Issues & Solutions

### Issue 1: Still Shows `secure: true` for Port 587

**Cause:** Railway has `SMTP_SECURE=true` set  
**Fix:** 
1. Go to Railway Variables
2. Find `SMTP_SECURE`
3. Change to `false` (or delete it - auto-detection will set it correctly)
4. Redeploy

### Issue 2: Module Not Found Errors

**Cause:** package-lock.json out of sync  
**Fix:**
```bash
cd email-server
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "fix: regenerate package-lock.json"
git push
```

### Issue 3: Gmail "Less Secure App" Error

**Cause:** Not using App Password  
**Fix:**
1. Go to Google Account → Security
2. Enable 2-Factor Authentication
3. Generate App Password
4. Use that as `SMTP_PASS` in Railway

### Issue 4: Connection Timeout

**Cause:** Railway firewall or wrong port  
**Fix:**
- Verify port 587 (not 465 or 25)
- Ensure `SMTP_SECURE=false` for port 587
- Check Railway logs for firewall issues

---

## Railway Best Practices

### 1. Use GitHub Integration
- Set up automatic deployments from GitHub
- Easier to track changes and rollback if needed

### 2. Enable Build Logs
Railway Variables:
```
NPM_CONFIG_LOGLEVEL=verbose
DEBUG=nodemailer:*
```

### 3. Set Node Version
In `package.json`:
```json
{
  "engines": {
    "node": "18.x",
    "npm": "9.x"
  }
}
```

### 4. Health Check Endpoint
Already implemented at `/` - Railway can use this for health checks

---

## Debugging Railway Issues

### Check Build Logs
```
Railway Dashboard → Your Service → Deployments → Click latest → View Logs
```

Look for:
- `npm install` completing successfully
- All dependencies installed
- No permission errors
- Server starting without errors

### Check Runtime Logs
```
Railway Dashboard → Your Service → Logs (tab)
```

Filter for:
- `error`
- `failed`
- `TypeError`

### SSH into Railway (Advanced)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# View logs live
railway logs

# Run commands
railway run node server.js
```

---

## Alternative: Start Fresh

If all else fails, create a new Railway service:

```bash
# 1. Create a new directory
mkdir email-server-v2
cd email-server-v2

# 2. Copy files
cp ../email-server/package.json .
cp ../email-server/server.js .

# 3. Fresh install
npm install

# 4. Test locally
node server.js

# 5. Deploy to Railway
railway init
railway up
```

---

## Support

If issues persist:
1. Check Railway Status: https://railway.app/status
2. Railway Discord: https://discord.gg/railway
3. Check our code changes in `email-server/server.js`

---

## Summary of Code Changes

We've improved the email server code to:
- ✅ Better nodemailer loading with error handling
- ✅ Fixed variable shadowing in createTransporter
- ✅ Better logging for debugging
- ✅ Auto-detection of secure setting (false for port 587)
- ✅ Gmail-specific optimizations

**Just commit and push, then redeploy on Railway!**
