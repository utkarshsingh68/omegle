# AWS Lightsail Deployment Guide

## Why Lightsail?
- 💰 **FREE for 3 months** (trial)
- 💰 Then only **$7/month** (cheapest AWS option)
- ✅ HTTPS included
- ✅ Simpler than EC2
- ✅ No sleep/downtime

---

## Quick Deploy

### Option 1: Using PowerShell Script (Recommended)

```powershell
cd backend
.\deploy-apprunner.ps1
```

**Note:** File is named `deploy-apprunner.ps1` but now deploys to Lightsail!

---

### Option 2: Manual via Lightsail Console

1. **Go to Lightsail Console:**
   https://lightsail.aws.amazon.com/

2. **Create Container Service:**
   - Click **"Containers"** in the left menu
   - Click **"Create container service"**
   - Choose region: **US East (N. Virginia)**
   - Choose power: **Nano** (FREE for 3 months, then $7/month)
   - Choose scale: **1**
   - Click **"Next"**

3. **Configure Deployment:**
   - **Container name:** `app`
   - **Image:** `utkarsh2568/omegle-backend:v1.1`
   - **Add open ports:** `3001`
   - Protocol: **HTTP**
   
4. **Add Environment Variables:**
   - `NODE_ENV` = `production`
   - `PORT` = `3001`

5. **Public Endpoint:**
   - **Container name:** `app`
   - **Port:** `3001`

6. **Service Name:**
   - Enter: `omegle-backend`

7. **Create Service:**
   - Click **"Create container service"**
   - Wait 3-5 minutes

8. **Get Your URL:**
   - Copy the public domain (like: `omegle-backend.xxxx.us-east-1.cs.amazonlightsail.com`)
   - Your backend is at: `https://your-domain`

---

## Option 3: Using AWS CLI Commands

```powershell
# Install AWS CLI (if not installed)
winget install Amazon.AWSCLI

# Configure AWS
aws configure

# Create container service
aws lightsail create-container-service `
  --service-name omegle-backend `
  --power nano `
  --scale 1 `
  --region us-east-1

# Wait 30 seconds for service to initialize
Start-Sleep -Seconds 30

# Deploy container
aws lightsail create-container-service-deployment `
  --service-name omegle-backend `
  --containers '{
    "app": {
      "image": "utkarsh2568/omegle-backend:v1.1",
      "ports": {
        "3001": "HTTP"
      },
      "environment": {
        "NODE_ENV": "production",
        "PORT": "3001"
      }
    }
  }' `
  --public-endpoint '{
    "containerName": "app",
    "containerPort": 3001,
    "healthCheck": {
      "path": "/",
      "intervalSeconds": 30
    }
  }' `
  --region us-east-1

# Get service URL
aws lightsail get-container-services `
  --service-name omegle-backend `
  --region us-east-1 `
  --query "containerServices[0].url" `
  --output text
```

---

## Pricing Breakdown

| Service | Free Trial | After Trial | Sleep? |
|---------|------------|-------------|--------|
| **Lightsail Nano** | 3 months FREE | $7/month | Never |
| App Runner | No | $25/month | Never |
| Render.com | Forever | Free forever | After 15min |
| EC2 t2.micro | 12 months | $10/month | Never |

**Lightsail Nano Specs:**
- 512 MB RAM
- 0.25 vCPU
- Perfect for small apps
- Handles ~100 concurrent users

---

## Update Your Frontend

After deployment, update frontend:

```bash
cd ../frontend

# Create production env file
echo "VITE_SOCKET_URL=https://your-lightsail-url" > .env.production

# Build
npm run build
```

---

## Managing Your Lightsail Service

### View Logs:
```powershell
aws lightsail get-container-log `
  --service-name omegle-backend `
  --container-name app `
  --region us-east-1
```

### Update Deployment:
Just push new Docker image and redeploy:
```powershell
# Push new version
docker tag omegle-backend utkarsh2568/omegle-backend:v1.2
docker push utkarsh2568/omegle-backend:v1.2

# Update Lightsail (change image version in deployment command)
```

### Delete Service:
```powershell
aws lightsail delete-container-service `
  --service-name omegle-backend `
  --region us-east-1
```

Or use web console: https://lightsail.aws.amazon.com/

---

## Troubleshooting

### "Service already exists"
Delete it first:
```powershell
aws lightsail delete-container-service --service-name omegle-backend --region us-east-1
```
Wait 2 minutes, then try again.

### "Deployment failed"
Check logs:
```powershell
aws lightsail get-container-log --service-name omegle-backend --container-name app --region us-east-1
```

### Can't access backend
- Wait 5 minutes after deployment
- Check if port 3001 is exposed
- Verify environment variables are set

---

## Cost Calculator

**3 months FREE**, then:
- Month 4+: $7/month
- Per year: $84/year

**Compare with alternatives:**
- App Runner: $300/year
- EC2 t3.micro: $120/year
- Render.com: $0/year (with sleep)

---

## Next Steps

1. ✅ Deploy backend to Lightsail
2. ✅ Get your backend URL
3. ✅ Update frontend VITE_SOCKET_URL
4. ✅ Deploy frontend to Netlify/Vercel (free)
5. ✅ Test your app!

---

## Support Links

- Lightsail Console: https://lightsail.aws.amazon.com/
- Lightsail Pricing: https://aws.amazon.com/lightsail/pricing/
- Documentation: https://docs.aws.amazon.com/lightsail/
