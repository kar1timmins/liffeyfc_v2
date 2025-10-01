# SMTP Connection Timeout Fix

## Current Issue: Connection Timeout to smtp.zoho.eu:465

The Railway logs show `ETIMEDOUT` error when connecting to Zoho SMTP. This is common with port 465 on some cloud platforms.

## Solution: Update Railway Variables

Go to Railway Dashboard → Variables and **UPDATE** these settings:

```bash
# Change from port 465 to 587
SMTP_PORT=587

# All other variables stay the same:
SMTP_HOST=smtp.zoho.eu
SMTP_USER=karl@liffeyfoundersclub.com
SMTP_PASS=RreYZA9nicUQ
ADMIN_EMAIL=karl@liffeyfoundersclub.com
RECAPTCHA_SECRET_KEY=6LfLPNorAAAAAP0MpC3rtovBY6fuG8-HGue14ae8
ALLOWED_ORIGINS=https://liffeyfoundersclub.com,https://www.liffeyfoundersclub.com
```

## Why Port 587 is Better for Railway:

1. **Port 587 (STARTTLS)**: More compatible with cloud platforms
2. **Port 465 (SSL)**: Often blocked or times out on cloud services
3. **Railway hosting**: Works better with STARTTLS connections

## Alternative: Try Different Zoho Servers

If port 587 still doesn't work, try these alternatives in Railway:

### Option 1: Main Zoho Server
```bash
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
```

### Option 2: Alternative Zoho EU Server  
```bash
SMTP_HOST=smtppro.zoho.eu
SMTP_PORT=587
```

## What I Updated in Code:

- ✅ Increased connection timeouts (60 seconds)
- ✅ Better TLS configuration for Zoho EU
- ✅ Added proper servername for TLS handshake
- ✅ Improved error handling for timeouts

## Test Steps:

1. **Update SMTP_PORT to 587** in Railway variables
2. **Wait 2-3 minutes** for Railway to redeploy
3. **Try the form** - should connect successfully
4. **Check Railway logs** for "SMTP connection verified successfully"

## If Still Timing Out:

Try changing to the main Zoho server:
- SMTP_HOST=smtp.zoho.com
- SMTP_PORT=587

Port 587 with STARTTLS is much more reliable on Railway than port 465 with SSL.