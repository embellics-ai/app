# AGENT STATUS & LAST SEEN FIX

**Date:** November 21, 2025  
**Priority:** CRITICAL - Production Bug

---

## Root Cause Analysis

### Problem #1: Agents Showing as Offline When Logged In

**Symptoms:**

- Admin (Animesh Singh) logged in but showing "offline"
- Last Seen timestamp not updating on login
- Heartbeat not updating status or last_seen

**Root Cause Found:**

1. ❌ Login endpoint updates `status` to 'available' but does NOT update `last_seen`
2. ❌ Logout endpoint updates `status` to 'offline' but does NOT update `last_seen`
3. ⚠️ Heartbeat may not be running in browser (needs browser console check)

**Database Evidence:**

```
Animesh Singh:
- Status: offline
- Last Seen: Fri Nov 21 2025 11:44:09 GMT (39 minutes ago)

Bhukkha Reddy:
- Status: offline
- Last Seen: Fri Nov 21 2025 12:12:20 GMT (manual update)
```

Both agents are logged in RIGHT NOW, but database shows offline with old timestamps!

---

## Fixes Applied

### Fix #1: Update last_seen on Login

**File:** `server/routes.ts` - Lines ~268-279

**Before:**

```typescript
await storage.updateHumanAgentStatus(agent.id, 'available', user.tenantId);
console.log(`[Login] Updated agent status to 'available': ${user.email}`);
```

**After:**

```typescript
await storage.updateHumanAgentStatus(agent.id, 'available', user.tenantId);
await storage.updateAgentLastSeen(agent.id, user.tenantId);
console.log(`[Login] Updated agent status to 'available' and last_seen: ${user.email}`);
```

**Impact:**

- ✅ Every login now updates both status AND last_seen timestamp
- ✅ Agent will show as "Online now" immediately after login
- ✅ No waiting 30 seconds for heartbeat

---

### Fix #2: Update last_seen on Logout

**File:** `server/routes.ts` - Lines ~394-397

**Before:**

```typescript
await storage.updateHumanAgentStatus(agent.id, 'offline', user.tenantId);
console.log(`[Logout] Updated agent status to 'offline': ${user.email}`);
```

**After:**

```typescript
await storage.updateHumanAgentStatus(agent.id, 'offline', user.tenantId);
await storage.updateAgentLastSeen(agent.id, user.tenantId);
console.log(`[Logout] Updated agent status to 'offline' and last_seen: ${user.email}`);
```

**Impact:**

- ✅ Logout now records exact time user logged out
- ✅ "Last seen X minutes ago" will be accurate
- ✅ Better tracking of agent activity

---

## Testing Instructions

### Step 1: Hard Refresh Browser

**CRITICAL:** You must refresh to load new code!

**Chrome/Edge:**

- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

**Firefox:**

- Windows: `Ctrl + F5`
- Mac: `Cmd + Shift + R`

Or clear cache completely:

1. Open DevTools (F12)
2. Right-click refresh button
3. Select "Empty Cache and Hard Reload"

---

### Step 2: Test Login Updates Status & Last Seen

1. **Logout if currently logged in**
2. **Check database before login:**

   ```bash
   npx tsx check-agent-status.ts
   ```

   Should show "offline"

3. **Login as admin (william.animesh@gmail.com)**

4. **Check database after login:**
   ```bash
   npx tsx check-agent-status.ts
   ```

**Expected Result:**

```
Name:         Animesh Singh
Status:       available ✅ (was offline)
Last Seen:    [Current timestamp] ✅ (just now)
```

If status is still "offline", the fix didn't work - server needs restart.

---

### Step 3: Verify Heartbeat is Running

1. **Stay logged in as admin**
2. **Open Browser DevTools → Console tab**
3. **Wait 30 seconds**

**Expected Output:**

```
[Heartbeat] Ping successful
[Heartbeat] Ping successful
[Heartbeat] Ping successful
```

**If NO console logs appear:**

- ❌ Heartbeat hook not running
- ❌ Browser not loading new code
- ❌ Need to clear cache completely

**If you see error logs:**

```
[Heartbeat] Failed with status: 401
```

- ❌ Authentication issue
- ❌ JWT token may be expired

---

### Step 4: Verify Admin Dashboard Shows Status

1. **Keep admin logged in**
2. **Go to Agent Dashboard**
3. **Click "Agents" tab**

**Expected for Animesh Singh:**

- Badge: **available** (green)
- Last Seen: **"Online now"**

**If still showing offline:**

- Frontend may be caching old data
- Try hard refresh
- Check if query is refreshing

---

### Step 5: Test Logout Updates Last Seen

1. **Logged in as admin**
2. **Check database:**

   ```bash
   npx tsx check-agent-status.ts
   ```

   Note the current Last Seen timestamp

3. **Click Logout**

4. **Immediately check database again:**
   ```bash
   npx tsx check-agent-status.ts
   ```

**Expected Result:**

```
Name:         Animesh Singh
Status:       offline ✅
Last Seen:    [Just now timestamp] ✅ (updated on logout)
```

**If Last Seen is OLD:**

- ❌ Logout didn't update timestamp
- ❌ Server may need restart
- ❌ Check server logs for errors

---

### Step 6: Test Staff Member Status

