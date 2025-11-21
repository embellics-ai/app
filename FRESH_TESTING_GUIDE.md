# Fresh Testing Guide - Post Database Cleanup

## ✅ Database Cleanup Complete

**Cleanup Date:** November 21, 2025

### What Was Deleted:

- ✅ All tenants
- ✅ All client users (except platform admin)
- ✅ All conversations and messages
- ✅ All widget configurations
- ✅ All API keys
- ✅ All human agents
- ✅ All widget handoffs and messages
- ✅ All user invitations
- ✅ All password reset tokens

### What Was Preserved:

- ✅ Platform Admin: `admin@embellics.com`

## 🧪 Testing Plan

### Phase 1: Platform Admin Setup ✅

**Already Complete** - Platform admin exists and ready

Platform admin credentials:

- Email: `admin@embellics.com`
- Access level: Full platform access
- Can create tenants and manage all accounts

---

### Phase 2: Create Test Tenant & Client Admin

#### Step 1: Login as Platform Admin

```
URL: http://localhost:5000/login
Email: admin@embellics.com
Password: [Your platform admin password]
```

#### Step 2: Create New Tenant/Client Admin

1. Navigate to Platform Admin dashboard
2. Click "Create Tenant" or "Add Client Admin"
3. Fill in details:
   - **Company Name:** "Test Corp"
   - **Admin Email:** `testadmin@testcorp.com`
   - **Admin Name:** "Test Admin"
   - **Password:** Set temporary password
4. Submit

#### Expected Result:

- ✅ New tenant created
- ✅ Client admin account created
- ✅ Client admin requires onboarding

---

### Phase 3: Client Admin Onboarding

#### Step 1: Login as Client Admin

```
URL: http://localhost:5000/login
Email: testadmin@testcorp.com
Password: [temporary password from Step 2]
```

#### Step 2: Complete Onboarding

1. **Password Change** (if required)
   - Set new permanent password
   - Confirm password

2. **Widget Configuration**
   - Set greeting message: "Hi! How can I help you today?"
   - Configure widget settings
   - Submit

#### Expected Results:

- ✅ Password changed successfully
- ✅ Widget configured
- ✅ API key auto-generated
- ✅ Redirected to dashboard

---

### Phase 4: Test Widget & API Key

#### Step 1: Get Widget Code

1. Navigate to "Widget Config" page
2. Copy widget code snippet
3. Look for API key in the code

#### Step 2: Test Widget

1. Open `widget-test.html` or create test page
2. Paste widget code
3. Open in browser
4. Test chat functionality

#### Expected Results:

- ✅ Widget loads successfully
- ✅ API key validation works
- ✅ Can send messages
- ✅ AI responses work

---

### Phase 5: Create Staff Members (Human Agents)

#### Step 1: Create Staff via Team Management

As client admin:

1. Navigate to "Team Management"
2. Click "Add Team Member"
3. Fill in details:
   - **Email:** `staff1@testcorp.com`
   - **Name:** "Staff Member 1"
   - **Role:** Support Staff
   - **Max Chats:** 5
4. Submit

#### Step 2: Staff Member Onboarding

1. Staff receives invitation email (or manually set password)
2. Login as `staff1@testcorp.com`
3. Complete onboarding if required

#### Expected Results:

- ✅ Staff member created
- ✅ Human agent record created
- ✅ Staff can login
- ✅ Staff sees agent queue/dashboard

---

### Phase 6: Test Handoff System (CRITICAL - Bug Fix Validation)

This tests the concurrent conversation access fix!

#### Setup:

- Client Admin: `testadmin@testcorp.com`
- Staff 1: `staff1@testcorp.com`
- Staff 2: `staff2@testcorp.com` (create this too)

#### Test Case 1: Normal Pickup Flow

1. Trigger handoff from widget
2. Login as Staff 1
3. Pick up conversation from queue
4. Verify:
   - ✅ Status changes to "active"
   - ✅ Can send messages
   - ✅ Conversation shows "My Chat" badge

#### Test Case 2: Concurrent Access Prevention (THE BUG FIX!)

1. Staff 1 picks up conversation (from Test Case 1)
2. **Open new incognito/private browser window**
3. Login as Staff 2
4. Navigate to agent queue
5. Try to open the same conversation
6. **EXPECTED RESULTS:**
   - ✅ See "Access Denied" message
   - ✅ Shows "Assigned to: Staff Member 1"
   - ✅ Cannot send messages
   - ✅ "Back to Queue" button works
   - ✅ In queue, shows "View (Assigned to Staff Member 1)" button

#### Test Case 3: Client Admin Cannot Join Active Conversation

