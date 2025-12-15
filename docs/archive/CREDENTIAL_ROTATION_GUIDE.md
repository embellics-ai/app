# Security Credentials Rotation - Step-by-Step Guide

**Date:** November 21, 2025  
**Status:** IN PROGRESS

---

## ✅ COMPLETED ACTIONS

### 1. Sanitized Exposed Files

- ✅ All API keys removed from documentation and test files
- ✅ Placeholders added to prevent future leaks
- ✅ Changes committed and pushed to repository

### 2. Revoked Exposed API Keys

- ✅ Script created: `revoke-exposed-keys.ts`
- ✅ Successfully executed - deleted all 9 exposed API keys from database
- ✅ Verified: No exposed keys remain in database
- ✅ Keys deleted:
  - fcba7f5a
  - 915f494a
  - d310fe4e
  - 4c742acc
  - 2e5a123d
  - de81b5ae
  - 01ba1bdd
  - a30ec232
  - 4fd1dfd3

---

## 🔴 URGENT ACTIONS REQUIRED (Manual Steps)

### 3. Rotate Gmail SMTP Password

**Current Exposed Credential:**

- SMTP_PASS='opqqxaseywcizqry'
- SMTP_USER='admin@embellics.com'

**Steps to Rotate:**

1. Go to https://myaccount.google.com/apppasswords
2. Sign in with admin@embellics.com
3. Locate the existing app password (if listed, revoke it)
4. Create a new app password:
   - Select app: "Mail"
   - Select device: "Other (Custom name)"
   - Name it: "Embellics Platform - Nov 2025"
   - Click "Generate"
5. Copy the 16-character password (format: xxxx xxxx xxxx xxxx)
6. Update your .env file:
   ```
   SMTP_PASS='your-new-app-password-here'
   ```
7. Update production environment variables
8. Test email sending functionality

### 4. Reset Neon Database Password

**Current Exposed Credential:**

- PGPASSWORD='npg_unhR1evq9Wza'
- DATABASE_URL contains this password

**Steps to Rotate:**

1. Go to https://console.neon.tech
2. Sign in to your account
3. Select your database: ep-empty-violet-agoe0tmd
4. Navigate to Settings → Security
5. Click "Reset Password"
6. Copy the new password
7. Update your .env file:
   ```
   PGPASSWORD='your-new-password-here'
   DATABASE_URL='postgresql://neondb_owner:your-new-password-here@ep-empty-violet-agoe0tmd.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require'
   ```
8. Update production environment variables
9. Restart your application
10. Test database connectivity

### 5. Revoke Retell API Key

**Current Exposed Credential:**

- RETELL_API_KEY='key_93f64256e7e3591f07e71d3cbb9b'

**Steps to Rotate:**

1. Go to https://app.retellai.com (or your Retell dashboard)
2. Sign in to your account
3. Navigate to API Keys or Settings
4. Locate the exposed key: key_93f64256e7e3591f07e71d3cbb9b
5. Click "Revoke" or "Delete"
6. Create a new API key
7. Copy the new key
8. Update your .env file:
   ```
   RETELL_API_KEY='your-new-retell-api-key-here'
   ```
9. Update production environment variables
10. Restart your application
11. Test voice agent functionality

### 6. Generate New Encryption Key ✅ (Generated Below)

**Current Exposed Credential:**

- ENCRYPTION_KEY='80e466f3375fd03dab78a44061d6d3d061d7c3a1e38dd536f21bb827c6b8d150'

**New Encryption Key Generated:**

```
ENCRYPTION_KEY='d35467a92d990df675285ba1a7de8d8bff39de03389063892fe7d06606eacecd'
```

**⚠️ IMPORTANT WARNING:**
Changing the encryption key will invalidate all existing encrypted data. If you have encrypted data in your database, you need to:

1. Decrypt all data with the old key first
2. Update the encryption key
3. Re-encrypt all data with the new key

OR if you don't have critical encrypted data:

1. Update the encryption key
2. Clear any encrypted data that can't be decrypted

**Steps to Update:**

1. Copy the new key from above
2. Update your .env file:
   ```
   ENCRYPTION_KEY='your-new-64-char-hex-key-here'
   ```
3. Update production environment variables
4. Consider migrating encrypted data if necessary

### 7. Generate New Session Secret ✅ (Generated Below)

**Current Exposed Credential:**

- SESSION_SECRET='6k0Bpp+ujiFicfwTrbCdkMNy+fxpoDNEynopIrrXQKw='

**New Session Secret Generated:**

```
SESSION_SECRET='ArZdeZDJ4e/g7Ay1un48IF++42kjjT8x4JKiAZUH3dc='
```

**Steps to Update:**

1. Copy the new secret from above
2. Update your .env file:
   ```
   SESSION_SECRET='your-new-base64-secret-here'
   ```
3. Update production environment variables
4. Restart your application
5. All users will need to log in again (sessions will be invalidated)

---

## 🔴 CRITICAL: Clean Git History

All exposed credentials still exist in git history and must be removed.

### Option 1: Using git-filter-repo (Recommended)

