# Google Cloud Run deployment for backend (PowerShell)

$PROJECT_ID = "your-gcp-project-id"
$SERVICE_NAME = "omegle-backend"
$REGION = "us-central1"
$IMAGE_NAME = "utkarsh2568/omegle-backend:v1.1"

Write-Host "🚀 Deploying backend to Google Cloud Run" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

# Check if gcloud is installed
$gcloudVersion = gcloud --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ gcloud CLI not found. Please install Google Cloud SDK:" -ForegroundColor Red
    Write-Host "   https://cloud.google.com/sdk/docs/install" -ForegroundColor White
    exit 1
}

Write-Host "✅ gcloud CLI found`n" -ForegroundColor Green

# Login to gcloud
Write-Host "🔐 Logging into Google Cloud..." -ForegroundColor Yellow
gcloud auth login

# Set project
Write-Host "📦 Setting project to: $PROJECT_ID" -ForegroundColor Yellow
gcloud config set project $PROJECT_ID

# Enable required APIs
Write-Host "🔧 Enabling required APIs..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Deploy to Cloud Run
Write-Host "🚀 Deploying to Cloud Run...`n" -ForegroundColor Yellow
gcloud run deploy $SERVICE_NAME `
  --image=$IMAGE_NAME `
  --platform=managed `
  --region=$REGION `
  --allow-unauthenticated `
  --port=3001 `
  --memory=512Mi `
  --cpu=1 `
  --min-instances=0 `
  --max-instances=10 `
  --timeout=300s `
  --set-env-vars="NODE_ENV=production,PORT=3001"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✨ Deployment successful!" -ForegroundColor Green
    Write-Host "🌐 Getting service URL...`n" -ForegroundColor Yellow
    
    $SERVICE_URL = gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)'
    
    Write-Host "✅ Backend deployed at: $SERVICE_URL`n" -ForegroundColor Green
    Write-Host "📝 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Copy the backend URL above" -ForegroundColor White
    Write-Host "   2. Update frontend/.env.production with:" -ForegroundColor White
    Write-Host "      VITE_SOCKET_URL=$SERVICE_URL" -ForegroundColor Yellow
    Write-Host "   3. Rebuild and redeploy the frontend`n" -ForegroundColor White
} else {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}
