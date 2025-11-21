# Testing Client Admin Chat Access Feature

## Quick Test Steps

### 1. **Verify Current Login State**

- Open browser to: http://localhost:3000
- Check if you're logged in as client admin (william.animesh@gmail.com)
- If logged in, **logout first** to trigger the agent creation on next login

### 2. **Login and Check Console**

1. Login with client admin credentials:
   - Email: william.animesh@gmail.com
   - Password: [your password]

2. **Open browser console** (F12 or Right-click → Inspect → Console)
3. Look for server console output showing:
   ```
   [Login] Created human agent record for client_admin: william.animesh@gmail.com
   ```

### 3. **Verify Agent Record in Database**

Using DBeaver or SQL query:

```sql
SELECT * FROM human_agents
WHERE email = 'william.animesh@gmail.com';
```

Expected result:

- `name`: William Animesh (or email prefix)
- `email`: william.animesh@gmail.com
- `status`: 'available'
- `activeChats`: 0
- `maxChats`: 5
- `tenantId`: [your tenant ID]

### 4. **Check Agent Dashboard**

1. Navigate to: **Agent Dashboard** (or similar page showing handoffs)
2. Look for **available agents section**
3. **You should see yourself listed** as an available agent
4. Status should show "Available"

### 5. **Test Handoff Assignment to Self**

1. Create a test handoff:
   - Open widget test page: http://localhost:3000/widget-test.html
   - OR use existing widget chat
   - Send messages and trigger handoff request

2. In Agent Dashboard:
   - Find the pending handoff
   - Look for **"Assign to [Your Name]"** button
   - Click to assign to yourself
   - Handoff should move to "Active" status
   - You should be able to view/respond to the chat

### 6. **Alternative: Database Test (Quick Verification)**

If you don't want to logout/login, manually create the agent record:

```sql
-- Check your tenant ID and user details
SELECT id, email, firstName, lastName, tenantId, role
FROM client_users
WHERE email = 'william.animesh@gmail.com';

-- Insert agent record manually
INSERT INTO human_agents (name, email, status, activeChats, maxChats, tenantId)
VALUES (
  'William Animesh',  -- Or use your actual name
  'william.animesh@gmail.com',
  'available',
  0,
  5,
  '[your-tenant-id-from-above-query]'
);
```

## Expected Behavior

### Before Feature:

- ❌ Client admin could only **view** handoffs
- ❌ Client admin could only **assign to support staff**
- ❌ Client admin appeared as "No agents available" when trying to assign

### After Feature:

- ✅ Client admin appears in **available agents list**
- ✅ Client admin can **assign handoffs to themselves**
- ✅ Client admin can **pick up and handle chats**
- ✅ Client admin can **resolve conversations**
- ✅ Agent record created **automatically on login**

## Troubleshooting

### Issue: Not seeing agent creation message in console

**Solution:** Check server terminal output (not browser console). Look for:

```
[Login] Created human agent record for client_admin: william.animesh@gmail.com
```

### Issue: Agent record already exists

**Solution:** This is fine! The code checks `agentExists` and won't create duplicates. You should see yourself in available agents list.

### Issue: Not appearing in available agents list

**Checks:**

1. Query database to verify record exists
2. Check `status` is 'available' (not 'offline' or 'busy')
3. Check `tenantId` matches your client admin's tenant
4. Refresh the Agent Dashboard page

### Issue: Can't assign to self

**Checks:**

1. Verify you're on the **Agent Dashboard** page
2. Check handoff is in **"pending"** status
3. Verify your agent status is **"available"**
4. Check browser console for errors

## What Changed (Technical)

### Modified Files:

- `server/routes.ts` - Three authentication flows

### Authentication Flows Updated:

1. **Regular Login** (lines 243-269)
2. **First-Time Login** (lines 168-190)
3. **Password Reset** (lines 540-570)

### Change Pattern:

```typescript
// BEFORE:
if (user.role === 'support_staff' && user.tenantId)

// AFTER:
if ((user.role === 'support_staff' || user.role === 'client_admin') && user.tenantId)
```

### Database Impact:

- New record in `human_agents` table for client admins
- No migration needed - works on next login
- Existing support staff not affected

## Success Criteria

✅ **Test passes if:**

1. You can login as client admin without errors
2. Agent record created (visible in database or logs)
3. You appear in available agents list
4. You can assign handoffs to yourself
5. You can handle/resolve chats assigned to you

## Quick Verification Commands

```bash
# Check server is running
ps aux | grep tsx | grep server/start.ts

# View server logs (if running in separate terminal)
# Look for "[Login] Created human agent record for client_admin"

# Check environment
cat .env | grep SMTP
cat .env.local | grep SMTP
```

## Test Credentials

**Client Admin:**

- Email: william.animesh@gmail.com
- Password: [your password]

**Platform Admin (if needed):**

- Email: admin@embellics.com
- Password: admin123

**Tenant:** SWC (3e9340e5-4dd0-434d-93b2-907d4850b87a)

## Next Steps After Testing

1. ✅ **If test passes:** Feature is ready for production
2. ❌ **If test fails:** Check troubleshooting section above
3. 📧 Test with multiple client admins to verify isolation
4. 🔄 Test switching between admin and support staff roles
5. 📊 Monitor analytics to track admin vs staff chat handling

---

**Ready to test!** Start with step 1: Logout if currently logged in, then login to trigger agent creation.
