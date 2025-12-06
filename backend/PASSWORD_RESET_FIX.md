# Password Reset Email Bug Fix & SMTP Integration

## Issue Summary
Password reset functionality was failing with multiple issues:
1. **Email field undefined in security logs**: The `email` and `userAgent` fields were missing from security event logs
2. **ECONNREFUSED error**: Connection to email server failing (email-server service not deployed)
3. **Unnecessary architecture complexity**: Separate email-server service added extra network hop and deployment complexity

## Solution: Direct SMTP Integration

Instead of using a separate email-server service, we now send emails **directly from the backend using nodemailer** with Zoho Mail SMTP. This approach:
- ✅ Eliminates the extra network hop and potential connection failures
- ✅ Reduces deployment complexity (one less service to manage)
- ✅ Uses the existing SMTP credentials already configured for Zoho Mail
- ✅ Provides better error handling and logging
- ✅ More reliable and performant

## Changes Made

### New Files

#### `/backend/src/common/email.service.ts`
Created a new EmailService with:
- **SMTP configuration** using nodemailer with Zoho Mail
- **sendPasswordResetEmail()** method for password reset emails
- **sendWelcomeEmail()** method for new user registration (future use)
- **HTML email templates** matching the email-server design
- **Error handling** with detailed logging
- **Graceful degradation** if SMTP is not configured

### Modified Files

#### `/backend/src/auth/auth.controller.ts`

**Imports - Added:**
```typescript
import { EmailService } from '../common/email.service';
```

**Constructor - Added EmailService injection:**
```typescript
constructor(
  private authService: AuthService, 
  private usersService: UsersService,
  private gcpStorageService: GcpStorageService,
  private emailService: EmailService,  // Added
  private securityMonitoring: SecurityMonitoringService,
  private tokenCleanupService: TokenCleanupService,
)
```

#### `requestPasswordReset` method

**Before:**
```typescript
async requestPasswordReset(
  @Body() dto: RequestPasswordResetDto,
  @Ip() ip: string,
)
```

**After:**
```typescript
async requestPasswordReset(
  @Body() dto: RequestPasswordResetDto,
  @Req() req: Request,  // Added
  @Ip() ip: string,
)
```

**Email sending - Before:**
```typescript
// Send email via email server
try {
  await fetch(`${process.env.EMAIL_SERVER_URL || 'http://localhost:3001'}/send-password-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: dto.email,
      resetUrl,
    }),
  });
} catch (emailError) {
  console.error('Failed to send password reset email:', emailError);
}
```

**Email sending - After:**
```typescript
// Send email via SMTP
try {
  await this.emailService.sendPasswordResetEmail(dto.email, resetUrl);
} catch (emailError) {
  console.error('Failed to send password reset email:', emailError);
}
```

**Security Log - Before:**
```typescript
await this.securityMonitoring.logEvent({
  type: SecurityEventType.PASSWORD_RESET_REQUEST,
  userId: (result as any).userId || 'unknown',
  ip,
  timestamp: new Date(),
});
```

**Security Log - After:**
```typescript
await this.securityMonitoring.logEvent({
  type: SecurityEventType.PASSWORD_RESET_REQUEST,
  userId: (result as any).userId || 'unknown',
  email: dto.email,  // Added
  ip,
  userAgent: req.headers['user-agent'],  // Added
  timestamp: new Date(),
});
```

#### `resetPassword` method
**Before:**
```typescript
async resetPassword(
  @Body() dto: ResetPasswordDto,
  @Ip() ip: string,
)
```

**After:**
```typescript
async resetPassword(
  @Body() dto: ResetPasswordDto,
  @Req() req: Request,  // Added
  @Ip() ip: string,
)
```

**Security Logs - Added `userAgent` to both success and failure events**

#### `/backend/src/common/common.module.ts`
Added EmailService to module:
```typescript
import { EmailService } from './email.service';

@Module({
  imports: [ConfigModule],
  providers: [GcpStorageService, EmailService],  // Added EmailService
  exports: [GcpStorageService, EmailService],    // Added EmailService
})
```

### `/backend/.env.example`
**Replaced email-server config with SMTP config:**
```bash
# SMTP Configuration (Zoho Mail for email sending)
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_USER=info@liffeyfoundersclub.com
SMTP_PASS=your_app_specific_password_here