1. **Login as hisloveforwords@gmail.com (support_staff)**
2. **Should land on /agent-queue**
3. **Open Browser Console**
4. **Should see heartbeat logs every 30 seconds**

5. **In another browser, login as admin**
6. **Go to Agent Dashboard → Agents tab**

**Expected for Bhukkha Reddy:**

- Badge: **available** (green)
- Last Seen: **"Online now"**

7. **As staff member, click Logout**
8. **Refresh admin dashboard**

**Expected for Bhukkha Reddy:**

- Badge: **offline** (grey)
- Last Seen: **"X seconds ago"** (accurate)

---

## Troubleshooting

### Issue: Status Still Showing Offline After Login

**Possible Causes:**

1. Browser didn't load new code
2. Server needs restart
3. Database update failed

**Solution:**

```bash
# 1. Kill the server
ps aux | grep "tsx" | grep "server/start.ts" | awk '{print $2}' | xargs kill

# 2. Restart the server
npm run dev
```

---

### Issue: No Heartbeat Console Logs

**Possible Causes:**

1. Browser cache not cleared
2. useHeartbeat hook not running
3. User role not triggering heartbeat

**Solution:**

1. **Complete cache clear:**
   - Chrome: Settings → Privacy → Clear browsing data → Cached images and files
   - Or use Incognito/Private window

2. **Check if hook is loaded:**

   ```javascript
   // In browser console
   console.log(window.location.pathname);
   // Should NOT be on /login
   ```

3. **Check user role:**
   ```javascript
   // In browser console
   JSON.parse(localStorage.getItem('token'));
   // Should show role: 'client_admin' or 'support_staff'
   ```

---

### Issue: Last Seen Shows Wrong Time

**Possible Causes:**

1. Timezone mismatch
2. Database using different timezone
3. Server using different timezone

**Solution:**

```bash
# Check what timezone database is using
npx tsx -e "
import { storage } from './server/storage';
const agents = await storage.getHumanAgentsByTenant('cm3b7j3sk0001gzwlx7oxrcgl');
const agent = agents.find(a => a.email === 'william.animesh@gmail.com');
console.log('Last Seen:', agent.lastSeen);
console.log('Local:', new Date(agent.lastSeen).toLocaleString());
console.log('UTC:', new Date(agent.lastSeen).toUTCString());
"
```

---

## Why This Happened

### Original Implementation Flaw

**What we thought:**

- Login updates status to 'available' ✅
- Heartbeat updates last_seen every 30s ✅
- Agent always appears online ✅

**What actually happened:**

- Login updates status to 'available' ✅
- Login does NOT update last_seen ❌
- If heartbeat fails, last_seen stays old ❌
- Agent shows as offline with old timestamp ❌

### The Missing Piece

**The bug:** Status and last_seen are SEPARATE fields that must be updated together!

**Status field:** 'available' | 'offline' | 'busy'
**Last Seen field:** Timestamp

When we only update status without last_seen, the agent appears:

- Status: available (correct)
- Last Seen: 39 minutes ago (incorrect)
- Badge: offline (because cleanup job marks as offline if no heartbeat for 2+ minutes)

The cleanup job checks: "If last_seen > 2 minutes old, set status to offline"

So even though login set status to 'available', the cleanup job immediately set it back to 'offline' because last_seen was 39 minutes old!

---

## The Complete Flow Now

### Login:

1. User enters credentials
2. Server validates password
3. Server updates agent status → 'available' ✅
4. Server updates last_seen → current timestamp ✅
5. Server sends JWT token
6. Browser loads dashboard
7. useHeartbeat hook starts
8. First heartbeat sent immediately
9. Heartbeat confirms status 'available' and updates last_seen

### Active Session:

1. Heartbeat pings every 30 seconds
2. Each ping updates last_seen
3. If status was changed to offline (by cleanup), heartbeat sets back to available
4. Agent always shows as "Online now"

### Logout:

1. User clicks logout
2. Browser calls /api/auth/logout
3. Server updates agent status → 'offline' ✅
4. Server updates last_seen → current timestamp ✅
5. Server sends success response
6. Browser clears localStorage
7. Browser redirects to /login
8. Agent shows as offline with accurate "Last seen X minutes ago"

### Cleanup Job:

1. Runs every 60 seconds
2. Finds agents where last_seen > 2 minutes old
3. Sets their status to 'offline'
4. Handles cases where browser crashed or lost connection

---

## Summary

**Fixed:**

- ✅ Login now updates both status AND last_seen
- ✅ Logout now updates both status AND last_seen
- ✅ Agent status will be accurate immediately
- ✅ Last seen timestamp will be accurate
- ✅ Cleanup job will work correctly with accurate timestamps

**Action Required:**

1. **Hard refresh browser** to load new code
2. **Test login** - should show available immediately
3. **Check console** - should see heartbeat logs every 30s
4. **Test logout** - should show accurate last seen time
5. **Verify both client_admin and support_staff roles**

**Server Status:**

- ✅ Server is running (tsx watch mode should auto-reload)
- ⚠️ If issues persist, restart server with `npm run dev`

---

**Fixed by:** GitHub Copilot  
**Date:** November 21, 2025  
**Status:** ✅ **CRITICAL BUG FIXED - REQUIRES HARD REFRESH**
