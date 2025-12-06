# SMTP Setup Guide for Railway Deployment

## Quick Setup Steps

### 1. Get Zoho App-Specific Password

Since you're already using Zoho Mail, you need to generate an app-specific password:

1. **Log in to Zoho Mail** (https://mail.zoho.com)
2. **Go to Settings** → Click your profile icon → Settings
3. **Navigate to Security** → App Passwords (or Application-Specific Passwords)
4. **Generate New Password**:
   - Application Name: `LFC Backend Production`
   - Click "Generate"
   - **Copy the generated password** (you'll only see it once!)

### 2. Set Environment Variables on Railway

In your Railway backend service, add these environment variables:

```bash
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_USER=info@liffeyfoundersclub.com
SMTP_PASS=paste_the_app_specific_password_here
FRONTEND_URL=https://liffeyfoundersclub.com
```

**Important:** Use the **app-specific password**, not your regular Zoho password!

### 3. Deploy

Railway will automatically redeploy when you push to GitHub. The changes are already pushed.

### 4. Verify

After deployment, check Railway logs for:
```
[EmailService] SMTP configured: smtp.zoho.com:587 (info@liffeyfoundersclub.com)
```

If you see `SMTP configuration incomplete - email sending disabled`, double-check the environment variables.

## What Changed?

### Before
- Backend tried to connect to a separate email-server service
- Email-server wasn't deployed on Railway
- Result: ECONNREFUSED errors

### After
- Backend sends emails directly via SMTP
- Uses Zoho Mail credentials
- No extra service needed
- More reliable and faster

## Testing Password Reset

1. Go to your login page
2. Click "Forgot Password"
3. Enter an email address
4. You should receive a password reset email from `info@liffeyfoundersclub.com`
5. Click the link to reset your password

## Troubleshooting

### "SMTP configuration incomplete"
- Check that all 4 SMTP env vars are set on Railway
- Make sure `SMTP_PASS` uses the app-specific password, not your regular password

### "Authentication failed"
- The app-specific password might be incorrect
- Generate a new one in Zoho Mail settings

### "Connection timeout"
- Railway might be blocking port 587
- Try `SMTP_PORT=465` (use with `secure: true` in email.service.ts)

### Not receiving emails
- Check spam/junk folder
- Verify the email address is correct
- Check Railway logs for "Password reset email sent to [email]"

## Security Notes

- ✅ App-specific passwords are more secure than regular passwords
- ✅ They can be revoked without changing your main password
- ✅ Each app/service should have its own app-specific password
- ✅ Never commit passwords to git (use Railway env vars only)

## Email-Server Service

The `/email-server/` directory is now **optional**. You can:
- Keep it for other purposes (contact forms, etc.)
- Remove it to simplify your codebase
- Deploy it if you want a separate email microservice

The backend is now self-sufficient for password reset emails.
