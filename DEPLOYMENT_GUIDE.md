# Production Deployment Guide

## 🚀 Deployed on Render.com

**Production URL:** https://app.embellics.com

## Why Render?

This application requires:

- An Express.js server capable of persistent connections
- WebSocket support for real-time chat
- Long-running Node.js processes (for database initialization and background work)
- PostgreSQL database (using Neon)

Render.com provides a straightforward option for hosting web services and automatic GitHub deployments. If you prefer another provider, ensure it supports persistent connections and WebSockets.

**Render.com provides:**

- ✅ Free tier for web services
- ✅ Automatic deployments from GitHub
- ✅ WebSocket support
- ✅ Simple configuration
- ✅ Custom domains (app.embellics.com)
- ✅ Automatic SSL/TLS certificates

## Environment Variables

The following environment variables are configured in Render dashboard:

```
NODE_ENV=production
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
SESSION_SECRET=<your-session-secret>
ENCRYPTION_KEY=<your-encryption-key>
RETELL_API_KEY=<your-retell-api-key>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your-email@gmail.com>
SMTP_PASS=<your-app-password>
SMTP_FROM=noreply@embellics.com
APP_URL=https://app.embellics.com
SALT_ROUNDS=10
```

## Deployment Configuration

### Build Command

```bash
npm install && npm run build
```

### Start Command

```bash
npm start
```

## Database: Neon PostgreSQL

The application uses Neon PostgreSQL (serverless PostgreSQL):

1. Database is hosted on Neon
2. Connection string is set in `DATABASE_URL` environment variable
3. Database initialization runs automatically on startup

## Continuous Deployment

Automatic deployments are triggered when pushing to GitHub:

```bash
git push origin main
```

Render automatically:

1. Detects the push
2. Runs the build command
3. Restarts the service with the new code

## Testing the Deployment

1. Visit https://app.embellics.com
2. Login with admin credentials
3. Verify:
   - Dashboard loads correctly
   - WebSocket connections work
   - Widget initialization works
   - Database queries execute successfully

## Widget Embedding

For external websites to use the widget, use the production URL:

```html
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://app.embellics.com/widget.js';
    script.setAttribute('data-api-key', 'your-api-key-here');
    document.head.appendChild(script);
  })();
</script>
```

## Security Checklist

- [x] HTTPS enabled (automatic with Render)
- [x] Environment variables secured
- [x] Custom domain configured (app.embellics.com)
- [ ] Rotate API keys regularly
- [ ] Monitor error logs
- [ ] Set up uptime monitoring

## Troubleshooting

### Build Failures

- Check Render build logs
- Verify `package.json` scripts are correct
- Ensure all dependencies are listed

### 502/503 Errors

- Service may be starting (wait 1-2 minutes)
- Check Render service logs
- Verify environment variables are set

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check Neon database status
- Ensure SSL mode is enabled

### Widget Not Loading

- Clear browser cache
- Check CORS configuration
- Verify API key is valid
- Check network tab for errors

## Monitoring

Monitor the application using:

- Render dashboard (service logs, metrics)
- Browser console (client-side errors)
- Database dashboard (Neon console)

---

**Current Status:** ✅ Live at https://app.embellics.com
