# Quick Start: Deploy to Vercel in 10 Minutes

Follow these steps to get TeamHF running on Vercel's Hobby plan (100% FREE).

## 🚀 Step 1: Set Up MongoDB Atlas (3 minutes)

1. **Create account**: https://www.mongodb.com/cloud/atlas/register
2. **Create FREE cluster**: Click "Build a Database" → Choose "M0 FREE"
3. **Create user**:
   - Database Access → Add New User
   - Username: `admin` (or your choice)
   - Password: Create strong password (save it!)
4. **Allow connections**:
   - Network Access → Add IP Address
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
5. **Get connection string**:
   - Database → Connect → Connect your application
   - Copy string like: `mongodb+srv://admin:PASSWORD@cluster0.xxxxx.mongodb.net/`
   - Replace `<password>` with your actual password
   - Add database name: `mongodb+srv://admin:PASSWORD@cluster0.xxxxx.mongodb.net/hackforge`

**Save this connection string!** You'll need it in the next steps.

---

## 🔧 Step 2: Deploy Backend to Render (4 minutes)

### Why separate backend?
Vercel's Hobby plan works best for frontends. For the FastAPI backend, we use Render (also FREE).

1. **Create account**: https://render.com/ (sign up with GitHub)

2. **Create Web Service**:
   - Click "New +" → "Web Service"
   - Connect your repo: `pirlapal/TeamHF-Versal-Host`

3. **Configure**:
   ```
   Name: teamhf-backend
   Region: (choose closest to you)
   Branch: main
   Root Directory: backend
   Runtime: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn server:app --host 0.0.0.0 --port $PORT
   Instance Type: Free
   ```

4. **Add Environment Variables** (Click "Advanced"):

   **Required variables**:
   ```
   MONGO_URL = (paste your MongoDB connection string from Step 1)
   DB_NAME = hackforge
   JWT_SECRET = (generate: run "openssl rand -hex 32" in your terminal)
   PYTHON_VERSION = 3.11.0
   ```

   **Optional variables** (skip for now, add later if needed):
   ```
   STRIPE_API_KEY = (for payments)
   SENDGRID_API_KEY = (for email)
   HF_TOKEN = (for AI features)
   ```

5. **Deploy**: Click "Create Web Service"
   - Wait 5-10 minutes for first deployment
   - Copy your backend URL when ready (e.g., `https://teamhf-backend.onrender.com`)

**Save your backend URL!**

---

## 🎨 Step 3: Deploy Frontend to Vercel (3 minutes)

1. **Create account**: https://vercel.com/signup (sign up with GitHub)

2. **Import project**:
   - Click "Add New..." → "Project"
   - Find and import: `pirlapal/TeamHF-Versal-Host`

3. **Configure**:
   ```
   Framework Preset: Create React App
   Root Directory: frontend
   Build Command: yarn build
   Output Directory: build
   Install Command: yarn install
   ```

4. **Add Environment Variable**:
   - Click "Environment Variables"
   - Add one variable:
     ```
     Name: REACT_APP_BACKEND_URL
     Value: (paste your Render backend URL from Step 2)
     ```
   - **Important**: Remove any trailing slash from the URL

5. **Deploy**: Click "Deploy"
   - Wait 2-5 minutes
   - Copy your Vercel URL (e.g., `https://teamhf.vercel.app`)

---

## ✅ Step 4: Test Your Deployment

1. **Open your Vercel URL** in browser

2. **Login with default admin**:
   ```
   Email: admin@caseflow.io
   Password: admin123
   ```

3. **Seed demo data**:
   - Click "Settings" in sidebar
   - Scroll to "Demo Data"
   - Click "Seed Demo Data"
   - Wait for success message

4. **Check dashboard**:
   - Go back to Dashboard
   - You should see:
     - ✅ Stats cards with numbers (24 clients, 58 services, etc.)
     - ✅ Activity Trend chart with orange bars
     - ✅ Outcome distribution chart
     - ✅ Recent clients list
     - ✅ Upcoming visits

**🎉 Congratulations! Your app is live!**

---

## 🔄 Automatic Updates

Whenever you push to GitHub:
- ✅ Vercel automatically redeploys your frontend
- ✅ Render automatically redeploys your backend

No manual steps needed!

---

## ⚙️ Optional: Custom Domain

### Add Your Domain to Vercel

1. Go to your Vercel project → Settings → Domains
2. Add your domain (e.g., `app.yourdomain.com`)
3. Update DNS:
   - Add CNAME record: `cname.vercel-dns.com`
4. Wait 5-30 minutes for DNS propagation

---

## 🐛 Troubleshooting

### "Cannot connect to backend"
- Check backend is running on Render (green status)
- Verify `REACT_APP_BACKEND_URL` in Vercel has no trailing slash
- Make sure backend URL is correct (copy from Render dashboard)

### "Database connection error"
- Check MongoDB Atlas allows connections from anywhere (0.0.0.0/0)
- Verify connection string in Render has correct password
- Check database name is `hackforge` (or matches your `DB_NAME`)

### Backend sleeps after 15 minutes (Render Free tier)
- First request after inactivity takes ~30 seconds (cold start)
- This is normal for free tier
- Upgrade to Render paid plan ($7/month) to remove sleep

### Activity Trend chart not showing
- Make sure you seeded demo data (Step 4)
- Check browser console (F12) for errors
- Verify all environment variables are set correctly

---

## 💰 Cost

Your deployment is **100% FREE**:
- ✅ Vercel Hobby: FREE (100GB bandwidth/month)
- ✅ Render Free: FREE (750 hours/month)
- ✅ MongoDB Atlas M0: FREE (512MB storage)

**Total: $0/month**

---

## 📚 Next Steps

1. Change default admin password (for security)
2. Set up custom domain
3. Add team members (Admin Settings → Users)
4. Configure email notifications (optional)
5. Enable payment processing with Stripe (optional)
6. Enable AI features with Hugging Face (optional)

---

## 📞 Need Help?

- **Full deployment guide**: See `DEPLOYMENT_GUIDE.md` in the repo
- **Vercel docs**: https://vercel.com/docs
- **Render docs**: https://render.com/docs
- **MongoDB docs**: https://docs.atlas.mongodb.com/

---

**🎯 Your live app URLs:**
- Frontend: `https://teamhf.vercel.app` (or your custom domain)
- Backend: `https://teamhf-backend.onrender.com`
- Database: MongoDB Atlas cloud
