# 🚀 Quick Vercel Deployment Guide

## Prerequisites

- Vercel account (free tier works)
- PostgreSQL database (Neon recommended)
- SMTP email credentials (Gmail App Password works)

## Step-by-Step Deployment

### 1. Prepare Secrets

Generate these before starting:

```bash
# SESSION_SECRET (copy output)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# ENCRYPTION_KEY (copy output)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Deploy to Vercel

#### Option A: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/new
2. Import your Git repository
3. Vercel auto-detects settings:
   - **Framework Preset:** Other
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

#### Option B: Via CLI

```bash
npm i -g vercel
vercel
```

### 3. Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

#### Required

```env
NODE_ENV=production
PORT=3000
APP_URL=https://your-app.vercel.app
SESSION_SECRET=<generated-secret>
ENCRYPTION_KEY=<generated-key>
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
```

#### Email (Required for invitations)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SKIP_EMAIL=false
```

#### Optional

```env
RETELL_API_KEY=your-retell-key
AI_INTEGRATIONS_OPENAI_API_KEY=your-openai-key
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
```

### 4. Database Setup

#### Using Neon (Recommended)

1. Go to https://neon.tech
2. Create a project
3. Copy the connection string
4. Add to Vercel as `DATABASE_URL`

#### Run Migrations

After deployment:

```bash
# Install Vercel CLI
npm i -g vercel

# Link to your project
vercel link

# Run migration
vercel env pull .env.production
npm run db:push
```

### 5. Verify Deployment

1. **Check health endpoint:**

   ```bash
   curl https://your-app.vercel.app/api/health
   ```

2. **Login to admin panel:**
   - URL: https://your-app.vercel.app
   - Email: admin@embellics.com
   - Password: admin123
   - ⚠️ **CHANGE PASSWORD IMMEDIATELY**

3. **Test email:**
   - Invite a test user
   - Verify email arrives

### 6. Post-Deployment

- [ ] Change admin password
- [ ] Create your first tenant
- [ ] Configure widget settings
- [ ] Test chat functionality
- [ ] Set up custom domain (optional)

## Common Issues & Fixes

### Build Fails

```bash
# Clear cache and rebuild
vercel --force
```

### Database Connection Error

- Check `DATABASE_URL` includes `?sslmode=require`
- Verify Neon database is active
- Check database credentials

### Email Not Sending

- Verify `SKIP_EMAIL=false`
- Check SMTP credentials
- For Gmail: Use App Password, not regular password
- Enable "Less secure app access" (if needed)

### 500 Error on API Calls

- Check `SESSION_SECRET` is set
- Verify all required env vars are set
- Check Vercel logs: Dashboard → Deployments → Logs

## Environment Variables Checklist

Copy this to ensure you have everything:

```env
# Core (REQUIRED)
NODE_ENV=production
PORT=3000
APP_URL=https://your-app.vercel.app
SESSION_SECRET=<generate-new>
ENCRYPTION_KEY=<generate-new>
DATABASE_URL=<neon-connection-string>

# Email (REQUIRED)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=<gmail-app-password>
SMTP_FROM_EMAIL=your-email@gmail.com
SKIP_EMAIL=false

# Optional
RETELL_API_KEY=<if-using-retell>
```

## Getting Gmail App Password

1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification (if not enabled)
3. Go to https://myaccount.google.com/apppasswords
4. Generate password for "Mail"
5. Copy the 16-character password
6. Use it as `SMTP_PASS`

## Vercel-Specific Notes

- **Functions Timeout:** 10 seconds (free tier)
- **Build Time:** 5 minutes max
- **No persistent file system** (database only)
- **Automatic HTTPS** ✅
- **CDN included** ✅
- **Zero-downtime deployments** ✅

## Need Help?

- Vercel Docs: https://vercel.com/docs
- Neon Docs: https://neon.tech/docs
- Check DEPLOYMENT_READINESS.md for full details

---

**Deployment Time:** ~5 minutes ⏱️  
**Difficulty:** Easy 🟢
