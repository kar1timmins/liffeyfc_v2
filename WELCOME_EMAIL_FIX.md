# Welcome Email Fix - Implementation Guide

## Issue: Welcome emails not sending due to SMTP timeout

## Solution 1: Switch to Gmail SMTP (Recommended)

### Update Railway Environment Variables:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-gmail-app-password
ALLOWED_ORIGINS=https://liffeyfoundersclub.com,https://www.liffeyfoundersclub.com,http://localhost:5173
```

### Steps:
1. **Create Gmail App Password**:
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
   - Copy the 16-character password

2. **Update Railway Variables**:
   - SMTP_HOST=smtp.gmail.com
   - SMTP_USER=your-gmail@gmail.com  
   - SMTP_PASS=your-app-password (16 characters from step 1)

3. **Redeploy**: Railway will auto-redeploy with new settings

## Solution 2: Backup Welcome Page (Immediate fix)

If SMTP continues to fail, we can:
1. Use Web3Forms redirect to a welcome page
2. Display welcome message with all event details
3. Provide manual email signup option

## Expected Results

After Gmail SMTP setup:
```
✅ SMTP server ready for messages
📧 Attempting to send welcome email to: user@example.com  
✅ Welcome email sent successfully to: user@example.com (Name)
📧 Message ID: <message-id>
```

Gmail SMTP typically works much better with Railway than Zoho Mail!