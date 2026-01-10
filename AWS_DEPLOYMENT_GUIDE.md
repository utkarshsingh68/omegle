# 🚀 Complete AWS Deployment Guide for ChatClone

This guide will walk you through deploying your Omegle Clone project on AWS step by step.

---

## 📋 Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [AWS Account Setup](#2-aws-account-setup)
3. [Backend Deployment on EC2](#3-backend-deployment-on-ec2)
4. [Frontend Deployment on S3 + CloudFront](#4-frontend-deployment-on-s3--cloudfront)
5. [Domain Setup with Route 53](#5-domain-setup-with-route-53-optional)
6. [SSL Certificate Setup](#6-ssl-certificate-setup)
7. [Final Configuration](#7-final-configuration)
8. [Monitoring & Maintenance](#8-monitoring--maintenance)

---

## 1. Prerequisites

### On Your Local Machine

Before starting, ensure you have:

```powershell
# Check Node.js version (need 18+)
node --version

# Check npm version
npm --version

# Install AWS CLI
# Download from: https://awscli.amazonaws.com/AWSCLIV2.msi
# After installation, verify:
aws --version
```

### Project Preparation

1. **Build the frontend for production:**

```powershell
cd "c:\Users\utkarsh\Desktop\New folder (5)\omegle-clone\frontend"
npm run build
```

This creates a `dist` folder with production-ready files.

2. **Update backend for production:**

Create/update `backend/.env.production`:
```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-domain.com
```

---

## 2. AWS Account Setup

### Step 2.1: Create AWS Account

1. Go to **https://aws.amazon.com/**
2. Click **"Create an AWS Account"**
3. Enter your email and create a password
4. Choose **"Personal"** account type
5. Enter billing information (credit/debit card required)
6. Verify phone number
7. Select **"Basic Support - Free"** plan
8. Complete sign-up

### Step 2.2: Secure Your Account

1. Sign in to **AWS Console**: https://console.aws.amazon.com/
2. Search for **"IAM"** in the search bar
3. Click **"IAM"** (Identity and Access Management)

#### Enable MFA (Multi-Factor Authentication):
1. In IAM Dashboard, click **"Add MFA"** under Security Recommendations
2. Choose **"Authenticator app"**
3. Scan QR code with Google Authenticator or Authy
4. Enter two consecutive codes
5. Click **"Add MFA"**

#### Create IAM User (Don't use root account):
1. Go to **IAM → Users → Create user**
2. User name: `admin-user`
3. Check **"Provide user access to the AWS Management Console"**
4. Select **"I want to create an IAM user"**
5. Set a password
6. Click **Next**
7. Select **"Attach policies directly"**
8. Check **"AdministratorAccess"**
9. Click **Next → Create user**
10. **SAVE** the sign-in URL, username, and password!

### Step 2.3: Configure AWS CLI

```powershell
# Create access keys for CLI
# Go to: IAM → Users → admin-user → Security credentials → Create access key
# Choose "Command Line Interface (CLI)"
# Download the CSV file!

# Configure AWS CLI
aws configure
```

Enter when prompted:
```
AWS Access Key ID: [paste from CSV]
AWS Secret Access Key: [paste from CSV]
Default region name: ap-south-1    # Mumbai (choose closest to your users)
Default output format: json
```

---

## 3. Backend Deployment on EC2

### Step 3.1: Launch EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**

2. **Name and tags:**
   - Name: `chatclone-backend`

3. **Application and OS Images:**
   - Select **Ubuntu Server 22.04 LTS (Free tier eligible)**
   - Architecture: **64-bit (x86)**

4. **Instance type:**
   - Select **t2.micro** (Free tier eligible) or **t3.small** for better performance

5. **Key pair (login):**
   - Click **"Create new key pair"**
   - Key pair name: `chatclone-key`
   - Key pair type: **RSA**
   - Private key format: **.pem**
   - Click **Create key pair**
   - **SAVE THE .pem FILE SECURELY!** (e.g., `C:\Users\utkarsh\.ssh\chatclone-key.pem`)

6. **Network settings → Click "Edit":**
   - VPC: default
   - Subnet: No preference
   - Auto-assign public IP: **Enable**
   - **Create security group:**
     - Security group name: `chatclone-sg`
     - Description: `Security group for ChatClone`
   
   **Add the following rules:**
   
   | Type | Port Range | Source | Description |
   |------|------------|--------|-------------|
   | SSH | 22 | My IP | SSH access |
   | Custom TCP | 3001 | 0.0.0.0/0 | Backend API |
   | HTTP | 80 | 0.0.0.0/0 | HTTP access |
   | HTTPS | 443 | 0.0.0.0/0 | HTTPS access |

7. **Configure storage:**
   - 20 GB gp3 (or gp2)

8. Click **"Launch instance"**

### Step 3.2: Allocate Elastic IP (Static IP)

1. Go to **EC2 → Elastic IPs → Allocate Elastic IP address**
2. Click **Allocate**
3. Select the new Elastic IP → **Actions → Associate Elastic IP address**
4. Instance: Select `chatclone-backend`
5. Click **Associate**
6. **Note this IP address!** (e.g., `13.234.xxx.xxx`)

### Step 3.3: Connect to EC2 Instance

**On Windows (PowerShell):**

```powershell
# Navigate to where your key is
cd C:\Users\utkarsh\.ssh

# Set correct permissions for the key file
icacls chatclone-key.pem /inheritance:r
icacls chatclone-key.pem /grant:r "$($env:USERNAME):(R)"

# Connect to EC2 (replace with your Elastic IP)
ssh -i chatclone-key.pem ubuntu@YOUR_ELASTIC_IP
```

**Example:**
```powershell
ssh -i chatclone-key.pem ubuntu@13.234.123.45
```

Type `yes` when asked about fingerprint.

### Step 3.4: Setup Server Environment

Run these commands on the EC2 instance:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version

# Install PM2 (Process Manager)
sudo npm install -g pm2

# Install Nginx (Reverse Proxy)
sudo apt install -y nginx

# Install Git
sudo apt install -y git

# Create app directory
sudo mkdir -p /var/www/chatclone-backend
sudo chown -R ubuntu:ubuntu /var/www/chatclone-backend
```

### Step 3.5: Upload Backend Code

**Option A: Using Git (Recommended)**

If your code is on GitHub:

```bash
# On EC2
cd /var/www
git clone https://github.com/YOUR_USERNAME/omegle-clone.git chatclone
cd chatclone/backend
npm install --production
```

**Option B: Using SCP (Direct Upload)**

On your Windows machine:

```powershell
# First, create a zip of the backend
cd "c:\Users\utkarsh\Desktop\New folder (5)\omegle-clone"
Compress-Archive -Path backend\* -DestinationPath backend.zip -Force

# Upload to EC2
scp -i C:\Users\utkarsh\.ssh\chatclone-key.pem backend.zip ubuntu@YOUR_ELASTIC_IP:/var/www/chatclone-backend/
```

On EC2:

```bash
cd /var/www/chatclone-backend
unzip backend.zip
rm backend.zip
npm install --production
```

### Step 3.6: Configure Environment Variables

```bash
# Create production environment file
nano /var/www/chatclone-backend/.env
```

Add these contents:
```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-cloudfront-url.cloudfront.net
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

### Step 3.7: Start Backend with PM2

```bash
cd /var/www/chatclone-backend

# Start the application
pm2 start server.js --name "chatclone-backend"

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Copy and run the command it gives you!
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Verify it's running
pm2 status
pm2 logs chatclone-backend
```

### Step 3.8: Configure Nginx as Reverse Proxy

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/chatclone
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name YOUR_ELASTIC_IP;  # Replace with your Elastic IP or domain

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket support
        proxy_read_timeout 86400;
    }
}
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/chatclone /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### Step 3.9: Test Backend

```bash
# Check if backend is running
curl http://localhost:3001

# From your browser, visit:
# http://YOUR_ELASTIC_IP
```

---

## 4. Frontend Deployment on S3 + CloudFront

### Step 4.1: Create S3 Bucket

1. Go to **AWS Console → S3 → Create bucket**

2. **Bucket name:** `chatclone-frontend-YOUR_UNIQUE_ID`
   - Example: `chatclone-frontend-2026`
   - Must be globally unique!

3. **AWS Region:** Same as your EC2 (e.g., ap-south-1)

4. **Object Ownership:** ACLs disabled (recommended)

5. **Block Public Access settings:**
   - **UNCHECK** "Block all public access"
   - Check the acknowledgment box

6. Click **Create bucket**

### Step 4.2: Enable Static Website Hosting

1. Click on your bucket name
2. Go to **Properties** tab
3. Scroll to **"Static website hosting"** → Click **Edit**
4. Select **Enable**
5. Index document: `index.html`
6. Error document: `index.html`
7. Click **Save changes**
8. **Note the Bucket website endpoint!**

### Step 4.3: Add Bucket Policy

1. Go to **Permissions** tab
2. Scroll to **Bucket policy** → Click **Edit**
3. Add this policy (replace YOUR_BUCKET_NAME):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
        }
    ]
}
```

4. Click **Save changes**

### Step 4.4: Update Frontend Configuration

Before building, update the backend URL:

**Edit `frontend/src/hooks/useSocket.js`:**

Find and update the SERVER_URL:
```javascript
const SERVER_URL = 'https://YOUR_ELASTIC_IP';  // or your domain
// For production with HTTPS, use your domain
```

### Step 4.5: Build Frontend for Production

```powershell
cd "c:\Users\utkarsh\Desktop\New folder (5)\omegle-clone\frontend"

# Build for production
npm run build
```

### Step 4.6: Upload to S3

**Option A: Using AWS CLI**

```powershell
# Upload dist folder to S3
aws s3 sync dist/ s3://YOUR_BUCKET_NAME/ --delete

# Example:
aws s3 sync dist/ s3://chatclone-frontend-2026/ --delete
```

**Option B: Using AWS Console**

1. Go to your S3 bucket
2. Click **Upload**
3. Drag all files from the `dist` folder
4. Click **Upload**

### Step 4.7: Create CloudFront Distribution

1. Go to **AWS Console → CloudFront → Create distribution**

2. **Origin:**
   - Origin domain: Select your S3 bucket from dropdown
   - **IMPORTANT:** Use the S3 website endpoint, not the bucket name
     - Format: `YOUR_BUCKET_NAME.s3-website-REGION.amazonaws.com`

3. **Default cache behavior:**
   - Viewer protocol policy: **Redirect HTTP to HTTPS**
   - Allowed HTTP methods: **GET, HEAD**
   - Cache policy: **CachingOptimized**

4. **Settings:**
   - Price class: Choose based on your audience
   - Default root object: `index.html`

5. Click **Create distribution**

6. **Wait 5-10 minutes** for deployment

7. **Note the Distribution domain name!** (e.g., `d1234abcd.cloudfront.net`)

### Step 4.8: Configure Error Pages for SPA

1. Go to your CloudFront distribution
2. Click **Error pages** tab
3. Click **Create custom error response**
4. Configure:
   - HTTP error code: **403**
   - Customize error response: **Yes**
   - Response page path: `/index.html`
   - HTTP response code: **200**
5. Click **Create**
6. Repeat for error code **404**

---

## 5. Domain Setup with Route 53 (Optional)

If you have a domain name:

### Step 5.1: Register or Transfer Domain

1. Go to **AWS Console → Route 53**
2. **Register domain** or **Transfer domain**
3. Follow the wizard to complete registration

### Step 5.2: Create Hosted Zone

1. Go to **Route 53 → Hosted zones → Create hosted zone**
2. Domain name: `your-domain.com`
3. Type: **Public hosted zone**
4. Click **Create hosted zone**

### Step 5.3: Create DNS Records

**For Frontend (CloudFront):**
1. Click **Create record**
2. Record name: `www` (or leave blank for root)
3. Record type: **A**
4. Toggle **Alias** to ON
5. Route traffic to: **Alias to CloudFront distribution**
6. Select your distribution
7. Click **Create records**

**For Backend (EC2):**
1. Click **Create record**
2. Record name: `api`
3. Record type: **A**
4. Toggle **Alias** OFF
5. Value: Your EC2 Elastic IP
6. Click **Create records**

---

## 6. SSL Certificate Setup

### Step 6.1: Request Certificate for CloudFront

**IMPORTANT:** CloudFront certificates MUST be in **us-east-1** region!

1. Go to **AWS Console → Certificate Manager**
2. **Switch region to US East (N. Virginia) us-east-1**
3. Click **Request a certificate**
4. Select **Request a public certificate**
5. Domain names:
   - `your-domain.com`
   - `www.your-domain.com`
6. Validation method: **DNS validation**
7. Click **Request**
8. Click **Create records in Route 53**
9. Wait for validation (5-30 minutes)

### Step 6.2: Attach Certificate to CloudFront

1. Go to **CloudFront → Your distribution → Edit**
2. **Settings:**
   - Alternate domain names (CNAMEs): Add your domains
   - Custom SSL certificate: Select your certificate
3. Click **Save changes**

### Step 6.3: SSL for Backend (EC2)

On your EC2 instance:

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d api.your-domain.com

# Follow the prompts
# Choose to redirect HTTP to HTTPS when asked

# Verify auto-renewal
sudo certbot renew --dry-run
```

---

## 7. Final Configuration

### Step 7.1: Update Backend CORS

On EC2, edit the environment file:

```bash
nano /var/www/chatclone-backend/.env
```

Update:
```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://www.your-domain.com
# Or if using CloudFront URL:
# FRONTEND_URL=https://d1234abcd.cloudfront.net
```

Restart the backend:
```bash
pm2 restart chatclone-backend
```

### Step 7.2: Update Frontend Backend URL

Update `frontend/src/hooks/useSocket.js`:

```javascript
const SERVER_URL = import.meta.env.PROD 
  ? 'https://api.your-domain.com'  // or https://YOUR_ELASTIC_IP
  : 'http://localhost:3001';
```

Rebuild and redeploy:
```powershell
cd "c:\Users\utkarsh\Desktop\New folder (5)\omegle-clone\frontend"
npm run build
aws s3 sync dist/ s3://YOUR_BUCKET_NAME/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

### Step 7.3: Test Everything

1. Visit your CloudFront URL or domain
2. Check that WebSocket connects
3. Test video chat functionality
4. Test text chat
5. Test all features

---

## 8. Monitoring & Maintenance

### View Backend Logs

```bash
# SSH into EC2
ssh -i chatclone-key.pem ubuntu@YOUR_ELASTIC_IP

# View PM2 logs
pm2 logs chatclone-backend

# View last 100 lines
pm2 logs chatclone-backend --lines 100

# Monitor in real-time
pm2 monit
```

### Update Application

```bash
# SSH into EC2
cd /var/www/chatclone-backend

# Pull latest code (if using Git)
git pull origin main
npm install --production

# Restart
pm2 restart chatclone-backend
```

### Useful PM2 Commands

```bash
pm2 status          # Check status
pm2 restart all     # Restart all apps
pm2 stop all        # Stop all apps
pm2 delete all      # Delete all apps
pm2 logs            # View logs
pm2 monit           # Monitor dashboard
```

### CloudWatch Monitoring

1. Go to **AWS Console → CloudWatch**
2. Set up alarms for:
   - EC2 CPU utilization
   - EC2 network traffic
   - CloudFront requests
   - S3 bucket size

---

## 💰 Cost Estimation (Monthly)

| Service | Free Tier | After Free Tier |
|---------|-----------|-----------------|
| EC2 t2.micro | 750 hrs/month (1 year) | ~$8-10/month |
| Elastic IP | Free when attached | $3.65/month if not attached |
| S3 | 5GB free | ~$0.023/GB |
| CloudFront | 1TB free (1 year) | ~$0.085/GB |
| Route 53 | - | $0.50/hosted zone |
| Data Transfer | 100GB free | ~$0.09/GB |

**Estimated Total:** $0-15/month during free tier, $15-30/month after

---

## 🔧 Troubleshooting

### Backend not accessible?
```bash
# Check if PM2 is running
pm2 status

# Check Nginx status
sudo systemctl status nginx

# Check security group allows port 80/443
# AWS Console → EC2 → Security Groups
```

### WebSocket not connecting?
1. Ensure security group allows port 3001
2. Check Nginx WebSocket configuration
3. Verify CORS settings in backend

### Frontend not loading?
1. Check S3 bucket policy
2. Verify CloudFront distribution status
3. Check error pages configuration

### SSL certificate issues?
1. Ensure certificate is validated
2. CloudFront cert must be in us-east-1
3. Wait for DNS propagation (up to 48 hours)

---

## 📞 Support

If you encounter issues:
1. Check CloudWatch logs
2. Check PM2 logs on EC2
3. Check browser console for errors
4. Verify all security group rules

---

**🎉 Congratulations! Your ChatClone is now live on AWS!**
