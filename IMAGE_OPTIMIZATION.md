# 🚀 Image Performance Optimization Guide

## Problem Identified

Your images are **4-7MB each** (way too large for web!), causing:
- ❌ Slow page load times (30-50 seconds to load all images)
- ❌ Poor mobile experience
- ❌ High bandwidth usage
- ❌ Bad SEO scores

**Recommended size**: 100-300KB per image

---

## ✅ Solutions Implemented

### 1. Progressive Image Loading (Code Optimization)
**Files Modified:** `/frontend/src/routes/pitch/+page.svelte`

**What it does:**
- ✅ Preloads first 3 critical images immediately
- ✅ Lazy loads remaining images (300ms delay)
- ✅ Shows animated placeholder while images load
- ✅ Smooth fade-in transition when images are ready
- ✅ Uses `fetchpriority="high"` for first image
- ✅ Uses `loading="eager"` for first 3, `"lazy"` for rest
- ✅ Async image decoding for better performance

**Result:** Page feels responsive even before all images load

### 2. Blur Placeholder Effect
- Shows an animated gradient placeholder while images load
- Smooth fade transition when image is ready
- Better user experience (no blank spaces)

### 3. Smart Loading Strategy
```javascript
Priority 1: Images 0-2 (load immediately)
Priority 2: Images 3-8 (load after 300ms delay)
```

---

## 🔧 Image Compression (CRITICAL)

### Automated Script
I've created: `/frontend/optimize-images.sh`

**Run it to compress your images:**

```bash
cd /home/karlitoyo/Development/liffeyfc/liffeyfc_v2/frontend
./optimize-images.sh
```

