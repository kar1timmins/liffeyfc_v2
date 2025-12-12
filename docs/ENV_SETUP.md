# Frontend Environment Variables

This document explains how environment variables are configured for development and production.

## Quick Start

### Development Setup

1. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your development values in `.env.local`

3. Start the dev server:
   ```bash
   pnpm dev
   ```

The frontend will connect to `http://localhost:3000` (local backend).

### Production Build

For production, use `.env.production` or set variables in your hosting platform.

## Environment Files

| File | Purpose | Committed? |
|------|---------|------------|
| `.env.example` | Template with all available variables | ✅ Yes |
| `.env.local` | Local development overrides | ❌ No (gitignored) |
| `.env.production` | Production values (template) | ✅ Yes |
| `.env` | Base values (deprecated, use .env.local) | ❌ No (gitignored) |

## Variable Reference

### Public Variables (exposed to browser)

**Must be prefixed with `PUBLIC_`** to be accessible in SvelteKit components.

| Variable | Description | Dev Value | Prod Value |
|----------|-------------|-----------|------------|
| `PUBLIC_API_URL` | Backend API endpoint | `http://localhost:3000` | `https://liffeyfcv2-production.up.railway.app` |
| `PUBLIC_RECAPTCHA_SITE_KEY` | reCAPTCHA v3 site key | Your dev key | Your prod key |
| `PUBLIC_APP_ENV` | Environment name | `development` | `production` |
| `PUBLIC_DEBUG_LOGS` | Enable debug logging | `1` | `0` |
| `PUBLIC_FORM_API_URL` | Form submission endpoint | `/api/interest/submit/` | `/api/interest/submit/` |

### Private Variables (server-side only)

**Do NOT prefix with `PUBLIC_`** - these are only available server-side.

| Variable | Description |
|----------|-------------|
| `RECAPTCHA_SECRET_KEY` | reCAPTCHA secret key (server validation) |
| `RESEND_API_KEY` | Resend.com API key for emails |
| `WEB3FORMS_ACCESS_KEY` | Web3Forms access key (if using) |

## Usage in Code

### In Svelte Components

```typescript
import { PUBLIC_API_URL } from '$env/static/public';

// Use the API URL
const response = await fetch(`${PUBLIC_API_URL}/auth/login`, {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
```

### In Server Routes (+server.ts)

```typescript
import { RECAPTCHA_SECRET_KEY } from '$env/static/private';
import { PUBLIC_API_URL } from '$env/static/public';

// Access both public and private variables
const verification = await verifyRecaptcha(token, RECAPTCHA_SECRET_KEY);
```

## Deployment Environments

### Local Development
- Uses `.env.local` (create from `.env.example`)
- Backend runs at `http://localhost:3000`
- Frontend runs at `http://localhost:5173` (Vite dev server)

### Production (Cloudflare Pages / Vercel / Netlify)
- Set environment variables in hosting platform UI
- Frontend is static build
- Backend runs at `https://liffeyfcv2-production.up.railway.app` (Railway)

## Important Notes

1. **Never commit `.env` or `.env.local`** - these contain secrets
2. **Always prefix browser variables with `PUBLIC_`** - SvelteKit requirement
3. **Update `.env.production`** when Railway backend URL changes
4. **Set production secrets** in hosting platform (Cloudflare/Vercel), not in code

## Backend URLs

| Environment | Backend URL |
|-------------|-------------|
| Local Dev | `http://localhost:3000` |
| Production | `https://liffeyfcv2-production.up.railway.app` |

## Testing Environment Variables

Check if variables are loaded correctly:

```bash
# Development
pnpm dev
# Visit http://localhost:5173
# Open browser console and check: import.meta.env

# Production build
pnpm build
pnpm preview
# Visit http://localhost:4173
```

## Troubleshooting

### "Cannot connect to backend"
- Check `PUBLIC_API_URL` is set correctly
- Verify backend is running (Railway or local)
- Check CORS settings in backend

### "Environment variable not found"
- Ensure variable is prefixed with `PUBLIC_` for client-side use
- Restart dev server after changing `.env.local`
- Clear `.svelte-kit` cache: `rm -rf .svelte-kit`

### "API calls work locally but not in production"
- Update `PUBLIC_API_URL` in hosting platform to Railway URL
- Verify Railway backend is deployed and accessible
- Check CORS allows your production domain
