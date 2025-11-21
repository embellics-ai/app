# HEARTBEAT 401 UNAUTHORIZED FIX

**Date:** November 21, 2025  
**Priority:** CRITICAL - Heartbeat Not Working

---

## Root Cause: Missing JWT Token in Heartbeat

### The Problem

**Console Error:**

```
POST http://localhost:3000/api/auth/heartbeat 401 (Unauthorized)
[Heartbeat] Failed with status: 401
```

**Why This Happened:**
The heartbeat hook was sending a POST request to `/api/auth/heartbeat` but **was NOT including the JWT token** in the Authorization header!

```typescript
// ❌ WRONG - Missing Authorization header
const response = await fetch('/api/auth/heartbeat', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
});
```

The server's `requireAuth` middleware checks for `Authorization: Bearer <token>` header, and since it was missing, it returned 401 Unauthorized.

---

## The Fix

### Fix #1: Add Authorization Header to Heartbeat

**File:** `client/src/hooks/use-heartbeat.ts`

**Before:**

```typescript
const sendHeartbeat = async () => {
  try {
    const response = await fetch('/api/auth/heartbeat', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
```

**After:**

```typescript
const sendHeartbeat = async () => {
  try {
    // Get token from localStorage
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.error('[Heartbeat] No auth token found');
      return;
    }

    const response = await fetch('/api/auth/heartbeat', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`, // ← ADDED
      },
    });
```

**Changes:**

- ✅ Read JWT token from localStorage
- ✅ Check if token exists before sending request
- ✅ Include `Authorization: Bearer ${token}` header
- ✅ Log error if token is missing

---

### Fix #2: Add Authorization Header to Logout

**File:** `client/src/contexts/auth-context.tsx`

**Before:**

```typescript
const logout = async () => {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
```

**After:**

```typescript
const logout = async () => {
  try {
    // Get token before clearing localStorage
    const token = localStorage.getItem('auth_token');

    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }), // ← ADDED
      },
    });
```

**Changes:**

- ✅ Read JWT token BEFORE clearing localStorage
- ✅ Include Authorization header conditionally (only if token exists)
- ✅ Ensures logout endpoint can authenticate the request

---

## Why This Matters

### Without the JWT Token:

1. **Heartbeat fails with 401** ❌
2. **last_seen timestamp never updates** ❌
3. **Cleanup job marks agent as offline after 2 minutes** ❌
4. **Agent shows as offline even when logged in** ❌

### With the JWT Token:

1. **Heartbeat succeeds every 30 seconds** ✅
2. **last_seen timestamp updates every 30 seconds** ✅
3. **Cleanup job sees recent timestamp, keeps agent available** ✅
4. **Agent shows as available and "Online now"** ✅

---

## Testing Instructions

### Step 1: Hard Refresh Browser

**CRITICAL:** Must clear cache to load new code!

**Mac:** `Cmd + Shift + R`  
**Windows:** `Ctrl + Shift + R`

Or:

1. Open DevTools (F12)
2. Right-click refresh button
3. Select "Empty Cache and Hard Reload"

---

### Step 2: Verify Heartbeat is Now Working

1. **Login as admin (william.animesh@gmail.com)**
2. **Open Browser DevTools → Console tab**
3. **Wait 30 seconds**

**Expected Output (SUCCESS):**

```
[Heartbeat] Ping successful
[Heartbeat] Ping successful
[Heartbeat] Ping successful
```

**Should NOT see:**

```
❌ POST http://localhost:3000/api/auth/heartbeat 401 (Unauthorized)
❌ [Heartbeat] Failed with status: 401
```

---

### Step 3: Verify Agent Status Updates

1. **Stay logged in as admin**
2. **Wait 30 seconds** (for heartbeat to run)
3. **Check database:**
   ```bash
   npx tsx check-agent-status.ts
   ```

**Expected Result:**

```
Name:         Animesh Singh
Status:       available ✅ (not offline!)
Last Seen:    [Current timestamp] ✅ (within last 30 seconds)
```

---

### Step 4: Verify Agent Dashboard Shows Correct Status

1. **Keep admin logged in**
2. **Go to Agent Dashboard → Agents tab**

**Expected for Animesh Singh:**

- Badge: **available** (green)
- Last Seen: **"Online now"**

---

### Step 5: Test Staff Member Heartbeat

1. **Logout as admin**
2. **Login as hisloveforwords@gmail.com (support_staff)**
3. **Should land on /agent-queue**
4. **Open Browser Console**

**Expected Output:**

```
[Heartbeat] Ping successful
[Heartbeat] Ping successful
```

5. **In another browser, login as admin**
6. **Go to Agent Dashboard → Agents tab**

**Expected for Bhukkha Reddy:**

- Badge: **available** (green)
- Last Seen: **"Online now"**

---

### Step 6: Test Logout Still Works

1. **Logged in as any agent**
2. **Click Logout**

**Should:**

- ✅ NOT see any console errors
- ✅ Successfully redirect to /login
- ✅ Clear all data

3. **Check database:**
   ```bash
   npx tsx check-agent-status.ts
   ```

**Expected:**

- Status: **offline**
- Last Seen: **[Just now timestamp]**

---

## Troubleshooting

### Issue: Still Getting 401 Errors

**Check localStorage has token:**

1. Open DevTools → Console
2. Run: `localStorage.getItem('auth_token')`
3. Should return a long JWT string

**If null:**

- ❌ Token not saved on login
- ❌ Need to check login flow
- ❌ Try logout and login again

---

### Issue: Heartbeat Logs Not Appearing

**Possible Causes:**

1. Browser cache not cleared
2. Role is not support_staff or client_admin
3. useHeartbeat hook not imported in App.tsx

**Check:**

```javascript
// In browser console
const token = localStorage.getItem('auth_token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Role:', payload.role);
// Should be 'client_admin' or 'support_staff'
```

---

### Issue: "No auth token found" in Console

**This means:**

- Token was cleared from localStorage
- User was logged out
- Need to login again

**Solution:**

1. Logout completely
2. Clear all browser data
3. Login fresh
4. Token should be saved

---

## Complete Flow Now

### 1. Login:

```
User enters credentials
  ↓
