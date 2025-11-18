# Development Setup Guide

## ✅ Issues Fixed

### 1. Port Configuration

- **Changed**: Default port from 5000 to 3000
- **Files Modified**:
  - `server/index.ts` - Updated default port
  - `.env` - Added `PORT=3000`

### 2. macOS Compatibility

- **Fixed**: Server binding issue on macOS
- **Solution**: Removed unsupported `reusePort` option
- **Change**: Simplified `httpServer.listen()` call

### 3. Email System with Nodemailer

- **Solution**: Switched from Resend to Nodemailer for better reliability
- **Supports**: Gmail, Outlook, SendGrid, AWS SES, or any SMTP server
- **Development Mode**: Automatically skips email sending and logs credentials to console
- **Production**: Sends real emails via SMTP

#### Email Development Mode Features:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 [DEV MODE] Email Skipped - User Invitation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To: user@example.com
Name: John Doe
Role: client_admin
Temporary Password: ABC123xyz
Login URL: http://localhost:3000/login
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Gmail SMTP Setup (Production)

### Step 1: Enable 2-Factor Authentication

1. Go to https://myaccount.google.com/security
2. Enable **2-Step Verification** if not already enabled

### Step 2: Generate App Password

1. Go to https://myaccount.google.com/apppasswords
2. Select **Mail** as the app
3. Select **Other (Custom name)** as the device
4. Name it "Embellics Platform"
5. Click **Generate**
6. Copy the 16-character app password (e.g., `abcd efgh ijkl mnop`)
7. Remove spaces: `abcdefghijklmnop`

### Step 3: Update .env File

```bash
# SMTP Email Configuration
SMTP_HOST='smtp.gmail.com'
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER='your-email@gmail.com'
SMTP_PASS='abcdefghijklmnop'  # Your 16-char app password
SMTP_FROM_EMAIL='your-email@gmail.com'

# Set to false to enable email sending
SKIP_EMAIL=false
```

### Alternative SMTP Providers

#### Outlook/Hotmail

```bash
SMTP_HOST='smtp-mail.outlook.com'
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER='your-email@outlook.com'
SMTP_PASS='your-password'
```

#### SendGrid

```bash
SMTP_HOST='smtp.sendgrid.net'
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER='apikey'
SMTP_PASS='your-sendgrid-api-key'
```

#### AWS SES

```bash
SMTP_HOST='email-smtp.us-east-1.amazonaws.com'
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER='your-aws-smtp-username'
SMTP_PASS='your-aws-smtp-password'
```

## Environment Variables

### Required Variables in `.env`:

```bash
# Database
DATABASE_URL='postgresql://...'

# Security
SESSION_SECRET='your-session-secret'
ENCRYPTION_KEY='64-character-hex-string'

# Server
PORT=3000
NODE_ENV=development
APP_URL='http://localhost:3000'

# Email (SMTP) - Use Gmail App Password or any SMTP provider
# In development: Set SKIP_EMAIL=true to log emails to console
# In production: Set SKIP_EMAIL=false and configure SMTP
SMTP_HOST='smtp.gmail.com'
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER='your-email@gmail.com'
SMTP_PASS='your-app-password'
SMTP_FROM_EMAIL='your-email@gmail.com'
SKIP_EMAIL=true  # true = skip sending, false = send via SMTP

# AI Integration
AI_INTEGRATIONS_OPENAI_BASE_URL='http://localhost:1106/modelfarm/openai'
AI_INTEGRATIONS_OPENAI_API_KEY='_DUMMY_API_KEY_'

# Retell Integration
RETELL_API_KEY='key_...'
```

## Running the Project

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
export $(cat .env | xargs) && npm run dev
```

### 3. Access the Application

- **URL**: http://localhost:3000
- **Admin Login**:
  - Email: `admin@embellics.com`
  - Password: `admin123`

## Development Workflow

### Email Testing

In development mode (`NODE_ENV=development`):

- ✅ Invitations are created in the database
- ✅ Temporary passwords are displayed in console
- ✅ No actual emails are sent (avoids Resend API errors)
- ✅ You can manually copy credentials from console to test login

### User Invitation Flow

1. Admin invites user via platform
2. Console displays invitation details with temporary password
3. Copy the email and temp password from console
4. Manually navigate to login page
5. Test login with those credentials

### Password Reset Flow

1. Admin resets user password
2. Console displays new temporary password
3. Copy credentials from console
4. Test login with new password

## Production Setup

For production deployment:

1. Set `NODE_ENV=production`
2. Ensure valid `RESEND_API_KEY` is set
3. Configure verified sending domain in Resend
4. Set `RESEND_FROM_EMAIL` to your verified email address

## Known Warnings (Non-Critical)

### PostCSS Warning

```
A PostCSS plugin did not pass the `from` option to `postcss.parse`
```

- **Impact**: Harmless, doesn't affect functionality
- **Cause**: Common Vite/PostCSS integration quirk
- **Action**: Can be safely ignored

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Then restart
export $(cat .env | xargs) && npm run dev
```

### Email Errors in Development

- Ensure `NODE_ENV=development` is set
- Check that the development mode logging appears in console
- Errors are automatically caught and logged without breaking the app

### Database Connection Issues

- Verify `DATABASE_URL` in `.env` is correct
- Ensure database is accessible
- Check database credentials (PGHOST, PGUSER, PGPASSWORD)

## File Changes Summary

### Modified Files:

1. `server/index.ts`

   - Changed default port to 3000
   - Fixed listen() call for macOS compatibility

2. `server/email.ts`

   - Added development mode detection
   - Added console logging for credentials in dev mode
   - Added graceful error handling
   - Updated login URLs to use correct port

3. `.env`
   - Added PORT=3000
   - Added RESEND_FROM_EMAIL
   - All necessary environment variables configured

## Next Steps

1. ✅ Server is running on port 3000
2. ✅ Email system works in development mode
3. ✅ Database is connected
4. ✅ Ready for development!

You can now:

- Log in as admin
- Invite users (credentials shown in console)
- Test all platform features
- Develop without email service configured
