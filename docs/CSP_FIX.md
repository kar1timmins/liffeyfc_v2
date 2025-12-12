# CSP Fix - Content Security Policy Update

## Problem
When registering on the deployed site, the browser blocked requests to the Railway backend:

```
Connecting to 'https://liffeyfcv2-production.up.railway.app/auth/register' violates 
the following Content Security Policy directive: "connect-src 'self' 
https://liffeyfcform-production.up.railway.app https://api.web3forms.com"
```

## Root Cause
The Content Security Policy (CSP) in `.htaccess` only allowed connections to:
- `'self'` (same origin)
- `https://liffeyfcform-production.up.railway.app` (email server)
- `https://api.web3forms.com` (contact form)

It was **missing** the Railway backend URL: `https://liffeyfcv2-production.up.railway.app`

## Solution
Updated `frontend/static/.htaccess` to add the backend URL to the `connect-src` directive:

**Before**:
```apache
connect-src 'self' https://liffeyfcform-production.up.railway.app https://api.web3forms.com
```

**After**:
```apache
connect-src 'self' https://liffeyfcv2-production.up.railway.app https://liffeyfcform-production.up.railway.app https://api.web3forms.com
```

## Files Updated
1. `frontend/static/.htaccess` - Source file
2. `frontend/build/.htaccess` - Built/deployed file (auto-copied during build)

## Testing
After redeploying with this fix:
1. Visit your deployed site
2. Try to register a new account
3. Open browser console
4. ✅ Should see successful POST to `https://liffeyfcv2-production.up.railway.app/auth/register`
5. ❌ Should **NOT** see CSP violation errors

## Deployment
Changes committed: `31eadc2`
- Pushed to GitHub main branch
- Frontend needs to be redeployed for fix to take effect

## What is CSP?
Content Security Policy (CSP) is a security feature that helps prevent:
- Cross-Site Scripting (XSS) attacks
- Data injection attacks
- Malicious script execution

The `connect-src` directive specifically controls which URLs the frontend can make network requests to (fetch, XMLHttpRequest, WebSocket, etc.).

## Additional CSP Directives in Use
- `script-src`: Controls JavaScript sources (Google reCAPTCHA, Cloudflare, etc.)
- `style-src`: Controls CSS sources (Google Fonts)
- `img-src`: Controls image sources
- `font-src`: Controls font sources
- `frame-src`: Controls iframe sources (Google reCAPTCHA, Cloudflare Turnstile)
- `form-action`: Controls form submission targets

---

**Date**: December 8, 2025  
**Commit**: 31eadc2  
**Status**: ✅ Fixed, awaiting frontend redeploy
