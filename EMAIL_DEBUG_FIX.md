# Email Service Debug & Fix

## Current Issue: SMTP Still Not Working

Based on logs, Zoho Mail SMTP continues to timeout on Railway. Here are the solutions:

## Solution 1: Switch to Gmail SMTP (Most Reliable)

### Railway Environment Variables:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-gmail-app-password
ALLOWED_ORIGINS=https://liffeyfoundersclub.com,https://www.liffeyfoundersclub.com,http://localhost:5173
```

### Gmail Setup Steps:
1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Google Account → Security → 2-Step Verification
   - Scroll to "App passwords"
   - Select "Mail" → Generate
   - Copy the 16-character password (format: xxxx xxxx xxxx xxxx)
3. **Update Railway Environment Variables**:
   - SMTP_HOST=smtp.gmail.com
   - SMTP_USER=your-actual-gmail@gmail.com
   - SMTP_PASS=your-16-char-password (no spaces)

## Solution 2: Use SendGrid (Production Ready)

### Railway Environment Variables:
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### SendGrid Setup:
1. **Create SendGrid Account** (free tier: 100 emails/day)
2. **Create API Key**: Settings → API Keys → Create API Key
3. **Verify Sender**: Settings → Sender Authentication
4. **Update Railway Variables** with SendGrid settings

## Solution 3: Disable Email Service (Current Fallback)

The welcome page redirect is working perfectly as a fallback. You can:
1. Keep the current setup (users get welcome page)
2. Fix email service later
3. Users still get complete welcome experience

## Testing

After updating Railway variables, test at:
- https://liffeyfcform-production.up.railway.app/smtp-test

Expected success response:
```json
{
  "success": true,
  "message": "SMTP connection successful",
  "configured": true
}
```

## Recommendation

**Use Gmail SMTP** - it's the most reliable option for small-scale email sending and typically works well with Railway's network.