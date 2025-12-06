# Password Reset Email Bug Fix

## Issue Summary
Password reset functionality was failing with two issues:
1. **Email field undefined in security logs**: The `email` and `userAgent` fields were missing from security event logs
2. **ECONNREFUSED error**: Connection to email server failing

## Root Causes

### 1. Missing Request Parameter
The `requestPasswordReset` and `resetPassword` methods were missing the `@Req() req: Request` parameter decorator, which is needed to access HTTP request headers (specifically `user-agent`).

### 2. Missing Security Event Fields
Security event logs for password reset were not including:
- `email`: The user's email address
- `userAgent`: The browser/client user agent string

### 3. Email Server Configuration
The `EMAIL_SERVER_URL` environment variable was not documented in `.env.example`, and may not be configured in production.

## Changes Made

### `/backend/src/auth/auth.controller.ts`

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

### `/backend/.env.example`
Added documentation for email server configuration:
```bash
# Email Server Configuration (for password reset emails)
EMAIL_SERVER_URL=http://localhost:3001
# For production, set to your deployed email server URL (e.g., https://email-server.railway.app)

# Frontend URL (for password reset links in emails)
FRONTEND_URL=http://localhost:5173
# For production, set to your deployed frontend URL (e.g., https://liffeyfc.com)
```

## Deployment Checklist

### For Production Deployment

1. **Set Environment Variables**
   ```bash
   # On Railway or your hosting platform
   EMAIL_SERVER_URL=https://your-email-server-url.railway.app
   FRONTEND_URL=https://liffeyfc.com
   ```

2. **Verify Email Server is Running**
   - Check that your email-server service is deployed and accessible
   - Test the `/send-password-reset` endpoint manually if needed
   - Verify SMTP credentials are configured correctly in email-server

3. **Test Password Reset Flow**
   - Request password reset from frontend
   - Check backend logs for security events with email and userAgent
   - Verify email is received
   - Test reset link and password update

4. **Monitor Security Logs**
   - Security events should now include complete information:
     - `email`: User's email address
     - `userAgent`: Browser/client information
     - `ip`: Request IP address
     - `userId`: User ID (when available)
     - `timestamp`: Event timestamp

## Testing Locally

1. **Start Email Server**
   ```bash
   cd /home/karlitoyo/Development/liffeyfc/liffeyfc_v2/email-server
   pnpm dev
   ```

2. **Set Environment Variables**
   ```bash
   # In backend/.env
   EMAIL_SERVER_URL=http://localhost:3001
   FRONTEND_URL=http://localhost:5173
   ```

3. **Test Password Reset**
   - Go to frontend login page
   - Click "Forgot Password"
   - Enter email and submit
   - Check email-server logs for email sending
   - Check backend logs for security event with all fields

## Security Benefits

The enhanced security logging now provides:
- **Complete audit trail**: All password reset attempts logged with email, IP, and user agent
- **Threat detection**: Ability to identify suspicious patterns (multiple attempts from same IP, different user agents, etc.)
- **Compliance**: Better logging for security audits and compliance requirements
- **Debugging**: Easier to troubleshoot password reset issues with complete context

## Related Files
- `/backend/src/auth/auth.controller.ts` - Password reset endpoints
- `/backend/src/auth/security-monitoring.service.ts` - Security event logging
- `/backend/src/auth/dto/request-password-reset.dto.ts` - DTO validation
- `/backend/.env.example` - Environment variable documentation
