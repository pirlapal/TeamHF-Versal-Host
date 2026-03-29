# Complete Deployment Guide for TeamHF

This guide covers deploying TeamHF to production using Vercel (frontend) and Render/Railway (backend).

## Architecture Overview

- **Frontend**: Deployed to Vercel (static React app)
- **Backend**: Deployed to Render or Railway (FastAPI)
- **Database**: MongoDB Atlas (cloud database)

## Prerequisites

1. GitHub account (you already have the repo: https://github.com/pirlapal/TeamHF-Versal-Host)
2. Vercel account (free Hobby plan)
3. Render or Railway account (free tier available)
4. MongoDB Atlas account (free tier available)

---

## Part 1: Set Up MongoDB Atlas

### Step 1: Create MongoDB Cluster

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up or log in
3. Click **"Build a Database"**
4. Choose **"M0 FREE"** tier
5. Select a cloud provider and region (choose one close to your users)
6. Click **"Create Cluster"**

### Step 2: Configure Database Access

1. Go to **"Database Access"** in left sidebar
2. Click **"Add New Database User"**
3. Create username and password (save these!)
4. Set privileges to **"Read and write to any database"**
5. Click **"Add User"**

### Step 3: Configure Network Access

1. Go to **"Network Access"** in left sidebar
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (adds `0.0.0.0/0`)
4. Click **"Confirm"**

### Step 4: Get Connection String

1. Go to **"Database"** in left sidebar
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. Copy the connection string (looks like: `mongodb+srv://username:<password>@cluster.mongodb.net/`)
5. Replace `<password>` with your actual password
6. Replace `<database>` with `hackforge` (or your preferred name)

**Example**: `mongodb+srv://myuser:mypass123@cluster0.abcde.mongodb.net/hackforge?retryWrites=true&w=majority`

---

## Part 2: Deploy Backend to Render

### Step 1: Create Render Account

1. Go to https://render.com/
2. Sign up with GitHub

### Step 2: Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `pirlapal/TeamHF-Versal-Host`
3. Configure the service:
   - **Name**: `teamhf-backend`
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`

### Step 3: Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"** and add:

| Key | Value |
|-----|-------|
| `MONGO_URL` | Your MongoDB Atlas connection string |
| `DB_NAME` | `hackforge` |
| `JWT_SECRET` | Generate with: `openssl rand -hex 32` (run in terminal) |
| `PYTHON_VERSION` | `3.11.0` |

Optional variables:
| Key | Value |
|-----|-------|
| `STRIPE_API_KEY` | Your Stripe key (if using payments) |
| `SENDGRID_API_KEY` | Your SendGrid key (if using email) |
| `HF_TOKEN` | Your Hugging Face token (if using AI) |

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Wait for deployment (takes 5-10 minutes)
3. Once deployed, copy your backend URL (e.g., `https://teamhf-backend.onrender.com`)

---

## Part 3: Deploy Frontend to Vercel

### Step 1: Create Vercel Account

1. Go to https://vercel.com/signup
2. Sign up with GitHub

### Step 2: Import Repository

1. Click **"Add New..."** → **"Project"**
2. Import `pirlapal/TeamHF-Versal-Host`
3. Configure project:
   - **Framework Preset**: Create React App
   - **Root Directory**: `./frontend`
   - **Build Command**: `yarn build`
   - **Output Directory**: `build`
   - **Install Command**: `yarn install`

### Step 3: Add Environment Variables

Add these environment variables:

| Key | Value |
|-----|-------|
| `REACT_APP_BACKEND_URL` | Your Render backend URL (e.g., `https://teamhf-backend.onrender.com`) |

### Step 4: Deploy

1. Click **"Deploy"**
2. Wait for deployment (takes 2-5 minutes)
3. Once deployed, you'll get your frontend URL (e.g., `https://teamhf.vercel.app`)

---

## Part 4: Testing & Configuration

### Test the Application

1. Visit your Vercel URL (e.g., `https://teamhf.vercel.app`)
2. Log in with default admin credentials:
   - Email: `admin@caseflow.io`
   - Password: `admin123`
3. Go to **Admin Settings** → Click **"Seed Demo Data"**
4. Return to Dashboard and verify:
   - All stat cards show data
   - Activity Trend chart displays
   - Recent clients appear

### Common Issues

#### Backend Not Connecting
- Check if backend URL in Vercel environment variables is correct
- Verify backend is running on Render (check logs)
- Test backend API directly: `https://your-backend.onrender.com/api/dashboard/stats` (should return 401 if working)

#### Database Connection Errors
- Verify MongoDB Atlas IP whitelist includes `0.0.0.0/0`
- Check connection string format (username, password, database name)
- Test connection with MongoDB Compass

#### Frontend Not Loading
- Check browser console for errors (F12)
- Verify `REACT_APP_BACKEND_URL` doesn't have trailing slash
- Clear browser cache and hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

---

## Part 5: Custom Domain (Optional)

### Add Custom Domain to Vercel

1. In Vercel dashboard, go to project **Settings** → **Domains**
2. Add your domain (e.g., `app.yourdomain.com`)
3. Update DNS records as shown:
   - Add CNAME record pointing to `cname.vercel-dns.com`
4. Wait for DNS propagation (5-30 minutes)

### Update Environment Variables

After adding custom domain:
1. Update any callback URLs in Stripe, OAuth providers, etc.
2. Test the application on your custom domain

---

## Cost Breakdown

| Service | Plan | Cost |
|---------|------|------|
| **Vercel** | Hobby | **Free** (100GB bandwidth/month) |
| **Render** | Free | **Free** (750 hours/month, sleeps after 15 min inactivity) |
| **MongoDB Atlas** | M0 | **Free** (512MB storage, shared CPU) |
| **Total** | | **$0/month** |

### Upgrading for Production

For production with better performance:
- **Render**: $7/month (no sleep, more resources)
- **MongoDB Atlas**: $9/month (M2 tier, dedicated resources)
- **Vercel**: Free is usually sufficient, Pro is $20/month for teams

---

## Alternative: Deploy Backend to Railway

If you prefer Railway over Render:

1. Go to https://railway.app/
2. Sign up with GitHub
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Select `pirlapal/TeamHF-Versal-Host`
5. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
6. Add environment variables (same as Render)
7. Deploy and get your Railway URL

---

## Maintenance

### Updating the Application

When you push changes to GitHub:
- **Vercel**: Auto-deploys frontend automatically
- **Render/Railway**: Auto-deploys backend automatically

### Monitoring

- **Vercel**: Check Analytics in dashboard
- **Render**: Check Logs and Metrics in dashboard
- **MongoDB Atlas**: Monitor in Metrics section

### Backup

- **MongoDB**: Enable continuous backup in Atlas (paid feature)
- **Code**: GitHub is your version control backup

---

## Support

- **Vercel Support**: https://vercel.com/support
- **Render Support**: https://render.com/docs
- **Railway Support**: https://railway.app/help
- **MongoDB Support**: https://www.mongodb.com/support

## Next Steps

1. ✅ Set up custom domain
2. ✅ Enable SSL (automatic on Vercel/Render)
3. ✅ Configure email notifications (SendGrid)
4. ✅ Set up payment processing (Stripe)
5. ✅ Enable AI features (Hugging Face)
6. ✅ Add monitoring and analytics
7. ✅ Set up regular database backups