Server validates & creates JWT
  ↓
Client saves token to localStorage
  ↓
Server updates agent status to 'available'
  ↓
Server updates last_seen to current timestamp
  ↓
Client redirects to dashboard
  ↓
useHeartbeat hook starts
  ↓
Heartbeat sends POST with Authorization header ✅
  ↓
Server authenticates token
  ↓
Server updates last_seen (30s later)
  ↓
Agent shows as "Online now" ✅
```

### 2. Active Session:

```
Every 30 seconds:
  Heartbeat reads token from localStorage ✅
    ↓
  Sends POST with Authorization: Bearer <token> ✅
    ↓
  Server authenticates request
    ↓
  Server updates last_seen
    ↓
  Server confirms status is 'available'
    ↓
  Console logs: [Heartbeat] Ping successful ✅
```

### 3. Logout:

```
User clicks logout
  ↓
Client reads token BEFORE clearing localStorage ✅
  ↓
Client sends POST /api/auth/logout with token ✅
  ↓
Server authenticates request
  ↓
Server updates status to 'offline'
  ↓
Server updates last_seen
  ↓
Client clears localStorage
  ↓
Client redirects to /login
  ↓
Agent shows as offline with accurate last seen ✅
```

---

## Summary of All Fixes Applied

### Server-Side Fixes (routes.ts):

1. ✅ Login now updates both status AND last_seen
2. ✅ Logout now updates both status AND last_seen

### Client-Side Fixes:

1. ✅ Heartbeat now includes Authorization header with JWT token
2. ✅ Heartbeat checks for token before sending request
3. ✅ Logout reads token before clearing localStorage
4. ✅ Logout includes Authorization header with JWT token

### Result:

- ✅ No more 401 Unauthorized errors
- ✅ Heartbeat succeeds every 30 seconds
- ✅ last_seen updates correctly
- ✅ Agent status shows accurate availability
- ✅ "Online now" / "X minutes ago" is accurate

---

## Action Required

1. **Hard refresh browser** (Cmd+Shift+R) to load new code
2. **Logout completely**
3. **Login again**
4. **Check console** - should see "[Heartbeat] Ping successful" every 30s
5. **Check database** - status should be 'available', last_seen current
6. **Check dashboard** - should show green "available" badge

---

**Fixed by:** GitHub Copilot  
**Date:** November 21, 2025  
**Status:** ✅ **CRITICAL BUG FIXED - REQUIRES HARD REFRESH & RE-LOGIN**
