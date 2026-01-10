# Manual AWS Deployment Guide (No CLI Needed)

## Your Docker Image is Ready! 🎉
**Image:** `utkarsh2568/omegle-backend:v1.1`

## Easiest Method: AWS App Runner (Web Console)

### Step 1: Go to AWS App Runner
1. Login to AWS Console: https://console.aws.amazon.com/
2. Search for "App Runner" in the top search bar
3. Click "App Runner" service

### Step 2: Create Service
1. Click **"Create service"** button
2. Choose **"Container registry"** → **"Public image repository"**
3. Enter:
   - **Repository type:** Public
   - **Image URI:** `docker.io/utkarsh2568/omegle-backend:v1.1`
   - **Deployment trigger:** Manual
4. Click **"Next"**

### Step 3: Configure Service
1. **Service name:** `omegle-backend`
2. **Virtual CPU:** 1 vCPU
3. **Memory:** 2 GB
4. **Port:** `3001`
5. **Environment variables:** Add these:
   - Key: `NODE_ENV`, Value: `production`
   - Key: `PORT`, Value: `3001`
6. Click **"Next"**

### Step 4: Review & Create
1. Review your settings
2. Click **"Create & deploy"**
3. Wait 3-5 minutes for deployment

### Step 5: Get Your URL
1. Once status shows "Running"
2. Copy the **Default domain** URL (looks like: `https://xxxxx.us-east-1.awsapprunner.com`)
3. Test it by visiting: `https://your-url/stats`

### Step 6: Update Frontend
1. Open `frontend/.env.production`
2. Set: `VITE_SOCKET_URL=https://your-app-runner-url`
3. Rebuild and deploy frontend

---

## Alternative: AWS EC2 (For More Control)

### Step 1: Launch EC2 Instance
1. Go to https://console.aws.amazon.com/ec2/
2. Click **"Launch Instance"**
3. Choose:
   - **Name:** `omegle-backend`
   - **AMI:** Amazon Linux 2023
   - **Instance type:** t3.micro (or t2.micro for free tier)
   - **Key pair:** Create new or use existing
   - **Security group:** Allow ports 22 (SSH) and 3001 (App)

### Step 2: Connect to Instance
1. Wait for instance to start
2. Click **"Connect"** button
3. Use **"EC2 Instance Connect"** (browser-based)

### Step 3: Install Docker & Run Container
Run these commands in the terminal:
```bash
# Update system
sudo yum update -y

# Install Docker
sudo yum install -y docker

# Start Docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# Pull and run your image
docker pull utkarsh2568/omegle-backend:v1.1
docker run -d -p 3001:3001 --name omegle-backend --restart unless-stopped utkarsh2568/omegle-backend:v1.1

# Check if running
docker ps
docker logs omegle-backend
```

### Step 4: Get Public IP
1. Go back to EC2 console
2. Copy your instance's **Public IPv4 address**
3. Your backend is at: `http://YOUR-IP:3001`

### Step 5: Update Frontend
1. Edit `frontend/.env.production`:
   ```
   VITE_SOCKET_URL=http://YOUR-IP:3001
   ```

---

## Cost Estimate

| Service | Monthly Cost |
|---------|-------------|
| App Runner (1 vCPU, 2GB) | ~$25 |
| EC2 t3.micro | ~$10 |
| EC2 t2.micro (Free Tier) | $0 first year |

---

## Monitoring Your Deployment

### App Runner:
- Console: https://console.aws.amazon.com/apprunner/
- Logs: Available in the "Logs" tab
- Metrics: CPU, Memory, Requests

### EC2:
- Console: https://console.aws.amazon.com/ec2/
- SSH: `ssh -i your-key.pem ec2-user@YOUR-IP`
- Logs: `docker logs omegle-backend`

---

## Troubleshooting

### App Runner Issues:
- **"Failed to start":** Check logs in App Runner console
- **Can't connect:** Wait 5 minutes, service might still be starting
- **502 Bad Gateway:** Container isn't listening on correct port

### EC2 Issues:
- **Can't SSH:** Check security group allows port 22
- **Can't access app:** Check security group allows port 3001
- **Container not running:** Run `docker ps -a` and `docker logs omegle-backend`

---

## Next Steps After Deployment

1. ✅ Test backend: `curl https://your-url/stats`
2. ✅ Update frontend environment variables
3. ✅ Deploy frontend to Netlify/Vercel
4. ✅ Update CORS: Set `FRONTEND_URL` environment variable
5. ✅ (Optional) Set up custom domain
6. ✅ (Optional) Enable auto-scaling

---

## Need Help?

- AWS Free Tier: https://aws.amazon.com/free/
- App Runner Docs: https://docs.aws.amazon.com/apprunner/
- EC2 Tutorial: https://docs.aws.amazon.com/ec2/

Your Docker image is ready and public - just follow the steps above! 🚀
