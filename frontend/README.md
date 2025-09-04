## Blacknight Deployment (Static + PHP Relay)

This project is configured to build a static SvelteKit site (adapter-static) suitable for Apache hosting on Blacknight. A lightweight PHP endpoint proxies the interest form to Web3Forms and validates reCAPTCHA.

### Build
```bash
pnpm install # or npm ci
pnpm build
```
The production assets are emitted to `build/`. Upload the contents of that folder to your web root.

### Files of note
- `static/.htaccess` – routing, caching, security headers, SPA fallback.
- `static/api/interest/submit/index.php` – PHP relay for form submission (ensure environment variables are configured in hosting panel or via `.htaccess` `SetEnv`).
- `static/robots.txt` & `static/sitemap.xml` – SEO indexing hints.

### Required environment variables (server-side)
Set via Blacknight control panel or add (not recommended for secrets) to `.htaccess` using:
```
SetEnv RECAPTCHA_SECRET_KEY your-secret
SetEnv WEB3FORMS_ACCESS_KEY your-access-key
```

Client-side site key is provided at build time as `PUBLIC_RECAPTCHA_SITE_KEY` (configure in a `.env` file before building if referenced in code).

### Form Endpoint
Frontend posts to `/api/interest/submit/` (note trailing slash tolerated). Apache rewrites leave `/api/` paths untouched so PHP executes normally.

### Prerendering
All pages resolve via SPA fallback (`index.html`). If you later add purely static routes you can enable SvelteKit prerender for them individually.

# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## GitHub-Only Frontend Deployment

If your repository contains both `frontend/` and `backend/` but you only want to deploy the static frontend to Blacknight:

1. A GitHub Actions workflow `.github/workflows/deploy-frontend.yml` builds only the frontend when `main` changes.
2. It publishes the contents of `frontend/build/` to a branch named `frontend-deploy`.
3. Option A: In Blacknight, configure a Git deploy (if supported) against that branch.
4. Option B (recommended now): Provide FTP credentials as repo secrets (`FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`, `FTP_TARGET_DIR`) to auto‑upload after each successful build.
5. The backend folder is ignored in the deployment; no server code is uploaded.

To trigger manually: run the workflow via the Actions tab (workflow_dispatch).
