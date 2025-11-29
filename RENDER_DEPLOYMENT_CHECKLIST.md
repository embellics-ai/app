# Render Deployment Checklist - Chat Analytics

## ✅ Code Deployed

- [x] Chat analytics feature merged to `dev1`
- [x] Pushed to GitHub (triggers Render auto-deploy)

## 📋 Next Steps

### 1. Wait for Render Deployment

**Check Render Dashboard:**

1. Go to https://dashboard.render.com
2. Find your service (development or production)
3. Check "Events" tab - you should see "Deploy started"
4. Wait for "Deploy live" (usually 2-5 minutes)

### 2. Run Database Migration

**IMPORTANT:** The chat analytics feature added new database tables.

**Option A: Via Render Shell**

1. Go to Render Dashboard → Your Service
2. Click "Shell" tab
3. Run: `npm run db:push`

**Option B: Locally (if using same database)**

```bash
# Make sure you're using the production DATABASE_URL
npm run db:push
```

This creates:

- `chat_analytics` table
- `chat_messages` table
- Required indexes

### 3. Verify Environment Variables

**Go to Render Dashboard → Your Service → Environment:**

Ensure these are set:

```bash
# Database
DATABASE_URL=postgresql://embellics_prod_user:...

# Security
SESSION_SECRET=...
ENCRYPTION_KEY=...

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=915998021588678
WHATSAPP_BUSINESS_ACCOUNT_ID=1471345187284298
WHATSAPP_ACCESS_TOKEN=EAAJ3jljc5SwBQK9XumV8j6...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=EAAJ3jljc5SwBQN5N7...

# Email (Production)
SMTP_HOST=smtp.sendgrid.net  # or your SMTP provider
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey  # if using SendGrid
SMTP_PASS=your-api-key
SMTP_FROM_EMAIL=noreply@embellics.com
```

### 4. Configure Retell Agent ID

**In Your Deployed App:**

1. Go to: `https://your-app.onrender.com`
2. Log in as platform admin
3. Navigate to: Platform Admin → Tenants
4. Click "Edit API Key" for your tenant
5. Enter your **Retell Agent ID** (from Retell dashboard)
6. Also add your **Retell API Key** if you have one
7. Click Save

**Where to find Retell Agent ID:**

- Go to https://app.retellai.com
- Click "Agents"
- Click your WhatsApp agent
- Copy the Agent ID (starts with `agent_`)

### 5. Configure Retell Webhook

**In Retell AI Dashboard:**

1. Go to https://app.retellai.com
2. Navigate to Settings → Webhooks
3. Add webhook URL:

**Development:**

```
https://your-app-dev.onrender.com/api/retell/chat-analyzed
```

**Production:**

```
https://your-app-prod.onrender.com/api/retell/chat-analyzed
```

4. Subscribe to event: `chat_analyzed`
5. Save webhook

### 6. Test the Setup

**Send a WhatsApp Test Message:**

1. Send message to your WhatsApp business number
2. Have a conversation with the bot
3. End the chat (say "goodbye" or wait for timeout)

**Check Render Logs:**

1. Go to Render Dashboard → Your Service → Logs
2. Watch for webhook activity:

```
[Retell Webhook] Found tenant from agent ID: ...
[Retell Webhook] Stored chat analytics for chat ...
```

**Check Analytics Dashboard:**

1. Open your app: `https://your-app.onrender.com`
2. Log in as platform admin
3. Go to Platform Admin → Analytics tab
4. Select your tenant
5. You should see your WhatsApp chat!

## 🔍 Troubleshooting

### Issue: Deployment Failed

**Check Render logs:**

- Build errors → Check `package.json` scripts
- Runtime errors → Check environment variables

### Issue: Database Tables Not Created

**Solution:**

```bash
# Connect to Render shell and run:
npm run db:push
```

### Issue: Webhook Not Receiving Data

**Check:**

1. Webhook URL is correct in Retell dashboard
2. Agent ID is configured in Platform Admin
3. Chat actually ended (webhook fires on completion)
4. Check Render logs for incoming requests

### Issue: Analytics Not Showing

**Verify:**

1. Database migration ran successfully
2. Agent ID matches exactly (case-sensitive)
3. Webhook received (check Render logs)
4. Using correct tenant in analytics dropdown

## 📊 Testing Both Environments

### Development Environment Testing

**Use for:**

- Testing new features
- Breaking changes
- Experimental webhooks

**Setup:**

- Point Retell webhook to dev URL
- Use development database (Neon)
- Free tier (may sleep after 15min inactivity)

### Production Environment Testing

**Use for:**

- Real WhatsApp messages
- Customer interactions
- Reliable analytics

**Setup:**

- Point Retell webhook to production URL
- Use production database (Render Postgres)
- Paid tier (always on, reliable)

## 🔄 Deployment Workflow

### For Future Updates:

1. **Develop locally** on feature branch
2. **Test** with LocalTunnel or dev Render
3. **Merge** to `dev1` branch
4. **Push** to GitHub
5. **Render auto-deploys**
6. **Test** on development Render
7. **Merge** to `main` for production (if separate)
8. **Monitor** Render logs

## 📝 Post-Deployment Checklist

- [ ] Render deployment successful (green checkmark)
- [ ] Database migration completed (`chat_analytics` table exists)
- [ ] Environment variables configured
- [ ] Retell Agent ID saved in Platform Admin
- [ ] Webhook configured in Retell dashboard
- [ ] Test WhatsApp message sent
- [ ] Webhook received (check Render logs)
- [ ] Analytics showing in dashboard
- [ ] No errors in Render logs

## 🎯 Your Current URLs (Example)

**Replace with your actual Render URLs:**

Development:

```
App: https://embellics-dev.onrender.com
Webhook: https://embellics-dev.onrender.com/api/retell/chat-analyzed
```

Production:

```
App: https://embellics.onrender.com
Webhook: https://embellics.onrender.com/api/retell/chat-analyzed
```

## 📚 Additional Resources

- `CHAT_ANALYTICS_GUIDE.md` - Complete feature documentation
- `WHATSAPP_ANALYTICS_GUIDE.md` - WhatsApp-specific setup
- `TROUBLESHOOTING_ANALYTICS.md` - Common issues and solutions
- Render Docs: https://render.com/docs
- Retell Docs: https://docs.retellai.com

## ✅ Success Indicators

You'll know it's working when:

1. ✅ Render shows "Deploy live"
2. ✅ No errors in Render logs
3. ✅ Webhook receives POST requests (visible in logs)
4. ✅ Analytics dashboard shows chat count > 0
5. ✅ Recent WhatsApp chats appear in the list
6. ✅ Sentiment analysis displays
7. ✅ Cost tracking shows data

---

**Next:** Wait for Render deployment to complete, then run the database migration!
