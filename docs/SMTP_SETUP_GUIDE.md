# SMTP Setup Guide for Railway Deployment

## Quick Setup Steps

### 1. Get Gmail App Password

Gmail requires an app-specific password for SMTP access:

1. **Enable 2-Factor Authentication** (if not already enabled)
   - Go to https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select app: "Mail"
   - Select device: "Other (Custom name)"
   - Enter name: `LFC Backend Production`
   - Click "Generate"
   - **Copy the 16-character password** (you'll only see it once!)

### 2. Set Environment Variables on Railway

In your Railway backend service, add these environment variables:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=paste_the_16_char_app_password_here
FRONTEND_URL=https://liffeyfoundersclub.com
```

**Important:** 
- Use the **16-character app password**, not your regular Gmail password!
- Make sure 2-Factor Authentication is enabled on your Google account
- Google displays the app password with spaces for readability (e.g., `abcd efgh ijkl mnop`), but you should enter it as a single 16-character password with **no spaces**.
- **Port 465** uses SSL (more reliable on Railway than port 587)

### 3. Deploy

Railway will automatically redeploy when you push to GitHub. The changes are already pushed.

### 4. Verify

After deployment, check Railway logs for:
```
[EmailService] SMTP configured: smtp.gmail.com:465 (your-gmail@gmail.com) [secure=true]
```

If you see `SMTP configuration incomplete - email sending disabled`, double-check the environment variables.

## What Changed?

### Before
- Backend tried to connect to a separate email-server service
- Email-server wasn't deployed on Railway
- Result: ECONNREFUSED errors

### After
- Backend sends emails directly via SMTP
- Uses Gmail credentials with app password
- No extra service needed
- More reliable and faster

## Testing Password Reset

1. Go to your login page
2. Click "Forgot Password"
3. Enter an email address
4. You should receive a password reset email from your Gmail address
5. Click the link to reset your password

**Note:** First email might take 30-60 seconds as Gmail validates the connection

## Troubleshooting

### "SMTP configuration incomplete"
- Check that all 4 SMTP env vars are set on Railway
- Make sure `SMTP_PASS` uses the app-specific password, not your regular password

### "Authentication failed"
- The app password might be incorrect
- Make sure 2FA is enabled on your Google account
- Generate a new app password at https://myaccount.google.com/apppasswords
- Remove any spaces from the app password

### "Connection timeout" (ETIMEDOUT)
- **Railway blocks port 587** - use port 465 instead
- Update Railway env var: `SMTP_PORT=465`
- Port 465 uses SSL and is more reliable on cloud platforms
- If 465 is also blocked, you may need to use a different email provider (SendGrid, Mailgun, etc.)

### "Less secure app access"
- This error means you need to use an App Password, not your regular password
- Follow step 1 to generate an app password

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
