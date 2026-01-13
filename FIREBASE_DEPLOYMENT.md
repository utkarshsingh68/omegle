# Firebase + Google Cloud Deployment Guide

Complete guide for deploying the Omegle clone on Firebase Hosting (frontend) and Google Cloud Run (backend).

## Prerequisites

1. **Google Account** - You need a Google account
2. **Google Cloud Project** - Create a project at https://console.cloud.google.com
3. **Billing Enabled** - Cloud Run requires billing (free tier: 2 million requests/month, 360,000 GB-seconds/month)

## Architecture

- **Frontend**: Firebase Hosting (Free tier: 10GB storage, 360MB/day transfer)
- **Backend**: Google Cloud Run (Generous free tier, serverless)

## Part 1: Deploy Backend to Cloud Run

### Step 1: Install Google Cloud SDK

**Windows:**
```powershell
# Download and install from:
https://cloud.google.com/sdk/docs/install-sdk#windows

# Or use Chocolatey:
choco install gcloudsdk
```

**Mac/Linux:**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

### Step 2: Configure Google Cloud

```powershell
# Initialize gcloud
gcloud init

# Login
gcloud auth login

# Set your project ID (replace with your actual project ID)
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### Step 3: Deploy Backend

**Option A: Using PowerShell Script (Recommended)**

1. Edit `backend/deploy-cloudrun.ps1`:
   ```powershell
   $PROJECT_ID = "your-actual-project-id"  # Change this!
   ```

2. Run deployment:
   ```powershell
   cd backend
   .\deploy-cloudrun.ps1
   ```

**Option B: Manual Deployment**

```powershell
cd backend

gcloud run deploy omegle-backend \
  --image=utkarsh2568/omegle-backend:v1.1 \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --port=3001 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --timeout=300s \
  --set-env-vars="NODE_ENV=production,PORT=3001"
```

### Step 4: Get Backend URL

After deployment, you'll see output like:
```
Service URL: https://omegle-backend-xxxxx-uc.a.run.app
```

**Copy this URL** - you'll need it for the frontend!

## Part 2: Deploy Frontend to Firebase Hosting

### Step 1: Install Firebase CLI

```powershell
npm install -g firebase-tools
```

### Step 2: Login to Firebase

```powershell
firebase login
```

A browser window will open for authentication.

### Step 3: Initialize Firebase Project

```powershell
cd frontend

# Initialize Firebase (if not already done)
firebase init hosting
```

When prompted:
- **Project**: Select your Google Cloud project
- **Public directory**: Enter `dist`
- **Configure as SPA**: Yes
- **Set up automatic builds**: No
- **Overwrite files**: No

### Step 4: Update Backend URL

Edit `frontend/.env.production`:
```env
VITE_SOCKET_URL=https://omegle-backend-xxxxx-uc.a.run.app
```

Replace with your actual Cloud Run URL from Step 4 above.

### Step 5: Deploy Frontend

**Option A: Using PowerShell Script (Recommended)**

```powershell
cd frontend
.\deploy-firebase.ps1
```

**Option B: Manual Deployment**

```powershell
cd frontend

# Build the frontend
npm run build

# Deploy to Firebase
firebase deploy --only hosting
```

### Step 6: Access Your App

Firebase will show you the hosting URL:
```
Hosting URL: https://your-project-id.web.app
```

## Quick Deployment Commands

### Full Deployment (Both Backend and Frontend)

```powershell
# 1. Deploy backend
cd backend
.\deploy-cloudrun.ps1

# 2. Copy the backend URL shown in output
# 3. Update frontend/.env.production with the URL

# 4. Deploy frontend
cd ..\frontend
.\deploy-firebase.ps1
```

## Cost Estimation

### Free Tier Limits

**Cloud Run (Backend):**
- 2 million requests/month
- 360,000 GB-seconds of memory
- 180,000 vCPU-seconds
- 1GB egress per month

**Firebase Hosting (Frontend):**
- 10GB storage
- 360MB/day data transfer

### Expected Costs for ~1000 daily users:
- **Cloud Run**: $0-5/month (likely stays in free tier)
- **Firebase Hosting**: $0 (within free tier)

## Monitoring and Management

### View Backend Logs

```powershell
gcloud run services logs read omegle-backend --region=us-central1
```

### View Firebase Hosting

```powershell
firebase hosting:channel:list
```

### Update Backend

```powershell
# After making changes to backend code:
cd backend

# Build new Docker image
docker build -t utkarsh2568/omegle-backend:v1.2 .
docker push utkarsh2568/omegle-backend:v1.2

# Deploy updated image
gcloud run deploy omegle-backend \
  --image=utkarsh2568/omegle-backend:v1.2 \
  --region=us-central1
```

### Update Frontend

```powershell
cd frontend
npm run build
firebase deploy --only hosting
```

## Custom Domain (Optional)

### Add Custom Domain to Firebase Hosting

1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project → Hosting
3. Click "Add custom domain"
4. Follow the DNS configuration steps

### Add Custom Domain to Cloud Run

```powershell
# Map custom domain
gcloud run domain-mappings create \
  --service=omegle-backend \
  --domain=api.yourdomain.com \
  --region=us-central1
```

Then update DNS:
```
CNAME api → ghs.googlehosted.com
```

## Troubleshooting

### Backend not connecting

1. Check Cloud Run service is running:
   ```powershell
   gcloud run services describe omegle-backend --region=us-central1
   ```

2. Check logs for errors:
   ```powershell
   gcloud run services logs read omegle-backend --region=us-central1 --limit=50
   ```

3. Verify CORS settings in backend allow your Firebase domain

### Frontend build fails

```powershell
# Clear cache and reinstall
rm -rf node_modules
rm -rf dist
npm install
npm run build
```

### Socket.IO connection issues

Update backend `server.js` to allow Firebase domain:
```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'https://your-project-id.web.app',
  'https://your-project-id.firebaseapp.com'
];
```

## Useful Commands

```powershell
# Check Cloud Run services
gcloud run services list

# Delete Cloud Run service
gcloud run services delete omegle-backend --region=us-central1

# View Firebase projects
firebase projects:list

# Check Firebase hosting sites
firebase hosting:sites:list

# Rollback Firebase deployment
firebase hosting:rollback
```

## Environment Variables Reference

### Frontend (.env.production)
```env
VITE_SOCKET_URL=https://your-backend-url.run.app
```

### Backend (Cloud Run)
```
NODE_ENV=production
PORT=3001
```

## Next Steps

1. ✅ Backend deployed to Cloud Run
2. ✅ Frontend deployed to Firebase Hosting
3. 🔧 Test the application thoroughly
4. 🌐 (Optional) Add custom domain
5. 📊 Set up monitoring and alerts
6. 🔒 Configure HTTPS and security headers
7. 🚀 Share your app!

## Support

- Firebase Docs: https://firebase.google.com/docs/hosting
- Cloud Run Docs: https://cloud.google.com/run/docs
- Socket.IO on Cloud Run: https://socket.io/docs/v4/

---

**Ready to deploy?** Run these commands:

```powershell
# 1. Deploy backend
cd backend
.\deploy-cloudrun.ps1

# 2. Deploy frontend
cd ..\frontend
.\deploy-firebase.ps1
```
