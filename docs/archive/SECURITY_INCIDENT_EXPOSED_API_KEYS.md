# 🚨 SECURITY INCIDENT: Exposed Widget API Keys

**Date:** November 21, 2025  
**Severity:** CRITICAL  
**Status:** MITIGATION IN PROGRESS

---

## Incident Summary

Multiple widget API keys were exposed in documentation and test files committed to the GitHub repository. These keys allow unauthorized access to the chat widget functionality.

## Exposed API Keys

The following API keys were found exposed in git history:

1. `embellics_fcba7f5aa6d138549945db5beda9a78102faf32c07e0a51d2e7a8f93cc694576` (docs/widget-simple-test.html)
2. `embellics_915f494a4e853a5dc97a2f09de314572460c7b40dc6c9699d41c23d7575a6844` (WIDGET_TESTING_GUIDE.md, CHAT_WIDGET_GUIDE.md)
3. `embellics_d310fe4eca6791a4425e18e6af0614a9ceacb9269122a3bf965f04955df8e595` (CRITICAL_API_KEY_BUG_FIX.md, WIDGET_FIXED.md)
4. `embellics_4c742acc29b150844e6ba1ee19a47b58c3125eff2fc9e4a6f8824dc2613b133f` (API_KEY_VISIBILITY_UPDATE.md)
5. `embellics_2e5a123d6582c4f1f89c8b180cbef73b67a0af76d849a6a43632b2de93521a05` (verify-key.ts)
6. `embellics_de81b5ae9282712cd1f55247f5cfa3a67e9431793d96aea5bda96d17ca729729` (WIDGET_API_KEY_FIX.md)
7. `embellics_01ba1bdd3ae1fedd2ebdc98c665f9d971ff21c65aa421618a4cb1d9bc84b0845` (WIDGET_API_KEY_FIX.md)
8. `embellics_a30ec232bff311b45537c0fe626d4e365b4da69581160082468e2ac887434169` (check-html-key.ts)
9. `embellics_4fd1dfd3da533b716356bd2108f53c821015a16c89a5b3212d49dfc0fb6acfdb` (verify-exact-key.ts, HOW_TO_COPY_API_KEY.md)

**Total:** 9 unique API keys exposed

## Impact

These API keys can be used to:

- Impersonate legitimate users
- Send messages through the chat widget
- Access chat history
- Trigger handoff requests
- Consume API quota
- Potentially access agent responses

## Files Affected

### Sanitized Files

- ✅ `docs/widget-simple-test.html` - API key replaced with placeholder
- ✅ `WIDGET_TESTING_GUIDE.md` - API key replaced with placeholder
- ✅ `CHAT_WIDGET_GUIDE.md` - API key replaced with placeholder
- ✅ `verify-key.ts` - API key replaced with placeholder
- ✅ `check-html-key.ts` - API key replaced with placeholder
- ✅ `verify-exact-key.ts` - API key replaced with placeholder
- ✅ `WIDGET_API_KEY_FIX.md` - API keys replaced with placeholders
- ✅ `CRITICAL_API_KEY_BUG_FIX.md` - API key replaced with placeholder
- ✅ `WIDGET_FIXED.md` - API key replaced with placeholder
- ✅ `API_KEY_VISIBILITY_UPDATE.md` - API keys replaced with placeholders
- ✅ `HOW_TO_COPY_API_KEY.md` - API key replaced with placeholder

### Git History

- ❌ All exposed keys still exist in git history (requires git-filter-repo)

---

## IMMEDIATE ACTIONS REQUIRED

### 1. Revoke All Exposed API Keys 🔴 URGENT

Connect to the database and delete all exposed keys:

```sql
-- Connect to your Neon database
psql "postgresql://neondb_owner:YOUR_PASSWORD@ep-empty-violet-agoe0tmd.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require"

-- Delete all exposed keys by their prefix
DELETE FROM api_keys WHERE key_prefix IN (
  'fcba7f5a',
  '915f494a',
  'd310fe4e',
  '4c742acc',
  '2e5a123d',
  'de81b5ae',
  '01ba1bdd',
  'a30ec232',
  '4fd1dfd3'
);

-- Verify deletion
SELECT key_prefix, created_at FROM api_keys ORDER BY created_at DESC;
```

