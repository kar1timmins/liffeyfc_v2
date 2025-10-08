# Gmail SMTP with Custom From Address Setup

## ✅ Yes! You can use Gmail SMTP and still show emails as coming from info@liffeyfoundersclub.com

## Railway Environment Variables Configuration

Set these in your Railway dashboard:

### SMTP Configuration (Gmail)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-personal-gmail@gmail.com
SMTP_PASS=your-gmail-app-password
```

### Email Branding (Your Liffey Founders Club Address)
```bash
FROM_EMAIL=info@liffeyfoundersclub.com
FROM_NAME=Liffey Founders Club
REPLY_TO_EMAIL=info@liffeyfoundersclub.com
```

### Other Required Variables
```bash
ALLOWED_ORIGINS=https://liffeyfoundersclub.com,https://www.liffeyfoundersclub.com,http://localhost:5173
NODE_ENV=production
PORT=3001
```

## How It Works

1. **SMTP Authentication**: Uses your Gmail credentials for sending
2. **From Address**: Shows as `"Liffey Founders Club" <info@liffeyfoundersclub.com>`
3. **Reply-To**: Responses go to `info@liffeyfoundersclub.com`
4. **Deliverability**: Gmail's servers ensure high delivery rates

## Gmail Setup Steps

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Google Account → Security → 2-Step Verification
   - Scroll to "App passwords"
   - Select "Mail" → Generate
   - Copy the 16-character password

3. **Set Railway Variables** with the configuration above

## Important Notes

### ✅ What Works:
- Recipients see emails from `info@liffeyfoundersclub.com`
- Replies go to your Zoho Mail inbox
- Professional branding maintained
- High deliverability through Gmail

### ⚠️ Best Practices:
- Use a dedicated Gmail account for sending (not your personal one)
- Ensure `info@liffeyfoundersclub.com` is a real, working email address
- Monitor your Gmail sending limits (500 emails/day for free accounts)

### 🔧 Optional: Custom Reply-To
If you want replies to go to a different address:
```bash
REPLY_TO_EMAIL=support@liffeyfoundersclub.com
```

## Email Headers Result

Recipients will see:
```
From: "Liffey Founders Club" <info@liffeyfoundersclub.com>
Reply-To: info@liffeyfoundersclub.com
Subject: Welcome to Liffey Founders Club - Registration Confirmed!
```

## Testing

After updating Railway variables:
1. Test SMTP: `https://liffeyfcform-production.up.railway.app/smtp-test`
2. Submit test registration
3. Check email appears from `info@liffeyfoundersclub.com`

This setup gives you the best of both worlds: Gmail's reliability + your professional branding!