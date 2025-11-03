# FAB Not Opening on Blacknight Deployment - Debug Guide

## Issue
The Floating Action Button (FAB) does not open when clicked on the deployed Blacknight version, but works fine in local development.

## Changes Made
1. **Fixed event handler** in `/frontend/src/routes/+layout.svelte`:
   - Changed `onclick={toggleFab}` to `onclick={(e) => toggleFab(e)}`
   - Ensures event is properly passed to the handler

2. **Rebuilt production bundle**:
   - Run `cd frontend && pnpm build`
   - New build files generated in `/frontend/build/`

## Deployment Checklist

### 1. Upload New Build Files
Upload the entire `/frontend/build/` directory to Blacknight, replacing:
- `build/_app/` folder (all JS/CSS assets)
- `build/index.html`
- All other HTML files (`pitch.html`, `learnMore.html`, etc.)

### 2. Clear Browser Cache
After deploying, clear browser cache or do hard refresh:
- **Chrome/Edge**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- **Firefox**: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)

### 3. Check Console for Errors
Open browser DevTools (F12) and check:
- **Console tab**: Look for JavaScript errors
- **Network tab**: Ensure all JS files load successfully (200 status)
- **Elements tab**: Inspect FAB button to ensure onclick handler is present

### 4. Verify File Permissions
On Blacknight server, ensure files have correct permissions:
```bash
chmod 644 build/*.html
chmod 644 build/_app/immutable/**/*.js
chmod 644 build/_app/immutable/**/*.css
```

### 5. Check .htaccess Configuration
Ensure `.htaccess` doesn't block JavaScript execution or has CSP headers that block inline scripts.

## Debugging Commands

### Test if FAB state is working in console:
```javascript
// In browser console on deployed site
document.querySelector('.fab-button').click();
```

### Check if event handler is attached:
```javascript
// In browser console
console.log(document.querySelector('.fab-button').onclick);
```

### Manually toggle FAB (if handler not working):
```javascript
// Emergency manual toggle - add this to browser console
document.querySelector('.fab-menu')?.classList.toggle('hidden');
```

## Common Issues

### Issue 1: Cached Old Version
**Solution**: Clear CDN/server cache on Blacknight, force browser cache clear

### Issue 2: CSP Header Blocking
**Solution**: Check if Blacknight has Content-Security-Policy headers that block inline event handlers

### Issue 3: Missing Files
**Solution**: Ensure ALL files from `build/_app/immutable/` are uploaded

### Issue 4: Path Issues
**Solution**: Check if paths are correct in `svelte.config.js`:
```javascript
adapter: adapter({
  pages: 'build',
  assets: 'build',
  fallback: null,
  precompress: true
})
```

## Production Build Verification

After building, verify these files exist:
- `/frontend/build/index.html`
- `/frontend/build/_app/immutable/nodes/0.BFnn9p3s.js` (contains FAB code)
- `/frontend/build/_app/immutable/chunks/` (all chunk files)
- `/frontend/build/_app/immutable/entry/` (entry files)

## Next Steps if Still Not Working

1. **Test static build locally**:
   ```bash
   cd frontend
   pnpm preview
   ```
   Visit http://localhost:4173 and test FAB

2. **Check if it works in preview**:
   - If YES → deployment issue (files not uploaded correctly)
   - If NO → build configuration issue

3. **Enable source maps** for debugging:
   In `vite.config.ts`, add:
   ```typescript
   build: {
     sourcemap: true
   }
   ```

4. **Simplify event handler** as last resort:
   Change to basic DOM manipulation in `onMount`:
   ```typescript
   onMount(() => {
     const fabButton = document.querySelector('.fab-button');
     fabButton?.addEventListener('click', (e) => {
       e.stopPropagation();
       fabOpen = !fabOpen;
     });
   });
   ```

## Contact Points
- Blacknight support: Check for server-side restrictions
- Check Blacknight control panel for any JavaScript execution restrictions