```bash
# 1. Install git-filter-repo
pip install git-filter-repo

# 2. Backup your repository
cd /Users/animeshsingh/Documents/Embellics/Embellics-AI
git clone --mirror . ../Embellics-AI-backup.git

# 3. Create a patterns file for all exposed secrets
cat > /tmp/secrets-to-remove.txt << 'EOF'
opqqxaseywcizqry
npg_unhR1evq9Wza
key_93f64256e7e3591f07e71d3cbb9b
80e466f3375fd03dab78a44061d6d3d061d7c3a1e38dd536f21bb827c6b8d150
6k0Bpp+ujiFicfwTrbCdkMNy+fxpoDNEynopIrrXQKw=
embellics_fcba7f5aa6d138549945db5beda9a78102faf32c07e0a51d2e7a8f93cc694576
embellics_915f494a4e853a5dc97a2f09de314572460c7b40dc6c9699d41c23d7575a6844
embellics_d310fe4eca6791a4425e18e6af0614a9ceacb9269122a3bf965f04955df8e595
embellics_4c742acc29b150844e6ba1ee19a47b58c3125eff2fc9e4a6f8824dc2613b133f
embellics_2e5a123d6582c4f1f89c8b180cbef73b67a0af76d849a6a43632b2de93521a05
embellics_de81b5ae9282712cd1f55247f5cfa3a67e9431793d96aea5bda96d17ca729729
embellics_01ba1bdd3ae1fedd2ebdc98c665f9d971ff21c65aa421618a4cb1d9bc84b0845
embellics_a30ec232bff311b45537c0fe626d4e365b4da69581160082468e2ac887434169
embellics_4fd1dfd3da533b716356bd2108f53c821015a16c89a5b3212d49dfc0fb6acfdb
EOF

# 4. Remove .env from ALL commits
git filter-repo --invert-paths --path .env

# 5. Replace all exposed secrets with [REDACTED]
git filter-repo --replace-text /tmp/secrets-to-remove.txt

# 6. Force push to rewrite remote history (COORDINATE WITH TEAM!)
git push origin --force --all
git push origin --force --tags
```

**⚠️ CRITICAL WARNING:**

- This rewrites ALL git history
- ALL team members MUST delete their local repo and re-clone
- Notify your team BEFORE doing this
- Any open pull requests will be affected

### Option 2: Using BFG Repo-Cleaner

```bash
# 1. Install BFG
brew install bfg

# 2. Backup repository
git clone --mirror . ../Embellics-AI-backup.git

# 3. Remove .env file
bfg --delete-files .env

# 4. Create replacements file
cat > /tmp/secrets-replacements.txt << 'EOF'
opqqxaseywcizqry==>***REDACTED***
npg_unhR1evq9Wza==>***REDACTED***
key_93f64256e7e3591f07e71d3cbb9b==>***REDACTED***
80e466f3375fd03dab78a44061d6d3d061d7c3a1e38dd536f21bb827c6b8d150==>***REDACTED***
6k0Bpp+ujiFicfwTrbCdkMNy+fxpoDNEynopIrrXQKw===>***REDACTED***
embellics_fcba7f5aa6d138549945db5beda9a78102faf32c07e0a51d2e7a8f93cc694576==>embellics_REDACTED
embellics_915f494a4e853a5dc97a2f09de314572460c7b40dc6c9699d41c23d7575a6844==>embellics_REDACTED
embellics_d310fe4eca6791a4425e18e6af0614a9ceacb9269122a3bf965f04955df8e595==>embellics_REDACTED
embellics_4c742acc29b150844e6ba1ee19a47b58c3125eff2fc9e4a6f8824dc2613b133f==>embellics_REDACTED
embellics_2e5a123d6582c4f1f89c8b180cbef73b67a0af76d849a6a43632b2de93521a05==>embellics_REDACTED
embellics_de81b5ae9282712cd1f55247f5cfa3a67e9431793d96aea5bda96d17ca729729==>embellics_REDACTED
embellics_01ba1bdd3ae1fedd2ebdc98c665f9d971ff21c65aa421618a4cb1d9bc84b0845==>embellics_REDACTED
embellics_a30ec232bff311b45537c0fe626d4e365b4da69581160082468e2ac887434169==>embellics_REDACTED
embellics_4fd1dfd3da533b716356bd2108f53c821015a16c89a5b3212d49dfc0fb6acfdb==>embellics_REDACTED
EOF

# 5. Replace secrets
bfg --replace-text /tmp/secrets-replacements.txt

# 6. Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 7. Force push
git push origin --force --all
```

---

## 📋 Completion Checklist

- [x] Sanitize files with exposed credentials
- [x] Revoke exposed API keys from database
- [ ] Rotate Gmail SMTP password
- [ ] Reset Neon database password
- [ ] Revoke and regenerate Retell API key
- [ ] Update ENCRYPTION_KEY in production
- [ ] Update SESSION_SECRET in production
- [ ] Remove credentials from git history
- [ ] Force push cleaned repository
- [ ] Notify team to re-clone repository
- [ ] Update production environment variables
- [ ] Restart production application
- [ ] Verify all services are operational
- [ ] Monitor logs for suspicious activity

---

## 🔄 After Rotating Credentials

1. **Test Everything:**
   - Database connectivity
   - Email sending (password reset, invitations)
   - Voice agent functionality (Retell API)
   - User sessions and authentication

2. **Update Production:**
   - Update all environment variables
   - Redeploy application
   - Monitor error logs

3. **Create New API Keys:**
   - Log in to admin dashboard
   - Generate new widget API keys
   - Update widget embeds on customer websites

4. **Monitor for 7 Days:**
   - Check for unauthorized access attempts
   - Review database logs
   - Monitor API usage
   - Check email logs

---

## 📞 Support

If you encounter issues during credential rotation:

- Check application logs for connection errors
- Verify environment variables are correctly set
- Test each service individually
- Roll back if critical issues occur (using backup credentials temporarily)

---

**REMEMBER:** All these credentials are currently exposed in public git history. Complete ALL steps as soon as possible.
