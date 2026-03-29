# Vercel Deployment Guide for TeamHF

## Prerequisites

1. **MongoDB Atlas Account** (Free tier available)
   - Vercel doesn't host databases, so you need MongoDB Atlas
   - Sign up at: https://www.mongodb.com/cloud/atlas/register

2. **Vercel Account** (Hobby plan is free)
   - Sign up at: https://vercel.com/signup

## Step-by-Step Deployment

### 1. Set Up MongoDB Atlas

1. Go to https://cloud.mongodb.com/
2. Create a new cluster (free M0 tier)
3. Create a database user with password
4. Add IP address `0.0.0.0/0` to allow access from anywhere (for Vercel)
5. Get your connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/`)

### 2. Deploy to Vercel

#### Option A: Using Vercel Dashboard (Recommended)

1. Go to https://vercel.com/new
2. Import your GitHub repository: `https://github.com/pirlapal/TeamHF-Versal-Host`
3. Configure the project:
   - **Framework Preset**: Other
   - **Root Directory**: `./`
   - **Build Command**: Leave empty (handled by vercel.json)
   - **Output Directory**: Leave empty

4. Add Environment Variables:
   - `MONGO_URL`: Your MongoDB Atlas connection string
   - `DB_NAME`: `hackforge` (or your preferred database name)
   - `JWT_SECRET`: A random secure string (generate with: `openssl rand -hex 32`)
   - `REACT_APP_BACKEND_URL`: Leave empty for now (will be your Vercel domain)
   - `STRIPE_API_KEY`: (optional) Your Stripe key if using payments
   - `SENDGRID_API_KEY`: (optional) Your SendGrid key if using email
   - `HF_TOKEN`: (optional) Hugging Face token for AI features

5. Click **Deploy**

6. After deployment, get your Vercel domain (e.g., `your-app.vercel.app`)

7. Update environment variable:
   - Go to Settings → Environment Variables
   - Add/Update `REACT_APP_BACKEND_URL` to `https://your-app.vercel.app`
   - Redeploy the application

#### Option B: Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod

# Add environment variables
vercel env add MONGO_URL
vercel env add DB_NAME
vercel env add JWT_SECRET
vercel env add REACT_APP_BACKEND_URL

# Redeploy with environment variables
vercel --prod
```

### 3. Post-Deployment Configuration

1. **Update MongoDB Network Access**:
   - In MongoDB Atlas, go to Network Access
   - Make sure `0.0.0.0/0` is added to allow Vercel to connect

2. **Test the Application**:
   - Visit your Vercel domain
   - Try logging in with admin credentials
   - Seed demo data from Admin Settings

3. **Set Up Custom Domain** (Optional):
   - In Vercel dashboard, go to Settings → Domains
   - Add your custom domain
   - Update DNS records as instructed

## Important Notes

### Limitations of Vercel Hobby Plan

- **Serverless Function Timeout**: 10 seconds max
- **Deployment Size**: 250MB max
- **Bandwidth**: 100GB/month
- **Build Time**: 45 minutes max

### Differences from Docker Deployment

1. **No MongoDB Container**: Must use MongoDB Atlas or other hosted MongoDB
2. **Serverless Functions**: Backend runs as serverless functions, not a persistent server
3. **Cold Starts**: First request may be slower due to function initialization
4. **File Storage**: Cannot use local file storage, must use external storage (S3, etc.)

### Environment Variables Required

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGO_URL` | MongoDB Atlas connection string | ✅ Yes |
| `DB_NAME` | Database name | ✅ Yes |
| `JWT_SECRET` | Secret for JWT tokens | ✅ Yes |
| `REACT_APP_BACKEND_URL` | Your Vercel domain URL | ✅ Yes |
| `STRIPE_API_KEY` | Stripe API key for payments | Optional |
| `SENDGRID_API_KEY` | SendGrid for email notifications | Optional |
| `HF_TOKEN` | Hugging Face token for AI features | Optional |

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `requirements.txt` and `package.json`

### Backend API Not Working
- Verify `MONGO_URL` is correct and accessible
- Check serverless function logs in Vercel dashboard
- Ensure `REACT_APP_BACKEND_URL` points to your Vercel domain

### Database Connection Issues
- Verify MongoDB Atlas IP whitelist includes `0.0.0.0/0`
- Check database user credentials in connection string
- Test connection string with MongoDB Compass

### Frontend Can't Connect to Backend
- Ensure `REACT_APP_BACKEND_URL` is set correctly
- Check browser console for CORS errors
- Verify API routes in `vercel.json` are correct

## Support

For issues with:
- **Vercel**: https://vercel.com/support
- **MongoDB Atlas**: https://www.mongodb.com/support
- **Application**: Check logs in Vercel dashboard
