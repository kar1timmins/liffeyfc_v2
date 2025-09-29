# Environment Configuration Guide

This docu### Backend Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Node.js environment
- `APP_ENV`: Application environment
- `ENABLE_API_LOGS`: Enable API logging
- `RECAPTCHA_SECRET_KEY`: reCAPTCHA v3 secret (if backend handles verification)
- `WEB3FORMS_ACCESS_KEY`: Web3Forms key (if backend handles forms)lains the environment variable setup for the LiffeyFC v2 project.

## Overview

The project consists of:
- **Frontend**: SvelteKit application with static deployment
- **Backend**: NestJS API server
- **Docker**: Development environment with Docker Compose

## Environment Files Structure

```
liffeyfc_v2/
├── .env                    # Root environment file (for docker-compose)
├── docker-compose.yml      # Uses variables from .env
├── backend/
│   ├── .env                # Backend development environment
│   └── .env.example        # Backend environment template
└── frontend/
    ├── .env                # Frontend development environment
    ├── .env.public         # Public environment variables (committed)
    └── .env.example        # Frontend environment template
```

## Environment Variables

### Frontend Variables

#### Public Variables (Exposed to Browser)
These variables are prefixed with `PUBLIC_` and are safe to expose to the client:

- `PUBLIC_RECAPTCHA_SITE_KEY`: Google reCAPTCHA v3 site key (invisible verification)
- `PUBLIC_DEBUG_LOGS`: Enable debug logging (1 = enabled, 0 = disabled)
- `PUBLIC_APP_ENV`: Application environment (development/production)
- `PUBLIC_API_URL`: Backend API URL

#### Server-side Variables
These are used by the PHP form handler for production deployment:

- `RECAPTCHA_SECRET_KEY`: Google reCAPTCHA v3 secret key
- `WEB3FORMS_ACCESS_KEY`: Web3Forms service access key

### Backend Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Node.js environment
- `APP_ENV`: Application environment
- `ENABLE_API_LOGS`: Enable API logging
- `RECAPTCHA_SECRET_KEY`: reCAPTCHA secret (if backend handles verification)
- `WEB3FORMS_ACCESS_KEY`: Web3Forms key (if backend handles forms)

### Docker Compose Variables

The root `.env` file contains shared variables used by both services:

- `APP_ENV`: Application environment
- `ENABLE_API_LOGS`: Enable logging
- `PUBLIC_RECAPTCHA_SITE_KEY`: reCAPTCHA site key
- `RECAPTCHA_SECRET_KEY`: reCAPTCHA secret key
- `WEB3FORMS_ACCESS_KEY`: Web3Forms access key

## Setup Instructions

### 1. Copy Environment Files

```bash
# Root directory
cp .env.example .env

# Backend
cd backend
cp .env.example .env

# Frontend
cd frontend
cp .env.example .env
```

### 2. Configure reCAPTCHA

1. Go to [Google reCAPTCHA Console](https://www.google.com/recaptcha/admin)
2. Create a new site or use existing keys
3. Update the following variables:
   - `PUBLIC_RECAPTCHA_SITE_KEY`: Your site key (safe to expose)
   - `RECAPTCHA_SECRET_KEY`: Your secret key (keep private)

### 3. Configure Web3Forms

1. Go to [Web3Forms](https://web3forms.com/)
2. Get your access key
3. Update `WEB3FORMS_ACCESS_KEY` in your environment files

### 4. Development Setup

For local development, update the `.env` files with your actual keys:

```bash
# Root .env
PUBLIC_RECAPTCHA_SITE_KEY=your_v3_site_key_here
RECAPTCHA_SECRET_KEY=your_v3_secret_key_here
WEB3FORMS_ACCESS_KEY=your_web3forms_key_here

# Backend .env
PORT=3000
RECAPTCHA_SECRET_KEY=your_v3_secret_key_here
WEB3FORMS_ACCESS_KEY=your_web3forms_key_here

# Frontend .env
PUBLIC_RECAPTCHA_SITE_KEY=your_v3_site_key_here
RECAPTCHA_SECRET_KEY=your_v3_secret_key_here
WEB3FORMS_ACCESS_KEY=your_web3forms_key_here
```

## Production Deployment

### Frontend (Static Hosting)

For production deployment on static hosting (like Blacknight):

1. Build the frontend: `npm run build`
2. Upload the `build/` directory contents to your web root
3. Configure environment variables in your hosting control panel or `.htaccess`:

```apache
SetEnv RECAPTCHA_SECRET_KEY your_secret_key_here
SetEnv WEB3FORMS_ACCESS_KEY your_web3forms_key_here
```

### Backend (Server Hosting)

For backend deployment:

1. Set environment variables on your server
2. Build and run: `npm run build && npm run start:prod`

## Security Notes

- **Never commit secrets**: `.env` files with real secrets should not be committed
- **Use .env.example**: Commit template files with placeholder values
- **Public vs Private**: Only `PUBLIC_` prefixed variables are exposed to the browser
- **PHP Form Handler**: The frontend uses a PHP script for form submission in production
- **Docker Development**: Use the provided docker-compose setup for consistent development

## Troubleshooting

### Common Issues

1. **reCAPTCHA verification fails**: Check your secret key and site key match
2. **Form submission fails**: Verify Web3Forms access key is correct
3. **Environment variables not loading**: Ensure proper prefixes (`PUBLIC_` for frontend)
4. **Docker containers not starting**: Check all required variables are set in `.env`

### Debug Mode

Enable debug logging by setting:
- `PUBLIC_DEBUG_LOGS=1` (frontend)
- `ENABLE_API_LOGS=1` (backend)

This will show detailed logs in the browser console and server logs.