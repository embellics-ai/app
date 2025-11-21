# Email Configuration for Development

## Setup

Your email configuration now uses two files:

### `.env` (Committed to Git)

Contains **production Gmail SMTP** settings:

```env
SMTP_HOST='smtp.gmail.com'
SMTP_PORT=587
SMTP_USER='admin@embellics.com'
SMTP_PASS='opqqxaseywcizqry'
```

- Used in production/staging
- Sends real emails
- Committed to repository

### `.env.local` (Not Committed - Local Override)

Contains **local MailDev** settings:

```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM_EMAIL=noreply@embellics.com
```

- Used in local development only
- Catches emails in MailDev
- NOT committed to Git (in `.gitignore`)
- **Overrides** settings from `.env`

## How to Use

### 1. Start MailDev

```bash
maildev
```

MailDev will start:

- SMTP Server: `localhost:1025` (receives emails)
- Web UI: `http://localhost:1080` (view emails)

### 2. Start Your App

```bash
npm run dev
```

The app will automatically:

1. Load `.env` first (Gmail settings)
2. Load `.env.local` second (MailDev settings override Gmail)
3. Use MailDev because `.env.local` takes precedence

### 3. View Emails

Open http://localhost:1080 in your browser to see all emails sent by your app.

## Testing

Send a test email (invite user, reset password, etc.) and it will:

- ✅ NOT go to Gmail
- ✅ Appear in MailDev at http://localhost:1080
- ✅ Allow you to test email content and formatting
- ✅ Keep your production `.env` unchanged

## Switching Between Modes

**Use MailDev (Development):**

- Make sure `.env.local` exists with MailDev settings ✅ (Already created)
- Start MailDev: `maildev`
- Run your app: `npm run dev`

**Use Gmail (Production Testing):**

- Temporarily rename `.env.local` to `.env.local.backup`
- Or delete the `SMTP_HOST` line from `.env.local`
- Run your app - it will use Gmail from `.env`

**Skip Emails (Console Only):**

- Comment out `SMTP_HOST` in `.env.local`:
  ```env
  # SMTP_HOST=localhost
  ```

## File Priority

```
.env.local  >  .env  >  Environment Variables
(highest)             (lowest priority)
```

When both files exist, values in `.env.local` override `.env`.

## What's Already Done

✅ Created `.env.local` with MailDev configuration  
✅ Added `.env.local` to `.gitignore`  
✅ Your production `.env` remains unchanged  
✅ Ready to use - just start MailDev!

## Quick Start

```bash
# Terminal 1: Start MailDev
maildev

# Terminal 2: Start your app
npm run dev

# Browser: View emails
open http://localhost:1080
```

That's it! All emails will now go to MailDev instead of Gmail. 📧
