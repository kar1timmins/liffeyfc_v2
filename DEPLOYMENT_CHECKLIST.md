# Deployment Checklist - Liffey FC v2

## Pre-Deployment Verification

### 1. Environment Variables ✅
Update the following in your `.htaccess` file or hosting control panel:
- `RECAPTCHA_SECRET_KEY` - Your actual reCAPTCHA v3 secret key
- `WEB3FORMS_ACCESS_KEY` - Your Web3Forms access key

### 2. reCAPTCHA Configuration ✅
- Using reCAPTCHA v3 site key: `6LfLPNorAAAAACm_F5G2qUb1GokeFVYNDn10hciP`
- Domain configured in Google Cloud Console for production domain
- Clean v3-only implementation (no v2 remnants)

### 3. Server Connectivity Improvements ✅
- **Primary Method**: cURL with proper headers and error handling
- **Fallback Method**: file_get_contents for shared hosting compatibility
- **PHP Configuration**: Enhanced .htaccess with connectivity settings
- **Debug Endpoint**: `/api/interest/submit/debug.php` for server diagnostics

## Deployment Steps

### 1. Upload Build Files
Upload the entire contents of `frontend/build/` to your Apache web root:
```bash
# Copy all files from build/ to your web server
rsync -av frontend/build/ your-server:/path/to/webroot/
```

### 2. Configure Environment Variables
Update `build/api/interest/submit/.htaccess` with your actual keys:
```apache
SetEnv RECAPTCHA_SECRET_KEY "your_actual_secret_key_here"
SetEnv WEB3FORMS_ACCESS_KEY "your_actual_web3forms_key_here"
```

### 3. Test Connectivity
Before testing the form, check server connectivity:
1. Visit: `https://yourdomain.com/api/interest/submit/debug.php`
2. Review the connectivity test results
3. Verify both cURL and file_get_contents functionality

### 4. Test Form Submission
1. Visit your main site
2. Navigate to "Learn More" page
3. Fill out the interest form
4. Submit and verify email delivery

## Troubleshooting

### If "recaptcha_api_unreachable" persists:
1. Check the debug endpoint for detailed connectivity information
2. Contact Blacknight support about outbound HTTPS connections
3. Verify firewall settings allow connections to `www.google.com:443`
4. Consider requesting server configuration changes for cURL/HTTPS

### If form submission fails:
1. Check server error logs
2. Verify environment variables are set correctly
3. Test the debug endpoint for configuration issues
4. Ensure PHP has proper permissions for file operations

## Enhanced Features

### Connectivity Resilience
- **Dual HTTP Methods**: cURL primary with file_get_contents fallback
- **Error Logging**: Comprehensive logging for debugging
- **Timeout Handling**: 30-second timeouts with proper error handling
- **User Agent**: Proper user agent for API requests

### Mobile UX Improvements
- **Responsive Design**: TailwindCSS with DaisyUI components
- **Multi-step Form**: 5-step wizard with progress indication
- **Real-time Validation**: Immediate feedback on form errors
- **Touch-friendly**: Optimized for mobile interactions

### Security Enhancements
- **reCAPTCHA v3**: Invisible verification with score-based protection
- **Input Validation**: Server-side sanitization and validation
- **CORS Configuration**: Proper cross-origin request handling
- **Error Masking**: User-friendly error messages without exposing internals

## Post-Deployment Monitoring

1. Monitor server error logs for connectivity issues
2. Test form submissions regularly
3. Check email delivery rates
4. Monitor reCAPTCHA scores and blocking

## Contact Information
If deployment issues persist, contact:
- **Hosting Provider**: Blacknight support for server configuration
- **Google reCAPTCHA**: For API connectivity or domain issues
- **Web3Forms**: For email delivery problems