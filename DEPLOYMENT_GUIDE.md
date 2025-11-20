# Production Deployment Guide# Production Deployment Guide



## 🚀 Deployed on Render.com## 🚀 Deployed on Render.com



**Production URL:** https://app.embellics.com**Production URL:** https://app.embellics.com



## Why Render?## Why Render?



This application requires:This application requires:



- **Express.js server** with persistent connections- An Express.js server capable of persistent connections

- **WebSockets** for real-time chat- WebSocket support for real-time chat

- **Long-running Node.js processes** for database initialization- Long-running Node.js processes (for database initialization and background work)

- **PostgreSQL database** (using Neon)

Render.com provides a straightforward option for hosting web services and automatic GitHub deployments. If you prefer another provider, ensure it supports persistent connections and WebSockets.

**Render.com provides:**

## Quick Start (example using Render.com)

- ✅ Free tier for web services

- ✅ Automatic deployments from GitHub### Step 1: Prepare environment variables

- ✅ WebSocket support

- ✅ Simple configurationCreate the environment variables required by the app (set them in your host's dashboard or CI/CD settings):

- ✅ Custom domains (app.embellics.com)

- ✅ Automatic SSL/TLS certificates```

NODE_ENV=production

## Environment VariablesDATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require

SESSION_SECRET=your-session-secret-here

The following environment variables are configured in Render dashboard:ENCRYPTION_KEY=your-encryption-key-here

RETELL_API_KEY=your-retell-api-key

```SMTP_HOST=smtp.gmail.com

NODE_ENV=productionSMTP_PORT=587

DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=requireSMTP_USER=your-email@gmail.com

SESSION_SECRET=<your-session-secret>SMTP_PASS=your-app-password

ENCRYPTION_KEY=<your-encryption-key>SMTP_FROM=noreply@embellics.com

RETELL_API_KEY=<your-retell-api-key>APP_URL=https://your-app.example.com

SMTP_HOST=smtp.gmail.comSALT_ROUNDS=10

SMTP_PORT=587```

SMTP_USER=<your-email@gmail.com>

SMTP_PASS=<your-app-password>### Step 2: Create a Web Service

SMTP_FROM=noreply@embellics.com

APP_URL=https://app.embellics.com1. Create a new Web Service (or equivalent) in your hosting dashboard.

SALT_ROUNDS=102. Connect the service to the `embellics-ai/app` GitHub repository.

```3. Set the build command and start command:



## Deployment Configuration- Build command: `npm install && npm run build`

- Start command: `npm start`

### Build Command

```bashYour host should detect the Node environment. After deployment, update `APP_URL` with your deployment URL.

npm install && npm run build

```## Alternative: Heroku



### Start CommandIf you prefer Heroku, you can deploy similarly:

```bash

npm start1. Install Heroku CLI: `npm install -g heroku`

```2. `heroku login`

3. `heroku create <your-app-name>`

## Database: Neon PostgreSQL4. Set environment variables with `heroku config:set KEY=value`

5. Deploy: `git push heroku main`

The application uses Neon PostgreSQL (serverless PostgreSQL):

## Database: Neon PostgreSQL (example)

1. Database is hosted on Neon

2. Connection string is set in `DATABASE_URL` environment variableThis app works well with Neon (PostgreSQL). Steps:

3. Database initialization runs automatically on startup

1. Create a Neon project and copy the connection string.

## Continuous Deployment2. Set the connection string as `DATABASE_URL` in your host's environment variables.



Automatic deployments are triggered when pushing to GitHub:## Step — Test your deployment



```bash1. Visit your deployment URL (e.g., `https://your-app.example.com`).

git push origin fixes/upgrades2. Login with admin credentials (change the default password immediately).

```3. Verify WebSocket connections and database initialization.



Render automatically:## Next steps after deployment

1. Detects the push

2. Runs the build command1. Enable 2FA on accounts used for deployment and email

3. Restarts the service with the new code2. Rotate API keys and secrets

3. Update any webhooks or integrations to use your deployed URL

## Testing the Deployment4. Configure a custom domain and TLS if desired



1. Visit https://app.embellics.com## Security checklist

2. Login with admin credentials

3. Verify:- [ ] Change default admin password

   - Dashboard loads correctly- [ ] Rotate security keys regularly

   - WebSocket connections work- [ ] Use HTTPS

   - Widget initialization works- [ ] Never commit `.env` to git

   - Database queries execute successfully

## Continuous deployment

## Widget Embedding

Push to GitHub to trigger automatic deploys if your host supports GitHub integration:

For external websites to use the widget, use the production URL:

```

```htmlgit push origin main

<script>```

  (function() {

    var script = document.createElement('script');## Troubleshooting

    script.src = 'https://app.embellics.com/widget.js?v=4';

    script.setAttribute('data-api-key', 'your-api-key-here');- Build fails: check your host's build logs

    document.head.appendChild(script);- 502 / 5xx errors: service may be starting — wait 1–2 minutes

  })();- DB connection failed: verify `DATABASE_URL` and network access

</script>

```---



## Security ChecklistYour app should now be ready for production deployment. Replace example values above with your real configuration and URLs.



- [x] HTTPS enabled (automatic with Render)APP_URL=https://your-app.example.com

- [x] Environment variables securedSALT_ROUNDS=10

- [x] Custom domain configured (app.embellics.com)

- [ ] Rotate API keys regularly```

- [ ] Monitor error logs

- [ ] Set up uptime monitoring### Step 2: Create a Web Service



## Troubleshooting1. Create a new Web Service (or equivalent) in your hosting dashboard.

2. Connect the service to the `embellics-ai/app` GitHub repository.

### Build Failures3. Set the build command and start command:

- Check Render build logs

- Verify `package.json` scripts are correct- Build command: `npm install && npm run build`

- Ensure all dependencies are listed- Start command: `npm start`



### 502/503 ErrorsYour host should detect the Node environment. After deployment, update `APP_URL` with your deployment URL.

- Service may be starting (wait 1-2 minutes)

- Check Render service logs## Alternative: Heroku

- Verify environment variables are set

If you prefer Heroku, you can deploy similarly:

### Database Connection Issues

- Verify `DATABASE_URL` is correct1. Install Heroku CLI: `npm install -g heroku`

- Check Neon database status2. `heroku login`

- Ensure SSL mode is enabled3. `heroku create <your-app-name>`

4. Set environment variables with `heroku config:set KEY=value`

### Widget Not Loading5. Deploy: `git push heroku main`

- Clear browser cache

- Check CORS configuration## Database: Neon PostgreSQL (example)

- Verify API key is valid

- Check network tab for errorsThis app works well with Neon (PostgreSQL). Steps:



## Monitoring1. Create a Neon project and copy the connection string.

2. Set the connection string as `DATABASE_URL` in your host's environment variables.

Monitor the application using:

- Render dashboard (service logs, metrics)## Step — Test your deployment

- Browser console (client-side errors)

- Database dashboard (Neon console)1. Visit your deployment URL (e.g., `https://your-app.example.com`).

2. Login with admin credentials (change the default password immediately).

---3. Verify WebSocket connections and database initialization.



**Current Status:** ✅ Live at https://app.embellics.com## Next steps after deployment


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
