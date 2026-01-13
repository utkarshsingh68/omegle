#!/bin/bash

# Cloud Run deployment configuration for backend
PROJECT_ID="your-gcp-project-id"
SERVICE_NAME="omegle-backend"
REGION="us-central1"
IMAGE_NAME="utkarsh2568/omegle-backend:v1.1"

echo "🚀 Deploying backend to Google Cloud Run"
echo "=========================================="
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install Google Cloud SDK:"
    echo "   https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo "✅ gcloud CLI found"
echo ""

# Login to gcloud
echo "🔐 Logging into Google Cloud..."
gcloud auth login

# Set project
echo "📦 Setting project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE_NAME \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --port=3001 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --timeout=300s \
  --set-env-vars="NODE_ENV=production,PORT=3001"

if [ $? -eq 0 ]; then
    echo ""
    echo "✨ Deployment successful!"
    echo "🌐 Getting service URL..."
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')
    echo ""
    echo "✅ Backend deployed at: $SERVICE_URL"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Copy the backend URL above"
    echo "   2. Update frontend/.env.production with:"
    echo "      VITE_SOCKET_URL=$SERVICE_URL"
    echo "   3. Rebuild and redeploy the frontend"
else
    echo "❌ Deployment failed"
    exit 1
fi
