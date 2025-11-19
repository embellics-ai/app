# Railway Deployment Guide

## Why Railway Instead of Vercel?

Your application uses:
- **Express.js server** with persistent connections
- **WebSockets** for real-time chat
- **Long-running processes** for database initialization

**Vercel only supports serverless functions**, which don't work for this architecture. Railway is perfect for full-stack Express apps.

## Deploy to Railway (5 minutes)

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub
3. Connect your `embellics-ai/app` repository

### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose `embellics-ai/app`

### Step 3: Configure Environment Variables
In Railway dashboard, add these variables:

```
NODE_ENV=production
DATABASE_URL=postgresql://neondb_owner:npg_unhR1evq9Wza@ep-empty-violet-agoe0tmd.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
SESSION_SECRET=your-session-secret-here
ENCRYPTION_KEY=your-encryption-key-here
RETELL_API_KEY=your-retell-api-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@embellics.com
APP_URL=https://your-app.railway.app
SALT_ROUNDS=10
```

### Step 4: Deploy
1. Railway will automatically detect the build command from `package.json`
2. It will run `npm run build` and then `npm start`
3. Your app will be live at `https://your-app.railway.app`

### Step 5: Update APP_URL
Once deployed, copy your Railway URL and update the `APP_URL` environment variable.

## Alternative: Render.com

If you prefer Render:

1. Go to https://render.com
2. Create a new "Web Service"
3. Connect your GitHub repo
4. Configure:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node
5. Add the same environment variables as above
6. Deploy!

## Alternative: Heroku

If you prefer Heroku:

1. Install Heroku CLI: `npm install -g heroku`
2. Login: `heroku login`
3. Create app: `heroku create embellics-app`
4. Add Neon database: `heroku addons:create heroku-postgresql:mini`
5. Set environment variables:
   ```bash
   heroku config:set SESSION_SECRET=your-secret
   heroku config:set ENCRYPTION_KEY=your-key
   # ... add all other variables
   ```
6. Deploy: `git push heroku main`

## Why Not Vercel?

Vercel is designed for:
- Static sites
- Next.js applications
- Serverless functions (max 10s execution time)

Your app needs:
- Long-running Node.js server
- WebSocket connections
- Database initialization on startup
- Persistent server state

**Railway, Render, or Heroku** are the right platforms for this architecture.

## Next Steps After Deployment

1. Test login at your Railway URL
2. Change admin password immediately
3. Update any webhooks or API integrations with new URL
4. Configure custom domain (optional)

## Estimated Costs

- **Railway**: Free tier includes $5 credit/month (enough for small apps)
- **Render**: Free tier available (with limitations)
- **Heroku**: $5-7/month for hobby dynos
