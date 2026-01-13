# Firebase deployment script for Windows PowerShell

Write-Host "🚀 Firebase Deployment Script" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Step 1: Check if Firebase CLI is installed
Write-Host "📦 Checking Firebase CLI..." -ForegroundColor Yellow
$firebaseVersion = firebase --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Firebase CLI not found. Installing..." -ForegroundColor Red
    npm install -g firebase-tools
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install Firebase CLI. Please install manually:" -ForegroundColor Red
        Write-Host "   npm install -g firebase-tools" -ForegroundColor White
        exit 1
    }
    Write-Host "✅ Firebase CLI installed successfully`n" -ForegroundColor Green
} else {
    Write-Host "✅ Firebase CLI found: $firebaseVersion`n" -ForegroundColor Green
}

# Step 2: Login to Firebase
Write-Host "🔐 Logging into Firebase..." -ForegroundColor Yellow
Write-Host "   A browser window will open for authentication`n" -ForegroundColor Gray
firebase login

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Firebase login failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Successfully logged in`n" -ForegroundColor Green

# Step 3: Initialize Firebase project (if not already initialized)
if (-Not (Test-Path ".firebaserc")) {
    Write-Host "🔧 Initializing Firebase project..." -ForegroundColor Yellow
    firebase init hosting
} else {
    Write-Host "✅ Firebase project already initialized`n" -ForegroundColor Green
}

# Step 4: Build the frontend
Write-Host "🏗️  Building frontend..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build completed successfully`n" -ForegroundColor Green

# Step 5: Deploy to Firebase Hosting
Write-Host "🚀 Deploying to Firebase Hosting..." -ForegroundColor Yellow
firebase deploy --only hosting

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n✨ Deployment completed successfully!" -ForegroundColor Green
Write-Host "🌐 Your app is now live on Firebase Hosting`n" -ForegroundColor Cyan

# Show hosting URL
firebase hosting:channel:list
