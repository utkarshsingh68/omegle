# ======================================
# DEPLOYMENT GUIDE
# Omegle Clone - Anonymous Video Chat
# ======================================

## 🚀 Deployment Options

### Option 1: Render (Backend) + Vercel (Frontend)

This is the RECOMMENDED and FREE option for MVP deployment.

---

## BACKEND DEPLOYMENT (Render.com)

### Step 1: Prepare Backend
```bash
cd backend
```

### Step 2: Create `render.yaml` (already included below)

### Step 3: Deploy to Render
1. Go to https://render.com
2. Connect your GitHub repository
3. Select "New Web Service"
4. Choose the `backend` folder
5. Configure:
   - **Name**: omegle-clone-api
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free

### Step 4: Set Environment Variables
```
PORT=3001
FRONTEND_URL=https://your-frontend-url.vercel.app
NODE_ENV=production
```

---

## FRONTEND DEPLOYMENT (Vercel)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Deploy
```bash
cd frontend
vercel
```

### Step 3: Set Environment Variables in Vercel Dashboard
```
VITE_SOCKET_URL=https://your-backend-url.onrender.com
```

---

## Option 2: Railway (Full Stack)

Railway can host both frontend and backend.

### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

### Step 2: Login and Deploy
```bash
railway login
railway init
railway up
```

---

## Option 3: AWS EC2 (Production)

For production with high traffic:

### Step 1: Launch EC2 Instance
- Ubuntu 22.04 LTS
- t3.medium or larger
- Security group: Allow ports 22, 80, 443, 3001

### Step 2: Install Dependencies
```bash
sudo apt update
sudo apt install -y nodejs npm nginx certbot
```

### Step 3: Clone and Setup
```bash
git clone your-repo
cd omegle-clone/backend
npm install
```

### Step 4: Use PM2 for Process Management
```bash
npm install -g pm2
pm2 start server.js --name "omegle-api"
pm2 save
pm2 startup
```

### Step 5: Configure Nginx as Reverse Proxy
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Step 6: SSL with Let's Encrypt
```bash
sudo certbot --nginx -d api.yourdomain.com
```

---

## 🔄 TURN Server Setup (For Production)

WebRTC needs TURN servers for users behind strict NATs/firewalls.

### Free Options:
- **Metered.ca**: Free tier with 500GB/month
- **Twilio**: Pay-as-you-go

### Self-Hosted (coturn):
```bash
# Install coturn
sudo apt install coturn

# Configure /etc/turnserver.conf
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
user=username:password
realm=yourdomain.com

# Start
sudo systemctl enable coturn
sudo systemctl start coturn
```

### Update WebRTC Config:
```javascript
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'username',
      credential: 'password'
    }
  ]
};
```

---

## 📋 Pre-Deployment Checklist

- [ ] Update CORS origins in backend
- [ ] Set production environment variables
- [ ] Configure TURN server for video reliability
- [ ] Test on multiple browsers
- [ ] Add rate limiting for production
- [ ] Set up monitoring (optional: Sentry, LogRocket)
- [ ] Add privacy policy & terms of service
- [ ] Test mobile responsiveness

---

## 🔒 Security Checklist

- [ ] Enable HTTPS on both frontend and backend
- [ ] Add helmet.js for security headers
- [ ] Implement stricter rate limiting
- [ ] Add IP-based banning for reports
- [ ] Consider adding captcha for abuse prevention
- [ ] Log and monitor for suspicious activity
