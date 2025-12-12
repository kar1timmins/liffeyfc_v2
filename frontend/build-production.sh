#!/bin/bash

# Frontend Production Build Script
# This script builds the frontend with the Railway backend URL

set -e  # Exit on error

echo "🎨 Liffey Founders Club - Frontend Production Build"
echo "=================================================="
echo ""

# Check if backend URL is provided
if [ -z "$1" ]; then
    # Check if we're in Railway environment (has RAILWAY_ENVIRONMENT set)
    if [ -n "$RAILWAY_ENVIRONMENT" ] && [ -n "$PUBLIC_API_URL" ]; then
        echo "🚂 Detected Railway environment, using PUBLIC_API_URL from environment"
        BACKEND_URL=$PUBLIC_API_URL
    else
        echo "❌ Backend URL is required!"
        echo ""
        echo "Usage: ./build-production.sh <BACKEND_URL>"
        echo ""
        echo "Example:"
        echo "  ./build-production.sh https://liffeyfc-backend.up.railway.app"
        echo ""
        echo "Or set PUBLIC_API_URL environment variable in Railway"
        echo ""
        exit 1
    fi
else
    BACKEND_URL=$1
fi

echo "🔧 Configuration:"
echo "  Backend URL: $BACKEND_URL"
echo ""

# Create .env.production file
echo "📝 Creating .env.production..."
cat > .env.production << EOF
# Production Environment Variables
PUBLIC_API_URL=$BACKEND_URL
PUBLIC_APP_ENV=production
PUBLIC_DEBUG_LOGS=0
PUBLIC_RECAPTCHA_SITE_KEY=6LfLPNorAAAAACm_F5G2qUb1GokeFVYNDn10hciP
EOF

echo "✅ .env.production created"
echo ""

# Remove .env.local to prevent conflicts with production build
if [ -f ".env.local" ]; then
    echo "🗑️ Moving .env.local to .env.local.bak to avoid conflicts..."
    mv .env.local .env.local.bak
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install --frozen-lockfile
fi

echo "🔨 Building frontend..."
NODE_ENV=production pnpm build

# Restore .env.local if it existed
if [ -f ".env.local.bak" ]; then
    echo "🔄 Restoring .env.local..."
    mv .env.local.bak .env.local
fi

echo ""
echo "✅ Build successful!"
echo ""
echo "📁 Build output: ./build/"
echo ""
echo "Next steps:"
echo "1. Upload the entire 'build' directory to Blacknight"
echo "2. Make sure to upload all subdirectories (_app, img, videos, etc.)"
echo "3. Test the deployed site"
echo ""
echo "To test locally first:"
echo "  pnpm preview"
echo "  Visit: http://localhost:4173"
