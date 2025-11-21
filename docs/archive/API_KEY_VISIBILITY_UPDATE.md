# API Key Visibility Security Update

## Changes Implemented

### 1. Hide New API Keys by Default ✅

**Problem:** When an admin created a new API key, it was immediately visible in plain text.

**Solution:**

- Changed default state of `showNewKey` from `true` to `false`
- Users must now click the eye icon 👁️ to reveal the key
- Updated toast message to remind users: "Click the eye icon to view it!"

**Security Benefits:**

- Prevents shoulder surfing (someone looking over the admin's shoulder)
- Reduces accidental exposure in screen recordings/screenshots
- Forces intentional action to view sensitive data

**Code Changes:**

```tsx
// Before
const [showNewKey, setShowNewKey] = useState(true); // Auto-show new keys by default

// After
const [showNewKey, setShowNewKey] = useState(false); // Hide key by default for security
```

---

### 2. Old API Keys Cannot Be Viewed ✅

**Status:** Already correctly implemented - NO CHANGES NEEDED

**Current Behavior:**

- Old API keys show only the prefix: `aa1ff891••••••••••••••••`
- Full keys are NEVER stored in database (only SHA-256 hash)
- Security message displayed: "Full key was only shown at creation time and is not stored in our database for security."

**Why No Copy Function for Old Keys:**
This is the **correct security implementation** because:

1. **Technical Impossibility:**
   - Database stores: `SHA-256(embellics_[64-char-hex])`
   - Cannot reverse hash to get original key
   - This is cryptographically secure by design

2. **Industry Standard:**
   - GitHub Personal Access Tokens: Show once
   - AWS Secret Access Keys: Show once
   - Stripe API Keys: Show once
   - This is the standard practice for all major platforms

3. **Security Best Practice:**
   - If compromised, admin must regenerate (delete + create new)
   - No way to "leak" old keys from the system
   - Audit trail shows when keys were created/deleted

**User Workflow:**

```
1. Admin creates API key
2. Green banner appears with hidden key
3. Admin clicks eye icon 👁️ to reveal
4. Admin copies the full key
5. Admin uses key in widget embed
6. If key is lost later → Must delete old key and create new one
```

---

## Security Architecture

### Key Storage

```
User's Browser    →  Full Key: embellics_YOUR_API_KEY_HERE
Server Database   →  Hash:     [SHA-256 hash of the key]
Server Database   →  Prefix:   [first 8 chars] (for display only)
```

### Widget Authentication Flow

```
1. Widget sends:  embellics_YOUR_API_KEY_HERE
2. Server hashes: SHA-256(embellics_YOUR_API_KEY_HERE)
3. Server compares hash with database
4. If match → authenticate ✅
5. If no match → reject ❌
```

---

## User Experience

### Creating a New Key

1. Click "Create API Key" button
2. Enter optional name
3. Click "Generate Key"
4. Green banner appears
5. **Key is hidden** (shows: `embellics_4c74••••••••••••••••`)
6. Click eye icon 👁️ to reveal full key
7. Click "Copy" button to copy to clipboard
8. Use in widget embed code

### Using an Old Key

- Admin can see: `aa1ff891••••••••••••••••`
- Admin **cannot** see full key
- Admin **cannot** copy full key
- **If key is lost:** Delete and create new one

### Key Management Best Practices

✅ **Do:**

- Copy the key immediately after creation
- Store it in a secure password manager
- Use descriptive names for keys (e.g., "Production Website", "Staging")
- Delete unused keys regularly

❌ **Don't:**

- Share keys via email/Slack
- Store keys in plain text files
- Use the same key across multiple environments
- Commit keys to Git repositories

---

## Testing Checklist

- [x] New key is hidden by default
- [x] Eye icon toggles visibility
- [x] Copy button works for new keys
- [x] Old keys show only prefix
- [x] No copy button for old keys
- [x] Security message displayed
- [x] Toast notification mentions eye icon
- [x] Delete key clears new key banner

---

## FAQ

**Q: Why can't I see my old API keys?**
A: For security, full keys are only shown once at creation time. They're not stored in our database.

**Q: I lost my API key, what should I do?**
A: Delete the old key and create a new one. Update your widget embed code with the new key.

**Q: Can support staff recover my lost key?**
A: No. The full key is never stored anywhere. You must regenerate.

**Q: How many API keys can I create?**
A: There's no limit. You can create multiple keys for different environments.

**Q: Why is the key hidden by default?**
A: To prevent accidental exposure. You must intentionally click the eye icon to view it.

---

## Date

Updated: November 20, 2025
