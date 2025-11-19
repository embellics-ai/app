# Production Deployment Guide# Railway Deployment Guide

## 🚀 Recommended: Render.com (Free Tier)## Why Railway Instead of Vercel?

### Why Render?Your application uses:

This application requires:- **Express.js server** with persistent connections

- **Express.js server** with persistent connections- **WebSockets** for real-time chat

- **WebSockets** for real-time chat- **Long-running processes** for database initialization

- **Long-running Node.js process**

- **Database initialization** on startup**Vercel only supports serverless functions**, which don't work for this architecture. Railway is perfect for full-stack Express apps.

**Render.com provides:**## Deploy to Railway (5 minutes)

- ✅ Free tier for web services

- ✅ Automatic deployments from GitHub### Step 1: Create Railway Account

- ✅ WebSocket support

- ✅ Zero configuration1. Go to https://railway.app

- ✅ 750 hours/month free runtime2. Sign up with GitHub

3. Connect your `embellics-ai/app` repository

# Production Deployment Guide

This guide explains how to deploy the Embellics application to a standard hosting provider that supports long-running Node.js services and WebSockets (for real-time chat). The instructions below are provider-agnostic; replace any example URLs with your actual deployment URL.

## Recommended: Render.com (Free Tier)

This application requires:

- An Express.js server capable of persistent connections
- WebSocket support for real-time chat
- Long-running Node.js processes (for database initialization and background work)

Render.com provides a straightforward option for hosting web services and automatic GitHub deployments. If you prefer another provider, ensure it supports persistent connections and WebSockets.

## Quick Start (example using Render.com)

### Step 1: Prepare environment variables

Create the environment variables required by the app (set them in your host's dashboard or CI/CD settings):

```
NODE_ENV=production
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
SESSION_SECRET=your-session-secret-here
ENCRYPTION_KEY=your-encryption-key-here
RETELL_API_KEY=your-retell-api-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@embellics.com
APP_URL=https://your-app.example.com
SALT_ROUNDS=10
```

### Step 2: Create a Web Service

1. Create a new Web Service (or equivalent) in your hosting dashboard.
2. Connect the service to the `embellics-ai/app` GitHub repository.
3. Set the build command and start command:

- Build command: `npm install && npm run build`
- Start command: `npm start`

Your host should detect the Node environment. After deployment, update `APP_URL` with your deployment URL.

## Alternative: Heroku

If you prefer Heroku, you can deploy similarly:

1. Install Heroku CLI: `npm install -g heroku`
2. `heroku login`
3. `heroku create <your-app-name>`
4. Set environment variables with `heroku config:set KEY=value`
5. Deploy: `git push heroku main`

## Database: Neon PostgreSQL (example)

This app works well with Neon (PostgreSQL). Steps:

1. Create a Neon project and copy the connection string.
2. Set the connection string as `DATABASE_URL` in your host's environment variables.

## Step — Test your deployment

1. Visit your deployment URL (e.g., `https://your-app.example.com`).
2. Login with admin credentials (change the default password immediately).
3. Verify WebSocket connections and database initialization.

## Next steps after deployment

1. Enable 2FA on accounts used for deployment and email
2. Rotate API keys and secrets
3. Update any webhooks or integrations to use your deployed URL
4. Configure a custom domain and TLS if desired

## Security checklist

- [ ] Change default admin password
- [ ] Rotate security keys regularly
- [ ] Use HTTPS
- [ ] Never commit `.env` to git

## Continuous deployment

Push to GitHub to trigger automatic deploys if your host supports GitHub integration:

```
git push origin main
```

## Troubleshooting

- Build fails: check your host's build logs
- 502 / 5xx errors: service may be starting — wait 1–2 minutes
- DB connection failed: verify `DATABASE_URL` and network access

---

Your app should now be ready for production deployment. Replace example values above with your real configuration and URLs.

APP_URL=https://your-app.example.com
SALT_ROUNDS=10

```

### Step 2: Create a Web Service

1. Create a new Web Service (or equivalent) in your hosting dashboard.
2. Connect the service to the `embellics-ai/app` GitHub repository.
3. Set the build command and start command:

- Build command: `npm install && npm run build`
- Start command: `npm start`

Your host should detect the Node environment. After deployment, update `APP_URL` with your deployment URL.

## Alternative: Heroku

If you prefer Heroku, you can deploy similarly:

1. Install Heroku CLI: `npm install -g heroku`
2. `heroku login`
3. `heroku create <your-app-name>`
4. Set environment variables with `heroku config:set KEY=value`
5. Deploy: `git push heroku main`

## Database: Neon PostgreSQL (example)

This app works well with Neon (PostgreSQL). Steps:

1. Create a Neon project and copy the connection string.
2. Set the connection string as `DATABASE_URL` in your host's environment variables.

## Step — Test your deployment

1. Visit your deployment URL (e.g., `https://your-app.example.com`).
2. Login with admin credentials (change the default password immediately).
3. Verify WebSocket connections and database initialization.

## Next steps after deployment

1. Enable 2FA on accounts used for deployment and email
2. Rotate API keys and secrets
3. Update any webhooks or integrations to use your deployed URL
4. Configure a custom domain and TLS if desired

## Security checklist

- [ ] Change default admin password
- [ ] Rotate security keys regularly
- [ ] Use HTTPS
- [ ] Never commit `.env` to git

## Continuous deployment

Push to GitHub to trigger automatic deploys if your host supports GitHub integration:

```

git push origin main

```

## Troubleshooting

- Build fails: check your host's build logs
- 502 / 5xx errors: service may be starting — wait 1–2 minutes
- DB connection failed: verify `DATABASE_URL` and network access

---

Your app should now be ready for production deployment. Replace example values above with your real configuration and URLs.
```
