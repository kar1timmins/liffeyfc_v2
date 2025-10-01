# Deployment Guide for Blacknight Hosting

## Problem Solved
Previously, the `frontend/build/` directory was being tracked by Git, causing file duplications when pulling from GitHub. This has been fixed by:
- Adding `build/` to `.gitignore`
- Removing build files from Git tracking
- Creating a proper deployment workflow

## Deployment Methods

### Method 1: Automated Deployment Script (Recommended)

1. **Run the deployment script:**
   ```bash
   ./deploy.sh
   ```

2. **Upload to Blacknight:**
   - Upload `frontend/liffey-fc-deploy.tar.gz` to your hosting account
   - Extract in your `public_html` directory:
     ```bash
     cd public_html
     tar -xzf liffey-fc-deploy.tar.gz
     rm liffey-fc-deploy.tar.gz  # cleanup
     ```

### Method 2: Manual Deployment

1. **Build locally:**
   ```bash
   cd frontend
   pnpm install
   pnpm run build
   ```

2. **Upload build contents:**
   - Upload everything from `frontend/build/` to your `public_html` directory
   - **Important:** Upload the *contents* of the build folder, not the folder itself

### Method 3: Git-based Deployment (Advanced)

If you want to deploy directly from Git on your server:

1. **Clone repository on server:**
   ```bash
   git clone https://github.com/Karlitoyo/liffeyfc_v2.git
   cd liffeyfc_v2/frontend
   ```

2. **Install Node.js and pnpm on server** (if available)

3. **Build and deploy:**
   ```bash
   pnpm install
   pnpm run build
   cp -r build/* /path/to/public_html/
   ```

## Important Notes

### What NOT to do:
- ❌ Don't commit build files to Git
- ❌ Don't pull the repository directly to `public_html`
- ❌ Don't upload the entire project folder

### What TO do:
- ✅ Only upload the contents of the `build/` directory
- ✅ Use the deployment script for consistency
- ✅ Keep source code and built files separate

## File Structure on Server

Your Blacknight `public_html` should contain:
```
public_html/
├── .htaccess              # Apache configuration
├── index.html             # Main HTML file
├── _app/                  # SvelteKit assets
│   ├── immutable/         # Versioned assets
│   └── version.json       # Build info
├── img/                   # Images
├── videos/                # Video files
├── robots.txt             # SEO
├── sitemap.xml            # SEO
└── test.html              # Diagnostic file
```

## Troubleshooting

### White Page Issues:
1. Check if `.htaccess` is uploaded correctly
2. Verify file permissions (644 for files, 755 for directories)
3. Check browser console for JavaScript errors
4. Try accessing `/test.html` for diagnostics

### File Duplication Issues:
- This should be resolved with the new Git configuration
- If it still happens, ensure you're only uploading build contents

### Permission Issues:
- Set `.htaccess` to 644: `chmod 644 .htaccess`
- Set directories to 755: `chmod 755 _app/`

## Contact Form Setup

Don't forget to complete the Railway email server setup:
1. Add `SMTP_PASS` environment variable in Railway dashboard
2. Test the contact form at `/learnMore`

## Future Deployments

For future updates:
1. Make your changes locally
2. Run `./deploy.sh`
3. Upload the new `liffey-fc-deploy.tar.gz` to Blacknight
4. Extract and replace the old files

This ensures clean, consistent deployments without file conflicts.