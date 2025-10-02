# SMTP Connection Timeout Fix

## Issue: Railway → Zoho Mail SMTP Timeout

The logs show Railway cannot connect to `smtp.zoho.com:587`. This is common with Railway's network configuration.

## Quick Fix Options

### Option 1: Try Zoho Alternative Ports
Update Railway environment variables:

```bash
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_SECURE=true
```

OR

```bash
SMTP_HOST=smtp.zoho.eu
SMTP_PORT=587
SMTP_SECURE=false
```

### Option 2: Switch to Gmail SMTP (Recommended for testing)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-gmail-app-password
```

### Option 3: Use SendGrid (Production Ready)
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

## Immediate Test

1. **Try Gmail SMTP first** (easiest to test)
2. **Generate Gmail App Password**: Google Account → Security → 2-Step Verification → App passwords
3. **Update Railway environment variables**
4. **Redeploy**: The retry logic will handle the switch automatically

## Expected Success Logs
```
✅ SMTP server ready for messages
📧 Attempting to send welcome email to: user@example.com
✅ Welcome email sent successfully to: user@example.com (Name)
📧 Message ID: <message-id>
```

## Why Zoho is Failing
- Railway's IP ranges may be blocked by Zoho
- Zoho SMTP has stricter connection requirements
- Network latency causing timeout issues

Switch to Gmail or SendGrid for immediate fix!