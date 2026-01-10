# Free Deployment Options for Your Backend

Your Docker image `utkarsh2568/omegle-backend:v1.1` is ready! Here are **100% FREE** platforms:

---

## Option 1: Render.com (Recommended - Easiest)

### ✅ Free Tier: 750 hours/month (always free)

### Steps:
1. Go to: https://render.com/
2. Sign up with GitHub (free)
3. Click **"New +"** → **"Web Service"**
4. Choose **"Deploy an existing image from a registry"**
5. Enter:
   - **Image URL:** `docker.io/utkarsh2568/omegle-backend:v1.1`
   - **Name:** `omegle-backend`
   - **Region:** Choose closest to you
   - **Instance Type:** **Free**
6. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `PORT` = `3001`
7. Click **"Create Web Service"**
8. Wait 2-3 minutes
9. Copy your URL: `https://omegle-backend.onrender.com`

### Free Tier Limits:
- ✅ 750 hours/month free
- ⚠️ Sleeps after 15 min inactivity (wakes on request)
- ✅ HTTPS included
- ✅ Auto-deploy on image updates

---

## Option 2: Railway.app

### ✅ Free Tier: $5 credit/month + 500 hours

### Steps:
1. Go to: https://railway.app/
2. Sign up with GitHub
3. Click **"New Project"** → **"Deploy from Docker Image"**
4. Enter: `utkarsh2568/omegle-backend:v1.1`
5. Add variables:
   - `PORT` = `3001`
   - `NODE_ENV` = `production`
6. Click **"Deploy"**
7. Go to Settings → Generate Domain
8. Copy your URL: `https://omegle-backend.up.railway.app`

### Free Tier Limits:
- ✅ $5 credit per month
- ✅ 500 execution hours
- ✅ No credit card required for trial
- ✅ HTTPS included

---

## Option 3: Fly.io

### ✅ Free Tier: 3 VMs, 256MB RAM each

### Steps:
1. Install flyctl:
   ```powershell
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```
2. Close and reopen PowerShell
3. Run:
   ```powershell
   fly auth signup
   fly launch --image utkarsh2568/omegle-backend:v1.1 --name omegle-backend
   ```
4. Choose: Free tier, region, no postgres
5. Deploy:
   ```powershell
   fly deploy
   ```
6. Get URL:
   ```powershell
   fly status
   ```

### Free Tier Limits:
- ✅ 3 shared VMs
- ✅ 160GB bandwidth
- ⚠️ Requires credit card (won't charge if under limits)

---

## Option 4: Koyeb

### ✅ Free Tier: 1 service, always on

### Steps:
1. Go to: https://koyeb.com/
2. Sign up (no credit card needed)
3. Click **"Create Service"**
4. Choose **"Docker"**
5. Enter:
   - **Image:** `utkarsh2568/omegle-backend:v1.1`
   - **Port:** `3001`
6. Add env vars: `NODE_ENV=production`, `PORT=3001`
7. Click **"Deploy"**
8. Copy URL: `https://omegle-backend.koyeb.app`

### Free Tier Limits:
- ✅ 1 web service
- ✅ Always on (no sleep)
- ✅ HTTPS included
- ✅ No credit card required

---

## Comparison Table

| Platform | Setup | Sleep? | Credit Card | HTTPS | Best For |
|----------|-------|--------|-------------|-------|----------|
| **Render** | 5 min | After 15m | No | Yes | Easiest |
| **Railway** | 3 min | No | Trial: No | Yes | Best free tier |
| **Fly.io** | 10 min | No | Yes (no charge) | Yes | Advanced users |
| **Koyeb** | 5 min | No | No | Yes | Always-on free |

---

## My Recommendation: **Render.com**

It's the easiest and truly free with no credit card required!

### Quick Start:
1. https://render.com/ → Sign up
2. New Web Service → Existing Image
3. Paste: `docker.io/utkarsh2568/omegle-backend:v1.1`
4. Select Free tier
5. Deploy!

You'll get: `https://omegle-backend.onrender.com`

---

## After Deployment

Update your frontend:
```bash
cd ../frontend
echo "VITE_SOCKET_URL=https://your-deployment-url" > .env.production
```

Then deploy frontend to:
- **Netlify** (free): https://netlify.com/
- **Vercel** (free): https://vercel.com/
- **GitHub Pages** (free): Build & push to gh-pages branch

---

## Need Help?

- Render Docs: https://render.com/docs/docker
- Railway Docs: https://docs.railway.app/
- Fly.io Docs: https://fly.io/docs/