Or use the admin dashboard:

1. Go to http://localhost:3000/dashboard
2. Navigate to API Keys section
3. Delete all keys with the following prefixes:
   - fcba7f5a
   - 915f494a
   - d310fe4e
   - 4c742acc
   - 2e5a123d
   - de81b5ae
   - 01ba1bdd
   - a30ec232
   - 4fd1dfd3

### 2. Generate New API Keys

After deleting exposed keys, create new ones:

1. Log in to the admin dashboard
2. Go to API Keys section
3. Click "Create New API Key"
4. Enter a description (e.g., "Production Widget - Regenerated after security incident")
5. Click "Create"
6. **COPY THE KEY IMMEDIATELY** (only shown once)
7. Update your production widget embeds with the new key

### 3. Remove Keys from Git History 🔴 CRITICAL

These keys are still in git history and need to be completely removed:

```bash
# Install git-filter-repo
pip install git-filter-repo

# Backup your repository first
cd /Users/animeshsingh/Documents/Embellics/Embellics-AI
git clone --mirror . ../Embellics-AI-backup.git

# Create a file with patterns to remove
cat > /tmp/api-keys-to-remove.txt << 'EOF'
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

# Use git-filter-repo to replace all instances with placeholder
git filter-repo --replace-text /tmp/api-keys-to-remove.txt

# Force push to update remote (COORDINATE WITH TEAM FIRST!)
git push origin --force --all
git push origin --force --tags
```

⚠️ **WARNING:** This rewrites git history. All team members will need to re-clone the repository.

### Alternative: BFG Repo-Cleaner

```bash
# Install BFG
brew install bfg

# Backup first
cd /Users/animeshsingh/Documents/Embellics/Embellics-AI
git clone --mirror . ../Embellics-AI-backup.git

# Create replacements file
cat > /tmp/api-keys-replacements.txt << 'EOF'
embellics_fcba7f5aa6d138549945db5beda9a78102faf32c07e0a51d2e7a8f93cc694576==>embellics_REDACTED_KEY
embellics_915f494a4e853a5dc97a2f09de314572460c7b40dc6c9699d41c23d7575a6844==>embellics_REDACTED_KEY
embellics_d310fe4eca6791a4425e18e6af0614a9ceacb9269122a3bf965f04955df8e595==>embellics_REDACTED_KEY
embellics_4c742acc29b150844e6ba1ee19a47b58c3125eff2fc9e4a6f8824dc2613b133f==>embellics_REDACTED_KEY
embellics_2e5a123d6582c4f1f89c8b180cbef73b67a0af76d849a6a43632b2de93521a05==>embellics_REDACTED_KEY
embellics_de81b5ae9282712cd1f55247f5cfa3a67e9431793d96aea5bda96d17ca729729==>embellics_REDACTED_KEY
embellics_01ba1bdd3ae1fedd2ebdc98c665f9d971ff21c65aa421618a4cb1d9bc84b0845==>embellics_REDACTED_KEY
embellics_a30ec232bff311b45537c0fe626d4e365b4da69581160082468e2ac887434169==>embellics_REDACTED_KEY
embellics_4fd1dfd3da533b716356bd2108f53c821015a16c89a5b3212d49dfc0fb6acfdb==>embellics_REDACTED_KEY
EOF

# Run BFG
bfg --replace-text /tmp/api-keys-replacements.txt

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push origin --force --all
```

### 4. Monitor for Unauthorized Usage

Check your logs and database for any suspicious activity:

