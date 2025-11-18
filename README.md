# RetellChatFlow - Platform Agnostic Setup

A modern AI-powered chat widget platform with voice integration. Fully platform-agnostic and ready to deploy anywhere.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Resend account (for emails)
- OpenAI API key
- Retell AI API key

### Installation

1. **Clone and Install**

   ```bash
   npm install
   ```

2. **Configure Environment**

   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Generate Security Keys**

   ```bash
   # Session secret
   openssl rand -base64 64

   # Encryption key
   openssl rand -hex 32
   ```

4. **Start Development Server**

   ```bash
   npm run dev
   ```

5. **Access Application**
   - URL: `http://localhost:3000`
   - Admin: `admin@embellics.com` / `admin123`

## 📋 Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL='postgresql://user:pass@host:5432/db?sslmode=require'

# Security
SESSION_SECRET='your-session-secret'
ENCRYPTION_KEY='your-64-char-hex-key'

# Server
PORT=3000
APP_URL='http://localhost:3000'  # Change in production

# Email (Resend)
RESEND_API_KEY='re_your_key'
RESEND_FROM_EMAIL='admin@yourdomain.com'

# AI Services
AI_INTEGRATIONS_OPENAI_BASE_URL='https://api.openai.com/v1'
AI_INTEGRATIONS_OPENAI_API_KEY='sk-your-key'
RETELL_API_KEY='key_your_key'
```

See `.env.example` for complete configuration options.

## 🛠️ Development

### Email Testing in Development

When `NODE_ENV=development`, emails are NOT sent. Instead, credentials are logged to console:

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

This allows you to:

- Test user invitations without email service
- Copy credentials directly from console
- Avoid API errors during development

### Build Commands

```bash
# Development
npm run dev

# Production Build
npm run build

# Start Production Server
npm start

# Type Checking
npm run check

# Database Push (Drizzle)
npm run db:push
```

## 🌐 Deployment

This application is **platform agnostic** and can be deployed to:

- ✅ Azure App Service
- ✅ AWS (EC2, ECS, Lambda)
- ✅ DigitalOcean
- ✅ Heroku
- ✅ Vercel (with serverless adapter)
- ✅ Any VPS with Node.js

### Deployment Checklist

1. **Set Environment Variables**
   - Update `APP_URL` to your production domain
   - Set `NODE_ENV=production`
   - Configure all required API keys

2. **Database Setup**
   - Provision PostgreSQL database
   - Run migrations: `npm run db:push`

3. **Email Configuration**
   - Verify your sending domain in Resend
   - Update `RESEND_FROM_EMAIL`

4. **Build & Deploy**
   ```bash
   npm run build
   npm start
   ```

### Azure Deployment Example

```bash
# Install Azure CLI
az login

# Create resource group
az group create --name myResourceGroup --location eastus

# Create App Service plan
az appservice plan create --name myAppServicePlan --resource-group myResourceGroup --sku B1 --is-linux

# Create web app
az webapp create --resource-group myResourceGroup --plan myAppServicePlan --name myRetellApp --runtime "NODE:20-lts"

# Configure environment variables
az webapp config appsettings set --resource-group myResourceGroup --name myRetellApp --settings \
  NODE_ENV=production \
  PORT=8080 \
  APP_URL=https://myretellapp.azurewebsites.net \
  DATABASE_URL="your-connection-string" \
  # ... add all other variables

# Deploy
az webapp deployment source config-zip --resource-group myResourceGroup --name myRetellApp --src ./build.zip
```

## 🗃️ Database

### Supported Databases

- PostgreSQL 12+
- Hosted options:
  - Neon (https://neon.tech)
  - Supabase (https://supabase.com)
  - Azure Database for PostgreSQL
  - AWS RDS
  - DigitalOcean Managed Databases

### Migrations

Using Drizzle ORM:

```bash
npm run db:push
```

## 📧 Email Configuration

### Resend Setup

1. Sign up at https://resend.com
2. Add and verify your domain
3. Generate API key
4. Update `.env`:
   ```bash
   RESEND_API_KEY='re_your_api_key'
   RESEND_FROM_EMAIL='admin@yourdomain.com'
   ```

### Testing Emails

- Development: Check console logs
- Production: Test with real email addresses

## 🤖 AI Services

### OpenAI Configuration

```bash
AI_INTEGRATIONS_OPENAI_BASE_URL='https://api.openai.com/v1'
AI_INTEGRATIONS_OPENAI_API_KEY='sk-your-key'
```

### Retell AI Configuration

```bash
RETELL_API_KEY='key_your_key'
```

Get API keys from:

- OpenAI: https://platform.openai.com
- Retell: https://retellai.com

## 🔒 Security

### Generate Secure Keys

```bash
# Session Secret
openssl rand -base64 64

# Encryption Key
openssl rand -hex 32

# Or with Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Best Practices

- Never commit `.env` to version control
- Rotate keys regularly
- Use different keys for dev/staging/prod
- Enable HTTPS in production

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or change port in .env
PORT=3001
```

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check firewall rules
- Ensure database is running
- Test connection with psql

### Email Not Sending

- Verify `RESEND_API_KEY` is valid
- Check domain is verified in Resend
- Review Resend dashboard for errors
- In development, check console logs

## 📁 Project Structure

```
├── client/           # React frontend
├── server/           # Express backend
├── shared/           # Shared types and schemas
├── tests/            # Test files
├── .env             # Environment variables (not in git)
├── .env.example     # Template for environment variables
├── package.json     # Dependencies
└── vite.config.ts   # Vite configuration
```

## 🧪 Testing

```bash
npm test
```

## 📝 License

MIT

## 🤝 Support

For issues or questions, please open a GitHub issue.

---

**Note**: This project is fully platform-agnostic and can be deployed on any cloud provider (Azure, AWS, GCP, etc.).
