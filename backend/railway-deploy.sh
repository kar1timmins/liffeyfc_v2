#!/bin/bash

# Railway Deployment Quick Start Script
# This script helps you deploy the backend to Railway

set -e  # Exit on error

echo "🚀 Liffey Founders Club - Railway Backend Deployment"
echo "=================================================="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed."
    echo ""
    echo "Install it with:"
    echo "  npm install -g @railway/cli"
    echo ""
    echo "Or use the Railway dashboard at: https://railway.app"
    exit 1
fi

echo "✅ Railway CLI is installed"
echo ""

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Please run this script from the backend directory."
    exit 1
fi

echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

echo ""
echo "🔨 Building application..."
pnpm build

echo ""
echo "✅ Build successful!"
echo ""
echo "Next steps:"
echo "1. Login to Railway: railway login"
echo "2. Initialize project: railway init"
echo "3. Set environment variables:"
echo "   railway variables set RECAPTCHA_SECRET_KEY=\"your_key\""
echo "   railway variables set WEB3FORMS_ACCESS_KEY=\"your_key\""
echo "   railway variables set NODE_ENV=\"production\""
echo "4. Deploy: railway up"
echo "5. Generate domain: railway domain"
echo ""
echo "📚 Full guide: ../RAILWAY_DEPLOYMENT.md"