```sql
-- Check for widget sessions created with exposed keys
SELECT
  ws.id,
  ws.created_at,
  ws.updated_at,
  ak.key_prefix,
  COUNT(wcm.id) as message_count
FROM widget_sessions ws
JOIN api_keys ak ON ws.agent_id = ak.agent_id
LEFT JOIN widget_chat_messages wcm ON ws.id = wcm.session_id
WHERE ak.key_prefix IN (
  'fcba7f5a', '915f494a', 'd310fe4e', '4c742acc', '2e5a123d',
  'de81b5ae', '01ba1bdd', 'a30ec232', '4fd1dfd3'
)
GROUP BY ws.id, ws.created_at, ws.updated_at, ak.key_prefix
ORDER BY ws.created_at DESC;

-- Check recent widget messages
SELECT
  wcm.id,
  wcm.created_at,
  wcm.role,
  LEFT(wcm.content, 100) as content_preview,
  ws.id as session_id,
  ak.key_prefix
FROM widget_chat_messages wcm
JOIN widget_sessions ws ON wcm.session_id = ws.id
JOIN api_keys ak ON ws.agent_id = ak.agent_id
WHERE ak.key_prefix IN (
  'fcba7f5a', '915f494a', 'd310fe4e', '4c742acc', '2e5a123d',
  'de81b5ae', '01ba1bdd', 'a30ec232', '4fd1dfd3'
)
ORDER BY wcm.created_at DESC
LIMIT 100;
```

Review for:

- Unusual message patterns
- High volume of requests
- Messages from unexpected IP addresses
- Attempts to access other tenants' data

---

## Timeline

- **November 21, 2025 12:46:53 UTC** - Previous security incident (.env file exposed)
- **November 21, 2025 ~13:00 UTC** - Widget API keys discovered in multiple files
- **November 21, 2025 13:XX UTC** - All files sanitized, placeholders added
- **November 21, 2025 13:XX UTC** - This security document created

---

## Root Cause

Documentation and test files were created with real API keys for testing purposes, then committed to git without sanitization. This is a common developer mistake when working with test/example code.

## Prevention Measures

### 1. Pre-commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Check for API keys
if git diff --cached | grep -E 'embellics_[a-f0-9]{64}'; then
    echo "🚨 ERROR: API key detected in staged files!"
    echo "Please replace with placeholder: embellics_YOUR_API_KEY_HERE"
    exit 1
fi

# Check for other secrets
if git diff --cached | grep -E '(SMTP_PASS|DATABASE_URL|RETELL_API_KEY|ENCRYPTION_KEY)=.+'; then
    echo "🚨 ERROR: Secret credentials detected in staged files!"
    echo "Please use placeholders in example files"
    exit 1
fi

exit 0
```

Make it executable:

```bash
chmod +x .git/hooks/pre-commit
```

### 2. Use Environment Variables for Tests

Instead of hardcoding keys in test files, use environment variables:

```javascript
// Good
const API_KEY = process.env.TEST_API_KEY || 'embellics_YOUR_API_KEY_HERE';

// Bad
const API_KEY = 'embellics_fcba7f5aa6d138549945db5beda9a78102faf32c07e0a51d2e7a8f93cc694576';
```

### 3. Secret Management

Consider using:

- **Doppler** - Secret management platform
- **AWS Secrets Manager** - For AWS deployments
- **HashiCorp Vault** - Enterprise secret management
- **GitHub Secrets** - For CI/CD pipelines

### 4. Documentation Standards

- Always use `embellics_YOUR_API_KEY_HERE` in examples
- Add prominent warnings in test files
- Include setup instructions that reference environment variables
- Review all docs before committing

### 5. Regular Security Audits

```bash
# Search for potential secrets
git grep -E 'embellics_[a-f0-9]{64}'
git grep -E '(password|secret|key).*=.*[a-zA-Z0-9]{20,}'
```

---

## Status Checklist

- [x] Identify all exposed API keys
- [x] Sanitize current files with placeholders
- [ ] Revoke all exposed API keys in database
- [ ] Generate new API keys for production
- [ ] Remove keys from git history using git-filter-repo
- [ ] Force push cleaned history
- [ ] Notify team to re-clone repository
- [ ] Update production widget embeds with new keys
- [ ] Monitor logs for suspicious activity
- [ ] Implement pre-commit hooks
- [ ] Update documentation standards
- [ ] Schedule security audit

---

## References

- Git Filter-Repo: https://github.com/newren/git-filter-repo
- BFG Repo-Cleaner: https://rtyley.github.io/bfg-repo-cleaner/
- GitHub: Removing sensitive data from a repository
- OWASP: Secret Management Cheat Sheet

---

## Contact

If you have questions or need assistance with this security incident, contact:

- Security Team: security@embellics.com
- DevOps Lead: [contact info]

**This is a CRITICAL security incident. All actions must be completed within 24 hours.**
