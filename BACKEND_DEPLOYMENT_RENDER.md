# Backend Deployment to Render (5 Minutes)

## Prerequisites
- MongoDB Atlas connection string from previous step
- GitHub repository: https://github.com/pirlapal/TeamHF-Versal-Host

## Step 1: Create Render Account

1. Go to: https://render.com/
2. Click **"Get Started"**
3. Sign up with **GitHub**

## Step 2: Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect GitHub repository:
   - Search for: `TeamHF-Versal-Host`
   - Click **"Connect"**

## Step 3: Configure Service

Fill in these settings:

```
Name: teamhf-backend
Region: (Choose closest to you - e.g., Oregon USA)
Branch: main
Root Directory: backend
Runtime: Python 3
Build Command: pip install -r requirements.txt
Start Command: uvicorn server:app --host 0.0.0.0 --port $PORT
Instance Type: Free
```

## Step 4: Add Environment Variables

Click **"Advanced"** and add these environment variables:

### Required Variables

| Name | Value |
|------|-------|
| `MONGO_URL` | Your MongoDB Atlas connection string from above |
| `DB_NAME` | `hackforge` |
| `JWT_SECRET` | Generate with: `openssl rand -hex 32` (run in terminal) |
| `PYTHON_VERSION` | `3.11.0` |
| `ADMIN_EMAIL` | `admin@caseflow.io` |
| `ADMIN_PASSWORD` | `admin123` |

### Optional Variables (Add Later)

| Name | Value | Purpose |
|------|-------|---------|
| `STRIPE_API_KEY` | Your Stripe key | For payments |
| `SENDGRID_API_KEY` | Your SendGrid key | For email notifications |
| `HF_TOKEN` | Hugging Face token | For AI features |

## Step 5: Deploy

1. Click **"Create Web Service"**
2. Wait 5-10 minutes for first deployment
3. **Copy your backend URL** when ready:
   ```
   https://teamhf-backend.onrender.com
   ```

## Step 6: Update Vercel Environment Variable

1. Go back to Vercel dashboard
2. Go to **Settings** → **Environment Variables**
3. Update `REACT_APP_BACKEND_URL`:
   ```
   REACT_APP_BACKEND_URL = https://teamhf-backend.onrender.com
   ```
4. Click **"Save"**
5. Go to **Deployments** → Click **"..."** → **"Redeploy"**

## Step 7: Test Your Application

1. Open your Vercel URL in browser
2. You should see the login page
3. Login with:
   ```
   Email: admin@caseflow.io
   Password: admin123
   ```
4. Go to **Admin Settings** → **Seed Demo Data**
5. Return to Dashboard and verify data appears

## Troubleshooting

### Backend Won't Start
- Check logs in Render dashboard
- Verify `MONGO_URL` is correct (no spaces, correct password)
- Ensure `PYTHON_VERSION` is set to `3.11.0`

### Frontend Can't Connect to Backend
- Verify `REACT_APP_BACKEND_URL` in Vercel matches Render URL exactly
- Make sure Render URL has `https://` prefix
- No trailing slash in URL
- Redeploy frontend after updating environment variable

### Database Connection Failed
- Check MongoDB Atlas Network Access allows `0.0.0.0/0`
- Verify database user credentials
- Test connection string with MongoDB Compass

### Render Free Tier Sleep Mode
- Free tier sleeps after 15 minutes of inactivity
- First request after sleep takes ~30 seconds (cold start)
- This is normal for free tier
- Upgrade to paid plan ($7/month) to remove sleep

## Success! 🎉

Your app is now fully deployed:
- **Frontend**: Your Vercel URL (e.g., `teamhf.vercel.app`)
- **Backend**: Your Render URL (e.g., `teamhf-backend.onrender.com`)
- **Database**: MongoDB Atlas (cloud)

**Total Cost: $0/month** (all free tiers!)

## Next Steps

1. Change default admin password (security)
2. Add custom domain to Vercel (optional)
3. Set up email notifications with SendGrid (optional)
4. Enable payment processing with Stripe (optional)
5. Configure AI features with Hugging Face (optional)

## Need Help?

- **Render Docs**: https://render.com/docs
- **MongoDB Atlas**: https://docs.atlas.mongodb.com/
- **Vercel Docs**: https://vercel.com/docs