# Frontend URL (for password reset links in emails)
FRONTEND_URL=http://localhost:5173
# For production, set to your deployed frontend URL (e.g., https://liffeyfoundersclub.com)
```

### `/backend/package.json`
Added dependencies:
```json
{
  "dependencies": {
    "nodemailer": "^7.0.11"
  },
  "devDependencies": {
    "@types/nodemailer": "^7.0.4"
  }
}
```

## Deployment Checklist

### For Production Deployment (Railway)

1. **Set SMTP Environment Variables**
   ```bash
   # On Railway, set these environment variables:
   SMTP_HOST=smtp.zoho.com
   SMTP_PORT=587
   SMTP_USER=info@liffeyfoundersclub.com
   SMTP_PASS=your_zoho_app_specific_password
   FRONTEND_URL=https://liffeyfoundersclub.com
   ```

2. **Generate Zoho App-Specific Password** (if not already done)
   - Log in to Zoho Mail
   - Go to Settings → Security → App Passwords
   - Generate a new app password for "LFC Backend"
   - Use this password for `SMTP_PASS` (not your regular Zoho password)

3. **Deploy Backend**
   ```bash
   git push origin main
   # Railway will auto-deploy
   ```

4. **Verify SMTP Configuration**
   - Check Railway logs for: "SMTP configured: smtp.zoho.com:587 (info@liffeyfoundersclub.com)"
   - If you see "SMTP configuration incomplete", check environment variables

5. **Test Password Reset Flow**
   - Request password reset from frontend
   - Check backend logs for security events with email and userAgent
   - Verify email is received in inbox
   - Test reset link and password update

6. **Monitor Security Logs**
   - Security events should now include complete information:
     - `email`: User's email address
     - `userAgent`: Browser/client information
     - `ip`: Request IP address
     - `userId`: User ID (when available)
     - `timestamp`: Event timestamp

## Testing Locally

1. **Set Environment Variables**
   ```bash
   # In backend/.env
   SMTP_HOST=smtp.zoho.com
   SMTP_PORT=587
   SMTP_USER=info@liffeyfoundersclub.com
   SMTP_PASS=your_zoho_app_password
   FRONTEND_URL=http://localhost:5173
   ```

2. **Start Backend**
   ```bash
   cd backend
   pnpm start:dev
   ```

3. **Check Logs for SMTP Configuration**
   - Look for: `[EmailService] SMTP configured: smtp.zoho.com:587 (info@liffeyfoundersclub.com)`
   - If not present, verify environment variables are set

4. **Test Password Reset**
   - Go to frontend login page
   - Click "Forgot Password"
   - Enter email and submit
   - Check backend logs for:
     - Security event with email and userAgent
     - "Password reset email sent to [email]"
   - Check inbox for password reset email

## Architecture Benefits

### Before (Separate email-server)
```
Frontend → Backend → fetch(EMAIL_SERVER_URL) → Email Server → SMTP → Zoho Mail → User
```
**Issues:**
- Extra network hop (potential connection failures)
- Two services to deploy and monitor
- ECONNREFUSED errors if email-server is down
- More complex deployment and configuration

### After (Direct SMTP)
```
Frontend → Backend → nodemailer → SMTP → Zoho Mail → User
```
**Benefits:**
- ✅ One less service to deploy and maintain
- ✅ Direct SMTP connection (more reliable)
- ✅ Better error handling and logging
- ✅ Faster email delivery (no extra hop)
- ✅ Simpler configuration (just SMTP env vars)

## Email-Server Service

The email-server service (in `/email-server/`) is now **optional** and can be:
- **Kept** if you want to use it for other purposes (contact forms, notifications, etc.)
- **Removed** if all email sending is done via backend SMTP
- **Repurposed** as a webhook receiver or other utility service

The backend is now self-sufficient for password reset emails.

## Security Benefits

The enhanced security logging now provides:
- **Complete audit trail**: All password reset attempts logged with email, IP, and user agent
- **Threat detection**: Ability to identify suspicious patterns (multiple attempts from same IP, different user agents, etc.)
- **Compliance**: Better logging for security audits and compliance requirements
- **Debugging**: Easier to troubleshoot password reset issues with complete context
- **Direct control**: Email sending is part of the backend service (no external dependencies)

## Future Enhancements

The EmailService can be extended for:
- **Welcome emails** on new user registration (method already implemented)
- **Event notifications** for upcoming club events
- **Password change confirmations**
- **Account verification emails**
- **Newsletter subscriptions**
- **Donation confirmations** (for wishlist donations)

All using the same SMTP configuration and email templates.
