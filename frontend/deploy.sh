#!/bin/bash

# Eden 2 - One-Command Production Deployment
# Run: bash deploy.sh

set -e

echo "🚀 Eden 2 Deployment Script"
echo "============================"
echo ""

# Navigate to frontend directory
cd "$(dirname "$0")/frontend"

# Check if vercel is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Run tests
echo ""
echo "🧪 Running tests..."
npm run test:run

if [ $? -ne 0 ]; then
    echo "❌ Tests failed! Fix tests before deploying."
    exit 1
fi

echo "✅ All 56 tests passed!"

# Build production
echo ""
echo "🔨 Building production bundle..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Deploy to Vercel
echo ""
echo "🚀 Deploying to Vercel..."
vercel --prod --yes

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Next steps:"
echo "  1. Verify deployment at the URL shown above"
echo "  2. Check Sentry for any errors"
echo "  3. Test authentication and critical flows"
echo "  4. Monitor performance in Vercel dashboard"
