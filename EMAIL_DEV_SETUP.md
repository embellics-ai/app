# Email Configuration Options for Development

## Current Setup (Production Gmail)

You're currently using Gmail's real SMTP server, which sends actual emails to real inboxes.

```env
SMTP_HOST='smtp.gmail.com'
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER='admin@embellics.com'
SMTP_PASS='opqqxaseywcizqry'
SMTP_FROM_EMAIL='admin@embellics.com'
```

## Option 1: Skip Email Sending (Easiest for Dev)

Simply comment out `SMTP_HOST` in your `.env`:

```env
# SMTP_HOST='smtp.gmail.com'
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER='admin@embellics.com'
SMTP_PASS='opqqxaseywcizqry'
SMTP_FROM_EMAIL='admin@embellics.com'
```

**What happens:**

- ✅ No real emails are sent
- ✅ Email content is logged to console
- ✅ No external service needed
- ✅ Fast and safe for development

## Option 2: Ethereal Email (Fake SMTP)

Generate test credentials:

```bash
node generate-ethereal-credentials.js
```

This will give you something like:

```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=abcdef@ethereal.email
SMTP_PASS=xxxxxxxxxxxxxx
SMTP_FROM_EMAIL=abcdef@ethereal.email
```

**What happens:**

- ✅ Emails are "sent" but caught by Ethereal
- ✅ View them at https://ethereal.email/
- ✅ No real emails sent to users
- ✅ Good for testing email templates

## Option 3: MailDev (Local SMTP Server)

Install MailDev:

```bash
npm install -g maildev
# or
yarn global add maildev
```

Run it:

```bash
maildev
```

Update `.env`:

```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
# No SMTP_USER or SMTP_PASS needed
SMTP_FROM_EMAIL='noreply@embellics.com'
```

**What happens:**

- ✅ Local SMTP server on port 1025
- ✅ Web UI at http://localhost:1080
- ✅ All emails caught locally
- ✅ Great for testing with team

## Option 4: Keep Gmail (Production Testing)

Keep your current setup if you want to test the full email flow with real delivery.

**⚠️ Warning:**

- Real emails will be sent
- Watch out for spam complaints
- Use test email addresses only
- Gmail has daily sending limits

## Recommendation

For **localhost development**: Use Option 1 (skip emails) or Option 3 (MailDev)  
For **testing email templates**: Use Option 2 (Ethereal)  
For **production-like testing**: Use Option 4 (Gmail) but with test addresses only

---

## Quick Switch Commands

**Skip emails (fastest):**

```bash
# Comment out in .env
# SMTP_HOST='smtp.gmail.com'
```

**Use Ethereal:**

```bash
node generate-ethereal-credentials.js
# Copy output to .env
```

**Use MailDev:**

```bash
npm install -g maildev
maildev
# Update .env with localhost settings
```