1. Staff 1 has active conversation
2. Login as Client Admin (testadmin@testcorp.com)
3. Try to access the same conversation
4. **EXPECTED RESULTS:**
   - ✅ See "Access Denied" message
   - ✅ Shows "Assigned to: Staff Member 1"
   - ✅ Cannot interfere with staff's work

#### Test Case 4: Backend API Protection

1. While Staff 1 has active conversation
2. Open browser dev tools while logged in as Staff 2
3. Try to send message via API:
   ```javascript
   fetch('/api/widget-handoffs/HANDOFF_ID/send-message', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ message: 'test' }),
   });
   ```
4. **EXPECTED RESULTS:**
   - ✅ Get 403 Forbidden response
   - ✅ Error: "This conversation is assigned to another agent"

---

### Phase 7: Test Visual Indicators

#### In Agent Queue:

- ✅ Own conversations have blue border
- ✅ Own conversations have "My Chat" badge
- ✅ Own conversations show "Continue Chat" button
- ✅ Other conversations show "View (Assigned to X)" button

---

### Phase 8: Test Complete Handoff Flow

1. **Create handoff** from widget
2. **Staff picks up** conversation
3. **Chat back and forth** (agent ↔ user)
4. **Staff resolves** conversation
5. Verify:
   - ✅ Status changes to "resolved"
   - ✅ Shows in history tab
   - ✅ Active chat count decrements
   - ✅ Cannot send more messages

---

### Phase 9: Test Email & Password Reset

#### Test Password Reset:

1. Logout
2. Click "Forgot Password"
3. Enter client admin email
4. Check email for reset link
5. Reset password
6. Login with new password

#### Expected Results:

- ✅ Reset email sent
- ✅ Reset link works
- ✅ Password changed successfully
- ✅ Can login with new password

---

### Phase 10: Test Multiple Agents & Load

#### Create Multiple Agents:

- Staff 1, Staff 2, Staff 3
- Each with different max chat limits

#### Create Multiple Handoffs:

- Trigger 5-10 handoffs from widget
- Have different agents pick them up
- Test concurrent operations

#### Verify:

- ✅ Each agent only sees their own chats in "My Chats"
- ✅ Cannot access other agents' conversations
- ✅ Real-time updates work (WebSocket)
- ✅ Agent status (online/offline) updates correctly

---

## 🐛 Bug Testing Checklist

### Concurrent Access Bug (FIXED):

- [x] Frontend shows "Access Denied" for other agents' conversations
- [x] Backend returns 403 when wrong agent tries to send message
- [x] Visual indicators show ownership in queue
- [x] Client admin cannot join staff conversations

### Other Recent Fixes to Validate:

- [ ] Agent status heartbeat works
- [ ] Widget API key validation works
- [ ] End chat notification displays correctly
- [ ] Team management invitations work
- [ ] Email configuration works (if applicable)

---

## 📊 Test Results Template

Use this to track your testing:

```markdown
## Test Session: [Date/Time]

### Phase 2: Tenant Creation

- [ ] Created tenant: ****\_\_\_****
- [ ] Created client admin: ****\_\_\_****
- Issues: ****\_\_\_****

### Phase 3: Onboarding

- [ ] Client admin onboarding completed
- [ ] Widget configured
- [ ] API key generated
- Issues: ****\_\_\_****

### Phase 6: Concurrent Access (CRITICAL)

- [ ] Normal pickup works
- [ ] Access denied for other agents
- [ ] Client admin blocked from active chats
- [ ] Backend API returns 403
- Issues: ****\_\_\_****

### Overall Status:

- ✅ All tests passed
- ⚠️ Minor issues found: ****\_\_\_****
- ❌ Critical issues found: ****\_\_\_****
```

---

## 🚀 Quick Start Commands

```bash
# Start development server
npm run dev

# Check database status
npx tsx check-agents.ts

# Verify platform admin
npx tsx check-admin.ts

# Generate new API key (if needed)
npx tsx regenerate-test-api-key.ts

# Clean database again (if needed)
npx tsx scripts/clean-database.ts
```

---

## 📝 Notes

- All previous test data has been cleared
- Fresh start with only platform admin
- Perfect environment to validate all recent fixes
- Focus on concurrent conversation access bug fix
- Test thoroughly before production deployment

---

## ✅ Success Criteria

The testing is successful if:

1. ✅ Client admin can complete onboarding
2. ✅ Widget works with generated API key
3. ✅ Staff can pick up and handle conversations
4. ✅ **Multiple users CANNOT access same conversation simultaneously**
5. ✅ Visual indicators clearly show ownership
6. ✅ Backend API enforces authorization
7. ✅ All handoff flows work correctly
8. ✅ No console errors or warnings

---

**Happy Testing! 🎉**

Remember: Focus on testing the concurrent conversation access fix - this was the critical bug reported!
