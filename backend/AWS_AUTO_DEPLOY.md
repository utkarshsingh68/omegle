# Automatic AWS Deployment Guide

This guide explains how to automatically deploy your Omegle backend to AWS using the provided scripts.

## Prerequisites

1. **AWS Account**: Create one at [aws.amazon.com](https://aws.amazon.com)
2. **AWS CLI**: Install from [aws.amazon.com/cli](https://aws.amazon.com/cli/)
3. **Configure AWS CLI**:
   ```bash
   aws configure
   ```
   Enter your:
   - AWS Access Key ID
   - AWS Secret Access Key
   - Default region (e.g., `us-east-1`)
   - Default output format: `json`

## Deployment Methods

The script provides 3 deployment options:

### Option 1: AWS App Runner (Recommended - Simplest)
- ✅ Fully managed service
- ✅ Automatic scaling
- ✅ HTTPS included
- ✅ No server management
- 💰 Cost: ~$25/month (2GB RAM)

### Option 2: AWS ECS Fargate (More Control)
- ✅ Container orchestration
- ✅ Custom networking
- ✅ Integration with AWS services
- 💰 Cost: ~$15/month (1GB RAM)

### Option 3: AWS EC2 (Full Control)
- ✅ Complete control
- ✅ Can SSH into server
- ✅ Customize everything
- 💰 Cost: ~$10/month (t3.micro)

## Quick Start

### On Linux/Mac:
```bash
cd backend
chmod +x aws-deploy.sh
./aws-deploy.sh
```

### On Windows (PowerShell):
```powershell
cd backend
bash aws-deploy.sh
# Or use WSL/Git Bash
```

### On Windows (Manual AWS CLI):

#### Deploy to App Runner:
```powershell
aws apprunner create-service `
  --service-name omegle-backend `
  --source-configuration '{\"ImageRepository\": {\"ImageIdentifier\": \"utkarsh2568/omegle-backend:v1.1\", \"ImageRepositoryType\": \"ECR_PUBLIC\", \"ImageConfiguration\": {\"Port\": \"3001\"}}}' `
  --instance-configuration '{\"Cpu\": \"1024\", \"Memory\": \"2048\"}' `
  --region us-east-1
```

Get the URL:
```powershell
aws apprunner list-services --region us-east-1
```

## Step-by-Step Process

1. **Run the deployment script**:
   ```bash
   ./aws-deploy.sh
   ```

2. **Choose deployment method** (1, 2, or 3)

3. **Wait for deployment** (2-5 minutes)

4. **Get your backend URL**:
   - **App Runner**: `https://xxxxxx.us-east-1.awsapprunner.com`
   - **ECS/EC2**: `http://XX.XX.XX.XX:3001`

5. **Update frontend**:
   ```bash
   cd ../frontend
   echo "VITE_SOCKET_URL=https://your-backend-url" > .env.production
   ```

6. **Set CORS in backend**:
   - App Runner: Add environment variable `FRONTEND_URL=https://your-frontend-url`
   - EC2: SSH and run `docker exec omegle-backend sh -c "export FRONTEND_URL=..."`

## Environment Variables

Add these in AWS Console or script:

| Variable | Value | Required |
|----------|-------|----------|
| `NODE_ENV` | `production` | Yes |
| `PORT` | `3001` | Yes |
| `FRONTEND_URL` | Your frontend URL | For CORS |

## Monitoring

### View Logs:
```bash
# App Runner
aws apprunner list-operations --service-arn <YOUR_SERVICE_ARN> --region us-east-1

# ECS
aws logs tail /ecs/omegle-backend --follow --region us-east-1

# EC2
ssh -i omegle-backend-key.pem ec2-user@<PUBLIC_IP>
docker logs omegle-backend -f
```

### CloudWatch Dashboard:
Visit: https://console.aws.amazon.com/cloudwatch/

## Updating Deployment

When you update your Docker image:

1. **Push new version**:
   ```bash
   docker build -t omegle-backend .
   docker tag omegle-backend:latest utkarsh2568/omegle-backend:v1.2
   docker push utkarsh2568/omegle-backend:v1.2
   ```

2. **Update deployment**:
   
   **App Runner** (auto-updates):
   - Automatically deploys new versions from Docker Hub
   
   **ECS Fargate**:
   ```bash
   aws ecs update-service \
     --cluster omegle-backend-cluster \
     --service omegle-backend-service \
     --force-new-deployment \
     --region us-east-1
   ```
   
   **EC2**:
   ```bash
   ssh -i omegle-backend-key.pem ec2-user@<PUBLIC_IP>
   docker pull utkarsh2568/omegle-backend:v1.2
   docker stop omegle-backend
   docker rm omegle-backend
   docker run -d -p 3001:3001 --name omegle-backend utkarsh2568/omegle-backend:v1.2
   ```

## Cleanup (Undeploy)

To remove all AWS resources:

```bash
./aws-undeploy.sh
```

Or manually:

**App Runner**:
```bash
aws apprunner delete-service --service-arn <ARN> --region us-east-1
```

**ECS**:
```bash
aws ecs delete-service --cluster omegle-backend-cluster --service omegle-backend-service --force --region us-east-1
aws ecs delete-cluster --cluster omegle-backend-cluster --region us-east-1
```

**EC2**:
```bash
aws ec2 terminate-instances --instance-ids <INSTANCE_ID> --region us-east-1
```

## Custom Domain (Optional)

### For App Runner:
1. Go to App Runner console
2. Click your service → Custom domains
3. Add your domain and create CNAME record

### For EC2/ECS:
1. Create Route 53 hosted zone
2. Add A record pointing to your IP
3. Set up Nginx reverse proxy for HTTPS

## Troubleshooting

### "Access Denied" error:
```bash
# Check AWS credentials
aws sts get-caller-identity

# Reconfigure if needed
aws configure
```

### "Port already in use":
```bash
# Find process
netstat -ano | findstr :3001
# Kill process or use different port
```

### Can't connect to backend:
1. Check security group allows port 3001
2. Verify container is running: `docker ps`
3. Check logs: `docker logs omegle-backend`

### App Runner not starting:
- Ensure Docker image is public on Docker Hub
- Check image runs locally first: `docker run -p 3001:3001 utkarsh2568/omegle-backend:v1.1`

## Cost Optimization

- **App Runner**: Use "Pause and Resume" for dev environments
- **ECS**: Use Spot instances for cost savings
- **EC2**: Use t3.micro (free tier eligible)
- **All**: Set up billing alerts in AWS console

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure `FRONTEND_URL` for CORS
- [ ] Enable HTTPS (App Runner auto-includes)
- [ ] Set up CloudWatch alarms
- [ ] Configure auto-scaling (App Runner/ECS)
- [ ] Set up backup strategy
- [ ] Enable AWS WAF for DDoS protection
- [ ] Configure CloudFront CDN (optional)

## Support

- AWS Documentation: https://docs.aws.amazon.com/
- Docker Hub: https://hub.docker.com/r/utkarsh2568/omegle-backend
- Issues: Check CloudWatch Logs for errors
