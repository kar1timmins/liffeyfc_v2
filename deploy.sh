#!/bin/bash
# Deployment script for Blacknight hosting
# This script builds the project and creates a deployment package

set -e  # Exit on any error

echo "🚀 Starting Liffey FC deployment process..."

# Check if we're in the correct directory
if [ ! -f "frontend/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf frontend/build/

# Install dependencies
echo "📦 Installing dependencies..."
cd frontend
pnpm install

# Build the project
echo "🔨 Building the project..."
pnpm run build

# Verify build was successful
if [ ! -d "build" ]; then
    echo "❌ Build failed - build directory not found"
    exit 1
fi

echo "✅ Build completed successfully!"

# Create deployment package
echo "📦 Creating deployment package..."
cd build
tar -czf ../liffey-fc-deploy.tar.gz .
cd ..

echo "✅ Deployment package created: frontend/liffey-fc-deploy.tar.gz"
echo ""
echo "📋 Deployment Instructions:"
echo "1. Upload liffey-fc-deploy.tar.gz to your Blacknight hosting"
echo "2. Extract it in your public_html directory:"
echo "   tar -xzf liffey-fc-deploy.tar.gz"
echo "3. The site should now be live!"
echo ""
echo "🔍 Files included in deployment:"
ls -la build/ | head -10
echo "   ... and more"

echo ""
echo "🎉 Deployment package ready!"