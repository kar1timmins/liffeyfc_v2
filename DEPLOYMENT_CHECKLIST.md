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
Before testing the form, check server connectivity and configuration:
1. **General diagnostics**: `https://yourdomain.com/api/interest/submit/debug.php`
2. **Web3Forms specific test**: `https://yourdomain.com/api/interest/submit/test_web3forms.php`
3. Review the connectivity test results
4. Verify both cURL and file_get_contents functionality

### 4. Test Form Submission
1. Visit your main site
2. Navigate to "Learn More" page
3. Fill out the interest form
4. Submit and verify email delivery

## Troubleshooting

### Common Error Messages:

#### `"web3forms_failed"` / `"web3forms_api_unreachable"`
**Issue**: Server cannot connect to Web3Forms API
**Solutions**:
1. Check the debug endpoint: `/api/interest/submit/debug.php`
2. Verify `WEB3FORMS_ACCESS_KEY` is set correctly in `.htaccess`
3. Contact hosting provider about outbound HTTPS connectivity
4. Check firewall settings for `api.web3forms.com:443`

#### `"web3forms_submission_failed"`
**Issue**: Web3Forms rejected the submission
**Solutions**:
1. Verify the Web3Forms access key is valid and active
2. Check that the email format and required fields are correct
3. Review Web3Forms dashboard for quota limits or account issues
4. Ensure the domain is verified with Web3Forms if required

#### `"web3forms_cloudflare_blocked"`
**Issue**: Cloudflare is blocking server requests to Web3Forms API
**Solutions**:
1. **Server Configuration**: Contact Blacknight about configuring proper outbound request headers
2. **IP Whitelisting**: Request your server IP be whitelisted with Web3Forms
3. **Alternative Approach**: Consider client-side form submission instead of server-side
4. **Alternative Service**: Switch to an email service without Cloudflare protection

#### `"web3forms_html_response"`
**Issue**: Web3Forms returned HTML instead of JSON (often an error page)
**Solutions**:
1. Check if it's a Cloudflare challenge (see above)
2. Verify the Web3Forms service status
3. Check for API rate limiting or quota issues
4. Review the HTML response content for specific error messages

#### `"recaptcha_api_unreachable"`
**Issue**: Server cannot connect to Google reCAPTCHA API
**Solutions**:
1. Check the debug endpoint for detailed connectivity information
2. Contact Blacknight support about outbound HTTPS connections
3. Verify firewall settings allow connections to `www.google.com:443`
4. Consider requesting server configuration changes for cURL/HTTPS

#### `"recaptcha_verification_failed"`
**Issue**: reCAPTCHA token validation failed
**Solutions**:
1. Verify `RECAPTCHA_SECRET_KEY` matches your site key
2. Check that the domain is correctly configured in Google Cloud Console
3. Ensure the reCAPTCHA token is fresh (not expired)
4. Verify the action name matches between frontend and backend

### If form submission fails:
1. Check server error logs
2. Verify environment variables are set correctly
3. Test the debug endpoint for configuration issues
4. Ensure PHP has proper permissions for file operations

## Enhanced Features

### Connectivity Resilience
- **Dual HTTP Methods**: cURL primary with file_get_contents fallback for both reCAPTCHA and Web3Forms
- **Enhanced Error Logging**: Comprehensive logging for both APIs with detailed error messages
- **Timeout Handling**: 30-second timeouts with proper error handling
- **User Agent**: Proper user agent for API requests
- **SSL Verification**: Proper SSL certificate verification for security

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