**What it does:**
- ✅ Creates backup of originals in `static/img/event_june_originals/`
- ✅ Resizes images to max 1920px width (perfect for web)
- ✅ Reduces quality to 85% (imperceptible quality loss)
- ✅ Strips metadata (EXIF data you don't need)
- ✅ Creates progressive JPEGs (load incrementally)
- ✅ Shows before/after comparison

**Expected Results:**
- **Before:** 4-7MB per image (52MB total)
- **After:** 100-400KB per image (~2-3MB total)
- **Savings:** ~90% file size reduction!

### If ImageMagick Not Installed

```bash
# Ubuntu/Debian
sudo apt-get install imagemagick

# macOS
brew install imagemagick

# Fedora/RHEL
sudo dnf install ImageMagick
```

### Manual Compression (Alternative)

If you prefer online tools:
1. Go to: https://tinypng.com/ or https://squoosh.app/
2. Upload your images from `/frontend/static/img/event_june/`
3. Download compressed versions
4. Replace originals

---

## 📊 Expected Performance Improvements

### Before Optimization
- **Total image size:** ~52MB
- **Page load time:** 30-50 seconds (slow connection)
- **Lighthouse score:** ~40-50/100
- **Mobile experience:** Poor

### After Optimization
- **Total image size:** ~2-3MB (95% reduction!)
- **Page load time:** 2-5 seconds
- **Lighthouse score:** 85-95/100
- **Mobile experience:** Excellent
- **First Contentful Paint:** < 1 second
- **Largest Contentful Paint:** < 2.5 seconds

---

## 🎯 Additional Performance Optimizations

### 1. Enable Gzip/Brotli Compression (Server)
Add to `.htaccess`:

```apache
# Already in your .htaccess, but verify it's working
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript image/svg+xml
</IfModule>
```

### 2. Add Image Caching Headers
Add to `.htaccess`:

```apache
<IfModule mod_expires.c>
  ExpiresActive On
  # Cache images for 1 year
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
</IfModule>
```

### 3. Consider WebP Format (Future Enhancement)
WebP images are 25-35% smaller than JPG with same quality.

**Conversion example:**
```bash
# Convert all JPGs to WebP
for img in static/img/event_june/*.jpg; do
  cwebp -q 85 "$img" -o "${img%.jpg}.webp"
done
```

Then update code to use WebP with JPG fallback:
```html
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Event photo">
</picture>
```

---

## 🧪 Testing Performance

### 1. Local Testing
```bash
# Build and test
cd frontend
npm run build
npm run preview

# Open http://localhost:4173/pitch
# Check Network tab in DevTools
```

### 2. Lighthouse Audit
```bash
# Chrome DevTools
# 1. Open page
# 2. F12 → Lighthouse tab
# 3. Run audit

# Or use CLI
lighthouse https://liffeyfoundersclub.com/pitch --view
```

### 3. WebPageTest
https://www.webpagetest.org/
- Enter your URL
- Choose location: Dublin, Ireland
- Run test

---

## 📋 Deployment Checklist

### Before Deploying
- [ ] Run `./optimize-images.sh` to compress images
- [ ] Verify images look good (open a few in browser)
- [ ] Build project: `npm run build`
- [ ] Test locally: `npm run preview`
- [ ] Check Network tab - images should be < 500KB each

### After Deploying
- [ ] Test on production site
- [ ] Run Lighthouse audit
- [ ] Check Google PageSpeed Insights
- [ ] Test on mobile device
- [ ] Verify images load smoothly

---

## 🔍 Monitoring

### Track These Metrics
1. **Largest Contentful Paint (LCP)**: Should be < 2.5s
2. **First Contentful Paint (FCP)**: Should be < 1.8s
3. **Time to Interactive (TTI)**: Should be < 3.8s
4. **Cumulative Layout Shift (CLS)**: Should be < 0.1

### Tools
- Google PageSpeed Insights: https://pagespeed.web.dev/
- Google Search Console → Core Web Vitals
- Chrome DevTools → Lighthouse
- WebPageTest: https://www.webpagetest.org/

---

## 🎨 Code Changes Summary

### `/frontend/src/routes/pitch/+page.svelte`

**Added:**
- Progressive image loading state tracking
- `preloadImages()` function for smart loading
- Blur placeholder effect
- Loading states for each image
- `fetchpriority` attribute for critical images
- `decoding="async"` for non-blocking rendering

**Key Features:**
```javascript
// Track which images have loaded
let loadedImages = new Set<number>();

// Preload critical images (first 3)
function preloadImages() { ... }

// Blur placeholder
<div class="bg-gradient-to-br from-base-300 to-base-200 animate-pulse" />

// Smart loading attributes
loading={i < 3 ? 'eager' : 'lazy'}
fetchpriority={i === 0 ? 'high' : 'auto'}
decoding="async"
```

---

## 💡 Pro Tips

### 1. Future Images
When adding new event photos:
- **Always resize to max 1920px width**
- **Use 85% quality for JPG**
- **Or use TinyPNG/Squoosh before uploading**

### 2. Bulk Optimization
```bash
# One-line command to optimize new images
for img in *.jpg; do convert "$img" -resize '1920x1920>' -quality 85 -strip "$img"; done
```

### 3. Check File Sizes
```bash
# Quick check of current image sizes
ls -lh static/img/event_june/*.jpg
```

### 4. WebP Conversion (Advanced)
```bash
# Install webp tools
sudo apt-get install webp

# Convert to WebP
cwebp -q 85 input.jpg -o output.webp
```

---

## 🆘 Troubleshooting

### Images Still Load Slowly
1. **Check if optimization script ran:**
   ```bash
   ls -lh static/img/event_june/*.jpg
   # Should show ~100-400KB per file
   ```

2. **Clear browser cache:**
   - Chrome: Ctrl+Shift+Delete → Clear cache
   - Test in incognito mode

3. **Check server compression:**
   ```bash
   curl -I https://liffeyfoundersclub.com/img/event_june/image_1.jpg
   # Look for: content-encoding: gzip
   ```

### Images Look Blurry
- Quality might be too low
- Re-run with higher quality:
  ```bash
  convert input.jpg -resize '1920x1920>' -quality 90 -strip output.jpg
  ```

### Script Fails
- Install ImageMagick (see instructions above)
- Check file permissions: `chmod 644 static/img/event_june/*.jpg`
- Verify images aren't corrupted: `identify static/img/event_june/*.jpg`

---

## 📈 Success Metrics

After implementing all optimizations, you should see:

✅ **95% reduction in total image size**  
✅ **90% faster page load time**  
✅ **Lighthouse Performance score: 85-95**  
✅ **Google PageSpeed: 85-95 (mobile & desktop)**  
✅ **Smooth loading experience with placeholders**  
✅ **Better SEO rankings (Core Web Vitals)**

---

## 🚀 Quick Start

```bash
# 1. Optimize images
cd /home/karlitoyo/Development/liffeyfc/liffeyfc_v2/frontend
./optimize-images.sh

# 2. Build project
npm run build

# 3. Test locally
npm run preview

# 4. Deploy to Blacknight
# Upload contents of build/ directory

# 5. Test production
# Open https://liffeyfoundersclub.com/pitch
# Check Network tab - images should be < 500KB
```

---

**Ready to optimize!** 🎉

Run the script and watch your page load 10x faster!
