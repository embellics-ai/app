# First Chat Failure Fix

## Problem

When the widget was first deployed, the first few chat messages failed. After a human agent sent a message during handoff, subsequent messages worked fine.

## Root Cause

The issue was caused by a **race condition** when creating new Retell chat sessions:

1. **Immediate Message Send After Session Creation**: The code was creating a new Retell chat session and immediately trying to send a message to it
2. **Session Initialization Delay**: Retell's API needs a brief moment to fully initialize a new chat session before it can process messages
3. **No Retry Logic**: The first message had no retry mechanism, so if the session wasn't ready, it would fail immediately

This explains why:

- ✅ First messages failed (session not ready)
- ✅ After handoff worked fine (session already established and warm)
- ✅ Subsequent messages worked (using existing session)

## Solution Implemented

### 1. Session Initialization Delay (500ms)

Added a 500ms delay after creating a new chat session to allow Retell to fully initialize it:

```typescript
if (!retellChatId) {
  console.log('[Widget Chat] Creating new chat session');
  const chatSession = await tenantRetellClient.chat.create({
    agent_id: widgetConfig.retellAgentId,
    metadata: {
      tenantId: apiKeyRecord.tenantId,
      source: 'widget',
    },
  });
  retellChatId = chatSession.chat_id;
  isNewSession = true;
  console.log('[Widget Chat] Created session:', retellChatId);

  // Give Retell a moment to fully initialize the new session
  await new Promise((resolve) => setTimeout(resolve, 500));
}
```

### 2. Retry Logic with Exponential Backoff

Implemented automatic retry for new sessions (up to 3 attempts) with exponential backoff:

```typescript
let retries = isNewSession ? 3 : 1;
let lastError;

for (let attempt = 1; attempt <= retries; attempt++) {
  try {
    completion = await tenantRetellClient.chat.createChatCompletion({
      chat_id: retellChatId,
      content: message,
    });
    break; // Success, exit retry loop
  } catch (error: any) {
    lastError = error;
    console.error(`[Widget Chat] Attempt ${attempt}/${retries} failed:`, error.message);

    if (attempt < retries) {
      // Exponential backoff: 300ms, 600ms
      const delay = 300 * attempt;
      console.log(`[Widget Chat] Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
```

**Retry Schedule for New Sessions:**

- Attempt 1: Immediate (after 500ms initialization delay)
- Attempt 2: After 300ms delay
- Attempt 3: After 600ms delay

**Existing Sessions:** Only 1 attempt (no retry needed since session is already established)

### 3. Better Error Messages

Added more descriptive error messages to help diagnose issues:

```typescript
let errorMessage = 'Failed to process chat message';
if (error.message?.includes('chat_id')) {
  errorMessage = 'Chat session error. Please try again.';
} else if (error.message?.includes('agent_id')) {
  errorMessage = 'AI agent configuration error. Please contact support.';
} else if (error.message?.includes('timeout')) {
  errorMessage = 'Request timed out. Please try again.';
}

res.status(500).json({
  error: errorMessage,
  message: error.message, // Include detailed error for debugging
});
```

## Files Changed

- `server/routes.ts` - Updated `/api/widget/chat` endpoint

## Testing Recommendations

1. **Test First Message**: Clear localStorage and test the very first message sent through the widget
2. **Test Subsequent Messages**: Verify follow-up messages continue to work
3. **Test After Handoff**: Verify messages work correctly after human agent interaction
4. **Monitor Logs**: Check server logs for any retry attempts and timing information

## Expected Behavior

### Before Fix

- ❌ First message: Failed (session not ready)
- ✅ Retry manually: Works (session now ready)
- ✅ All subsequent messages: Work fine

### After Fix

- ✅ First message: Works (with 500ms delay + retry logic)
- ✅ All subsequent messages: Work fine
- ✅ After handoff: Works fine

## Performance Impact

- **New Sessions**: ~500ms additional latency on first message (acceptable for reliability)
- **Existing Sessions**: No performance impact
- **Retry Overhead**: Only applies to new sessions and only if first attempt fails

## Deployment Notes

1. Deploy the updated `server/routes.ts`
2. No database migrations required
3. No client-side widget changes needed
4. Monitor logs for any retry patterns
5. If retries are frequent, may need to increase initial delay from 500ms to 750ms

## Date

November 21, 2025
