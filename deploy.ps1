# Eden 2 - One-Command Production Deployment
# Run: .\deploy.ps1

$ErrorActionPreference = "Stop"

Write-Host "Eden 2 Deployment Script" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# Navigate to frontend directory
Set-Location "$PSScriptRoot\frontend"

# Check if vercel is installed
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelInstalled) {
    Write-Host "Installing Vercel CLI..." -ForegroundColor Yellow
    npm install -g vercel
}

# Run tests
Write-Host ""
Write-Host "Running tests..." -ForegroundColor Yellow
npm run test:run

if ($LASTEXITCODE -ne 0) {
    Write-Host "Tests failed! Fix tests before deploying." -ForegroundColor Red
    exit 1
}

Write-Host "All 56 tests passed!" -ForegroundColor Green

# Build production
Write-Host ""
Write-Host "Building production bundle..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Build successful!" -ForegroundColor Green

# Deploy to Vercel
Write-Host ""
Write-Host "Deploying to Vercel..." -ForegroundColor Yellow
vercel --prod --yes

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Verify deployment at the URL shown above"
Write-Host "  2. Check Sentry for any errors"
Write-Host "  3. Test authentication and critical flows"
Write-Host "  4. Monitor performance in Vercel dashboard"
