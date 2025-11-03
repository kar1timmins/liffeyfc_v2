#!/bin/bash

# Frontend Production Build Script
# This script builds the frontend with the Railway backend URL

set -e  # Exit on error

echo "🎨 Liffey Founders Club - Frontend Production Build"
echo "=================================================="
echo ""

# Check if backend URL is provided
if [ -z "$1" ]; then
    echo "❌ Backend URL is required!"
    echo ""
    echo "Usage: ./build-production.sh <BACKEND_URL>"
    echo ""
    echo "Example:"
    echo "  ./build-production.sh https://liffeyfc-backend.up.railway.app"
    echo ""
    exit 1
fi

BACKEND_URL=$1

echo "🔧 Configuration:"
echo "  Backend URL: $BACKEND_URL"
echo ""

# Create .env.production file
echo "📝 Creating .env.production..."
cat > .env.production << EOF
# Production Environment Variables
VITE_API_URL=$BACKEND_URL
EOF

echo "✅ .env.production created"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install --frozen-lockfile
fi

echo "🔨 Building frontend..."
pnpm build

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
