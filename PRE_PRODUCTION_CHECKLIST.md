# 🚀 PRE-PRODUCTION DATABASE CHECKLIST

## ⚠️ IMPORTANT REMINDER

You mentioned you'll come back to this when your product is ready. Here's what you need to review before going to production:

---

## 🗄️ Database Configuration Review

### Current Setup

- **Database:** Neon PostgreSQL (Cloud/Production database)
- **Location:** AWS eu-central-1 (Frankfurt, Germany)
- **Access:** You can view/edit via DBeaver
- **Status:** Currently using FREE tier

### ✅ Things to Check Before Production

#### 1. **Database Plan & Limits**

- [ ] Check Neon free tier limits
- [ ] Verify storage limits (how much data you can store)
- [ ] Check connection limits (how many simultaneous users)
- [ ] Consider upgrading to paid plan if needed
- [ ] Review pricing: https://neon.tech/pricing

#### 2. **Data Security**

- [ ] Change database password to something more secure
- [ ] Rotate DATABASE_URL credentials
- [ ] Update `.env` with new credentials
- [ ] Never commit `.env` or `.env.local` to Git
- [ ] Use environment variables in production (not hardcoded)

#### 3. **Database Backups**

- [ ] Verify Neon's automatic backup schedule
- [ ] Set up additional backup strategy if needed
- [ ] Test database restore process
- [ ] Document backup retention policy

#### 4. **Performance Optimization**

- [ ] Review database indexes (for faster queries)
- [ ] Check slow queries in DBeaver
- [ ] Optimize frequently-used queries
- [ ] Consider adding indexes to:
  - `client_users.email`
  - `human_agents.email`
  - `widget_handoffs.status`
  - `api_keys.key_prefix`

#### 5. **Data Cleanup**

- [ ] Remove test data (if any)
- [ ] Clear old handoffs/conversations
- [ ] Verify only production users exist
- [ ] Run database cleanup script:
  ```bash
  npx tsx full-database-reset.ts  # Only if starting fresh!
  ```

#### 6. **Monitoring**

- [ ] Set up database monitoring in Neon dashboard
- [ ] Configure alerts for:
  - High connection count
  - Storage usage > 80%
  - Query performance issues
- [ ] Monitor database logs

#### 7. **Connection Limits**

- [ ] Review max connections setting
- [ ] Ensure app uses connection pooling
- [ ] Test under load (simulate multiple users)

#### 8. **Compliance & Privacy**

- [ ] Review data retention policies
- [ ] Ensure GDPR compliance (if applicable)
- [ ] Document what data you collect
- [ ] Add privacy policy to your app

---

## 🔐 Security Checklist

### Environment Variables

- [ ] `.env` has production database credentials
- [ ] `.env.local` only for local development
- [ ] Never commit either file to Git
- [ ] Use platform environment variables in deployment (Vercel, Railway, etc.)

### API Keys

- [ ] All widget API keys are properly hashed (bcrypt)
- [ ] Old/unused API keys are deleted
- [ ] API key prefix system is working
- [ ] Test API key validation

### User Authentication

- [ ] All passwords are hashed with bcrypt
- [ ] JWT tokens have proper expiration
- [ ] Password reset flow is secure
- [ ] Email verification works (if implemented)

---

## 📊 DBeaver Usage Tips (When You Come Back)

### View Your Data

```sql
-- Check all users
SELECT * FROM client_users ORDER BY created_at DESC;

-- Check agents
SELECT * FROM human_agents;

-- Check recent handoffs
SELECT * FROM widget_handoffs ORDER BY requested_at DESC LIMIT 20;

-- Check API keys
SELECT * FROM api_keys;
```

### Useful Queries

```sql
-- Count users by role
SELECT role, COUNT(*) FROM client_users GROUP BY role;

-- Count handoffs by status
SELECT status, COUNT(*) FROM widget_handoffs GROUP BY status;

-- Find active chats
SELECT * FROM widget_handoffs WHERE status = 'active';

-- Check database size
SELECT pg_size_pretty(pg_database_size('neondb'));
```

### Export Data (Backup)

1. Right-click table → "Export Data"
2. Choose format: CSV, JSON, or SQL
3. Save to safe location

---

## 🚀 Deployment Checklist

Before deploying to production:

### Frontend (Vercel/Netlify)

- [ ] Update widget API URLs (localhost → production)
- [ ] Set production environment variables
- [ ] Test widget on production domain

### Backend (Railway/Render/Fly.io)

- [ ] Set DATABASE_URL environment variable
- [ ] Set ENCRYPTION_KEY environment variable
- [ ] Set SMTP settings for email
- [ ] Set JWT_SECRET
- [ ] Set APP_URL to production domain
- [ ] Enable SSL/HTTPS

### Testing

- [ ] Test full user flow (signup → login → chat)
- [ ] Test handoff flow (widget → agent dashboard)
- [ ] Test email sending (invitations, password reset)
- [ ] Test API key generation and validation
- [ ] Load test with multiple concurrent users

---

## 📝 Quick Commands Reference

```bash
# View database config
npx tsx show-db-config.ts

# Check email config
npx tsx check-email-config.ts

# Reset database (CAREFUL!)
npx tsx full-database-reset.ts

# Initialize platform admin
npx tsx init-admin.ts

# Check admin password
npx tsx check-admin-password.ts
```

---

## 🆘 Emergency Contacts & Resources

**Neon Dashboard:** https://console.neon.tech/

- View database metrics
- Check connection limits
- Manage backups
- View logs

**Neon Docs:** https://neon.tech/docs/

- Connection pooling
- Scaling guidelines
- Backup & restore

**DBeaver Connection Details:**

```
Host:     ep-empty-violet-agoe0tmd.c-2.eu-central-1.aws.neon.tech
Port:     5432
Database: neondb
Username: neondb_owner
Password: (check .env file)
SSL:      require (MUST be enabled)
```

---

## 🎯 When You're Ready

Come back to this document and:

1. ✅ Check all items in the checklist
2. 🔍 Review your data in DBeaver
3. 🧹 Clean up test data
4. 🔒 Rotate credentials
5. 📈 Set up monitoring
6. 🚀 Deploy to production!

---

**Status:** Draft - To be reviewed before production launch

**Last Updated:** November 21, 2025

**Next Review:** When product is ready for production
