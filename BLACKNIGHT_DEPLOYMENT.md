# Blacknight Hosting Deployment Checklist

## Important: Hosting Configuration Differences

Since you're using **Blacknight hosting** (not Netlify), here's what you need to know:

### ✅ What Works on Blacknight
- **`.htaccess` file** - Contains all security headers (already configured)
- **All SEO improvements** - Meta tags, canonical URLs, structured data
- **Static files** - robots.txt, sitemap.xml
- **SvelteKit build output** - Works perfectly

### ❌ What Doesn't Work on Blacknight
- **`netlify.toml`** - This file is Netlify-specific and will be ignored
- You can safely **delete** `/netlify.toml` or keep it (it won't affect your site)

---

## Deployment Steps for Blacknight

### Step 1: Build Your SvelteKit Site

```bash
cd /home/karlitoyo/Development/liffeyfc/liffeyfc_v2/frontend
npm install
npm run build
```

This creates the `build/` directory with your static site.

### Step 2: Upload to Blacknight

**Option A: FTP/SFTP (Recommended)**
1. Connect to your Blacknight FTP:
   - Host: Your domain or FTP hostname
   - Username: Your cPanel username
   - Password: Your cPanel password
   - Port: 21 (FTP) or 22 (SFTP)

2. Navigate to `public_html/` (or your domain's root folder)

3. Upload **ALL** contents from `frontend/build/`:
   ```
   build/
   ├── .htaccess          ← CRITICAL: Security headers
   ├── index.html
   ├── robots.txt
   ├── sitemap.xml
   ├── _app/              ← SvelteKit assets
   ├── img/
   ├── videos/
   └── ... (all other files)
   ```

**Option B: cPanel File Manager**
1. Log into your Blacknight cPanel
2. Open File Manager
3. Navigate to `public_html/`
4. Upload a ZIP of `frontend/build/` contents
5. Extract the ZIP
6. Verify `.htaccess` is present

**Option C: Git Deployment (If Configured)**
```bash
git add -A
git commit -m "feat: comprehensive SEO improvements"
git push origin main
# Then trigger Blacknight's git deployment webhook
```

### Step 3: Verify Critical Files on Server

Make sure these files are in your `public_html/` directory:

```bash
# SSH into your Blacknight server (if you have SSH access)
cd ~/public_html
ls -la

# You should see:
# .htaccess          ← MUST be present for security headers
# index.html
# robots.txt
# sitemap.xml
# _app/              ← SvelteKit assets folder
# img/
# videos/
```

---

## Critical: `.htaccess` Configuration

The `.htaccess` file **MUST** be uploaded to work properly. This file contains:

✅ **All security headers** (X-Frame-Options, CSP, HSTS, etc.)  
✅ **URL rewriting** for SvelteKit routing  
✅ **Static file rules**

### Verify .htaccess is Working

After deployment, test if security headers are active:

```bash
curl -I https://liffeyfoundersclub.com
```

**You should see these headers in the response:**
```
HTTP/2 200
x-frame-options: SAMEORIGIN
x-content-type-options: nosniff
x-xss-protection: 1; mode=block
referrer-policy: strict-origin-when-cross-origin
strict-transport-security: max-age=31536000; includeSubDomains; preload
permissions-policy: camera=(), microphone=(), geolocation=()
content-security-policy: default-src 'self'; script-src...
```

### If Headers Are Missing

**Possible Issues:**
1. `.htaccess` not uploaded
2. `.htaccess` has wrong permissions (should be 644)
3. Apache `mod_headers` not enabled (contact Blacknight support)

**Fix:**
```bash
# Via SSH, set correct permissions
chmod 644 ~/public_html/.htaccess

# Or via FTP: right-click → File Permissions → 644
```

If still not working, contact Blacknight support to ensure:
- Apache `mod_headers` is enabled
- `.htaccess` overrides are allowed in your hosting plan

---

## Testing After Deployment

### 1. Test Main Pages Load
- ✅ https://liffeyfoundersclub.com/
- ✅ https://liffeyfoundersclub.com/pitch
- ✅ https://liffeyfoundersclub.com/learnMore

### 2. Test Security Headers
```bash
curl -I https://liffeyfoundersclub.com
```

### 3. Test Static Files
- ✅ https://liffeyfoundersclub.com/robots.txt
- ✅ https://liffeyfoundersclub.com/sitemap.xml

### 4. View Page Source
Right-click any page → "View Page Source" and verify:
- `<title>` tag present
- `<meta name="description">` present
- `<link rel="canonical">` present
- Open Graph tags present
- Structured data script present

### 5. Test Structured Data
1. Go to: https://search.google.com/test/rich-results
2. Enter: https://liffeyfoundersclub.com/
3. Verify Organization schema is detected

---

## Common Blacknight Issues & Solutions

### Issue: Pages Return 404
**Cause:** `.htaccess` rewrite rules not working  
**Solution:**
1. Verify `.htaccess` is in the root directory
2. Check file permissions: `chmod 644 .htaccess`
3. Contact Blacknight to enable `mod_rewrite`

### Issue: Security Headers Not Present
**Cause:** `mod_headers` not enabled or `.htaccess` ignored  
**Solution:**
1. Verify `.htaccess` uploaded correctly
2. Check file starts with `#` comment (not corrupted)
3. Contact Blacknight support to enable `mod_headers`

### Issue: CSS/JS Not Loading
**Cause:** `_app/` directory not uploaded or wrong permissions  
**Solution:**
1. Re-upload entire `build/` directory
2. Verify `_app/` folder exists on server
3. Check folder permissions: `chmod 755 _app`

### Issue: Images Not Loading
**Cause:** `img/` or `videos/` directories not uploaded  
**Solution:**
1. Upload `img/` and `videos/` folders from `build/`
2. Check folder permissions: `chmod 755 img videos`
3. Check image file permissions: `chmod 644 img/*.jpg`

---

## Blacknight-Specific Performance Tips

### 1. Enable Gzip Compression
Add to `.htaccess`:
```apache
# Gzip compression (if not already enabled by Blacknight)
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>
```

### 2. Browser Caching
Add to `.htaccess`:
```apache
# Browser caching for static assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType video/mp4 "access plus 1 year"
  ExpiresByType video/webm "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
</IfModule>
```

### 3. PHP Version
If you have PHP pages, ensure you're using PHP 8.0+ for best performance:
- Log into cPanel
- Go to "Select PHP Version"
- Choose PHP 8.0 or higher

---

## Post-Deployment: Google Search Console

### 1. Request Re-Indexing
1. Go to: https://search.google.com/search-console
2. Use URL Inspection tool for each page
3. Click "Request Indexing"

### 2. Submit Sitemap
1. In Search Console → Sitemaps
2. Submit: `https://liffeyfoundersclub.com/sitemap.xml`

### 3. Monitor Coverage
Check Coverage report weekly to see error reduction

---

## Support Contacts

### Blacknight Support
- **Website:** https://www.blacknight.com/support/
- **Email:** support@blacknight.com
- **Phone:** +353 (0)59 9183072

### Common Support Requests
- "Please enable mod_headers for security headers"
- "Please enable mod_rewrite for SvelteKit routing"
- "Please verify .htaccess overrides are allowed"

---

## Quick Command Reference

```bash
# Build the site
cd frontend && npm run build

# Test security headers
curl -I https://liffeyfoundersclub.com

# Check if .htaccess exists (via SSH)
ls -la ~/public_html/.htaccess

# Set correct permissions (via SSH)
chmod 644 ~/public_html/.htaccess
chmod 644 ~/public_html/robots.txt
chmod 644 ~/public_html/sitemap.xml
```

---

**You're all set!** 🚀

All SEO improvements will work perfectly on Blacknight hosting through the `.htaccess` file.
