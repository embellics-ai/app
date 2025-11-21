# SECURITY INCIDENT: Exposed SMTP Credentials

**Date:** November 21, 2025  
**Severity:** CRITICAL  
**Status:** MITIGATED

---

## Incident Summary

GitGuardian detected SMTP credentials exposed in the GitHub repository `embellics-ai/app`.

### What Was Exposed:

- ✅ **REMOVED** SMTP credentials (Gmail app password)
- ✅ **REMOVED** Database credentials (Neon PostgreSQL)
- ✅ **REMOVED** API keys (Retell AI)
- ✅ **REMOVED** Encryption keys
- ✅ **REMOVED** Session secrets

### Root Cause:

The `.env` file was accidentally committed to git despite being in `.gitignore`. This happened because the file was already tracked before `.gitignore` was added.

---

## Immediate Actions Taken

### 1. ✅ Removed .env from Git Tracking

```bash
git rm --cached .env
```

### 2. ✅ Sanitized .env.example

Replaced all real credentials with placeholder values in the example file.

### 3. ✅ Committed Fix

This commit removes the `.env` file from tracking going forward.

---

## CRITICAL: Actions You MUST Take Immediately

### 1. 🔴 ROTATE ALL CREDENTIALS (Required!)

All exposed credentials are now public and MUST be changed:

#### A. Gmail SMTP Password

1. Go to: https://myaccount.google.com/apppasswords
2. **Revoke** the old app password: `opqqxaseywcizqry`
3. Generate a new app password
4. Update your production environment variables

#### B. Database Password (Neon)

1. Go to Neon dashboard: https://console.neon.tech
2. Navigate to your project settings
3. **Reset the database password**
4. Update `DATABASE_URL` in your production environment

#### C. Retell API Key

1. Go to Retell dashboard
2. **Revoke** the exposed key: `key_93f64256e7e3591f07e71d3cbb9b`
3. Generate a new API key
4. Update `RETELL_API_KEY` in production

#### D. Encryption Key

1. Generate new encryption key:
   ```bash
   openssl rand -hex 32
   ```
2. Update `ENCRYPTION_KEY` in production
3. **Note:** This may invalidate existing encrypted data

#### E. Session Secret

1. Generate new session secret:
   ```bash
   openssl rand -base64 32
   ```
2. Update `SESSION_SECRET` in production
3. **Note:** This will log out all current users

### 2. 🔴 Remove from Git History

The `.env` file still exists in git history. You need to completely remove it:

#### Option A: Using git filter-repo (Recommended)

```bash
# Install git-filter-repo
pip install git-filter-repo

# Remove .env from all commits
git filter-repo --invert-paths --path .env

# Force push to overwrite history
git push origin --force --all
```

#### Option B: Using BFG Repo Cleaner

```bash
# Download BFG
# https://rtyley.github.io/bfg-repo-cleaner/

# Remove .env
bfg --delete-files .env

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push origin --force --all
```

⚠️ **WARNING:** These commands rewrite git history. Coordinate with your team!

### 3. 🟡 Update Production Environment

After rotating credentials, update them in your production environment:

**If using Vercel/Railway/Render:**

- Go to project settings
- Update environment variables
- Redeploy the application

**If using Docker/VPS:**

- SSH into your server
- Update `.env` file with new credentials
- Restart the application

### 4. 🟡 Monitor for Suspicious Activity

Check for any unauthorized access:

- Review Gmail sent folder for suspicious emails
- Check Neon database logs for unusual queries
- Monitor Retell API usage
- Review application logs for suspicious activity

---

## Prevention Measures

### ✅ Implemented:

1. `.env` removed from git tracking
2. `.env` is in `.gitignore`
3. `.env.example` uses placeholder values only

### 📋 Recommended:

1. Use environment variable management tools:
   - **Doppler** (https://www.doppler.com/)
   - **Vault** (https://www.vaultproject.io/)
   - **AWS Secrets Manager**

2. Enable pre-commit hooks to prevent credential commits:

   ```bash
   # Install pre-commit
   pip install pre-commit

   # Add .pre-commit-config.yaml
   # Include secret scanning tools
   ```

3. Use GitGuardian monitoring (already active ✓)

4. Implement least-privilege access:
   - Separate development and production credentials
   - Use read-only credentials where possible
   - Rotate credentials regularly

---

## Timeline

| Time         | Action                              |
| ------------ | ----------------------------------- |
| 12:46:53 UTC | ❌ `.env` file pushed to GitHub     |
| ~12:52 UTC   | 🔔 GitGuardian alert received       |
| Now          | ✅ `.env` removed from tracking     |
| **Next**     | 🔴 **YOU: Rotate all credentials**  |
| **Next**     | 🔴 **YOU: Remove from git history** |

---

## Status Checklist

- [x] Remove `.env` from git tracking
- [x] Sanitize `.env.example`
- [x] Commit and push fix
- [ ] **🔴 Rotate Gmail SMTP password**
- [ ] **🔴 Reset Neon database password**
- [ ] **🔴 Revoke and regenerate Retell API key**
- [ ] **🔴 Generate new encryption key**
- [ ] **🔴 Generate new session secret**
- [ ] **🔴 Remove .env from git history**
- [ ] **🔴 Update production environment variables**
- [ ] **🔴 Redeploy application**
- [ ] 🟡 Monitor for suspicious activity (next 7 days)
- [ ] 🟡 Implement pre-commit hooks
- [ ] 🟡 Set up secret management tool

---

## Resources

- **Git History Cleanup:** https://github.com/newren/git-filter-repo
- **BFG Repo Cleaner:** https://rtyley.github.io/bfg-repo-cleaner/
- **Gmail App Passwords:** https://myaccount.google.com/apppasswords
- **Neon Console:** https://console.neon.tech
- **GitGuardian Docs:** https://docs.gitguardian.com/

---

**IMPORTANT:** Do NOT ignore this. Exposed credentials can lead to:

- Unauthorized email sending (spam, phishing)
- Database breach (customer data theft)
- API abuse (financial costs)
- Service disruption

**Act immediately to rotate all credentials.**

---

**Fixed by:** Security Team  
**Date:** November 21, 2025  
**Priority:** 🔴 **CRITICAL - ACT NOW**
