# Liffey Founders Club - Email Server

Railway-hosted email service for automated welcome emails and form handling.

## Features

- 🚀 **Welcome Emails**: Automated welcome emails for new registrations
- 📧 **SMTP Integration**: Zoho Mail SMTP configuration
- 🔒 **Security**: CORS, Helmet, input validation
- 🎯 **Web3Forms Integration**: Works alongside Web3Forms for complete registration flow

## API Endpoints

### `GET /health`
Health check endpoint with SMTP status
```json
{
  "status": "ok",
  "timestamp": "2025-01-27T10:30:00.000Z",
  "message": "Email server running - Web3Forms integration active",
  "smtp_configured": true
}
```

### `POST /send-welcome`
Send welcome email to new registrants

**Request Body:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "interest": "AI/ML",
  "pitchedBefore": "No",
  "eventQuarter": "Q1",
  "eventYear": "2025"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Welcome email sent successfully",
  "recipient": "user@example.com"
}
```

## Environment Variables

Configure these in Railway:

```bash
# SMTP Configuration (Zoho Mail)
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=info@liffeyfoundersclub.com
SMTP_PASS=your_zoho_app_password_here

# Server Configuration
PORT=3001
NODE_ENV=production

# CORS Configuration
ALLOWED_ORIGINS=https://liffeyfoundersclub.com,https://www.liffeyfoundersclub.com
```

## Deployment

1. **Railway Setup:**
   ```bash
   railway login
   railway link
   railway up
   ```

2. **Environment Variables:**
   - Set all required environment variables in Railway dashboard
   - Use Zoho Mail app-specific password for SMTP_PASS

3. **Frontend Integration:**
   - Update frontend URL to your Railway domain
   - Test welcome email flow after successful Web3Forms submission

## Email Flow

1. **User submits form** → Web3Forms receives admin notification
2. **Web3Forms succeeds** → Frontend calls Railway `/send-welcome`
3. **Railway email server** → Sends branded welcome email to user
4. **User receives** → Professional welcome email with event details

## Template Features

- 🎨 **Professional Design**: Gradient headers, responsive layout
- 📱 **Mobile Optimized**: Works perfectly on all devices
- 🔧 **Dynamic Content**: Personalized with user details and event info
- 📧 **Dual Format**: HTML and plain text versions
- 🛡️ **Validation**: Input sanitization and error handling

## Testing

Test welcome email functionality:

```bash
curl -X POST https://your-railway-domain.railway.app/send-welcome \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "interest": "Testing",
    "pitchedBefore": "No",
    "eventQuarter": "Q1",
    "eventYear": "2025"
  }'
```

## Troubleshooting

- **SMTP Errors**: Check Zoho Mail app password and 2FA settings
- **CORS Issues**: Verify ALLOWED_ORIGINS includes your domain
- **Validation Errors**: Ensure all required fields are provided
- **Environment**: Check Railway environment variables are set correctly

## Security

- ✅ Input validation with express-validator
- ✅ CORS protection for allowed origins
- ✅ Helmet security headers
- ✅ Rate limiting ready (can be added)
- ✅ Environment variable protection