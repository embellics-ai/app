# Transcript Messages Not Populating - Diagnosis & Fix

**Date:** December 4, 2024  
**Issue:** `retell_transcript_messages` table is empty despite chats completing  
**Status:** ⚠️ **IDENTIFIED - RETELL CONFIGURATION ISSUE**

---

## 🔍 Diagnosis Results

### What We Found:

```
✅ Webhook endpoint configured correctly (10 chats received)
✅ chat_analyzed events being processed
✅ chat_analytics records being created
❌ NO transcript messages being stored (0 messages)
❌ Retell NOT sending 'transcript' field in webhook payload
```

### Database State:

- **Chat Analytics:** 10 records
- **Transcript Messages:** 0 records
- **All chats:** Missing transcript data

---

## 🎯 Root Cause

**Retell AI is not including the `transcript` field in the `chat_analyzed` webhook payload.**

This happens when:

1. The webhook subscription doesn't include transcript data
2. The Retell dashboard settings exclude transcript from webhooks
3. The agent configuration doesn't preserve conversation history

---

## ✅ Solution

### Option 1: Configure Retell Webhook (Recommended)

1. **Go to Retell Dashboard:**
   - Navigate to https://app.retellai.com/dashboard
   - Go to **Settings** → **Webhooks**

2. **Check Webhook Configuration:**
   - Find your webhook endpoint (should be: `https://your-domain.com/api/webhooks/chat-analyzed`)
   - Event type: `chat.analyzed` or `chat_analyzed`
3. **Enable Transcript in Webhook:**
   Look for options like:
   - ☑️ Include conversation transcript
   - ☑️ Include message history
   - ☑️ Include full chat details
4. **Save and Test:**
   - Complete a new chat conversation
   - Check server logs for: `[Retell Webhook] Storing X transcript messages`

### Option 2: Fetch Transcript via Retell API

If Retell doesn't send transcript in webhook, fetch it separately:

```typescript
// In webhook.routes.ts, after creating analytics

// Fetch transcript from Retell API if not in webhook
if (!chat.transcript || !Array.isArray(chat.transcript)) {
  console.log('[Retell Webhook] Fetching transcript from Retell API...');

  try {
    // Get widget config for API key
    const widgetConfig = await storage.getWidgetConfigByAgentId(chatData.agentId);
    if (widgetConfig?.retellApiKey) {
      const retellClient = new Retell({ apiKey: widgetConfig.retellApiKey });

      // Fetch chat details including transcript
      const chatDetails = await retellClient.chat.retrieve(chat.chat_id);

      if (chatDetails.transcript && Array.isArray(chatDetails.transcript)) {
        console.log(
          `[Retell Webhook] Retrieved ${chatDetails.transcript.length} messages from API`,
        );

        // Store messages (same code as webhook path)
        for (const message of chatDetails.transcript) {
          await storage.createChatMessage({
            chatAnalyticsId: createdAnalytics.id,
            messageId: message.message_id || null,
            role: message.role || 'unknown',
            content: message.content || '',
            timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
            toolCallId: message.tool_call_id || null,
            nodeTransition: message.node_transition || null,
          });
        }
      }
    }
  } catch (apiError) {
    console.error('[Retell Webhook] Error fetching transcript from API:', apiError);
  }
}
```

---

## 🧪 Testing After Fix

### 1. Complete a New Chat

```bash
# Open your widget and have a conversation
# End the chat naturally
```

### 2. Check Logs

Look for this in server logs:

```
[Retell Webhook] Processing chat: chat_xxxxx - Status: ended
[Retell Webhook] Storing 5 transcript messages for chat chat_xxxxx  <-- Should see this!
```

### 3. Verify Database

```bash
npx tsx scripts/diagnose-transcript-messages.ts
```

Should show:

```
✅ Chat 1:
   Transcript Messages (stored): 5  <-- Non-zero!
```

### 4. Check Analytics UI

- Go to Analytics page
- Click on a completed chat
- Should see message-by-message transcript

---

## 📊 Expected Webhook Payload Structure

Retell **should** send:

```json
{
  "event": "chat_analyzed",
  "chat": {
    "chat_id": "chat_xxxxx",
    "agent_id": "agent_xxxxx",
    "chat_status": "ended",
    "transcript": [          // ← This field is missing!
      {
        "role": "user",
        "content": "Hello!",
        "timestamp": 1234567890,
        "message_id": "msg_1"
      },
      {
        "role": "agent",
        "content": "Hi! How can I help?",
        "timestamp": 1234567891,
        "message_id": "msg_2"
      }
    ],
    "chat_analysis": { ... },
    "cost_analysis": { ... }
  }
}
```

---

## 🔧 Enhanced Logging Added

I've added better logging to help debug. Now when a chat completes without transcript, you'll see:

```
[Retell Webhook] ⚠️ No transcript found in webhook payload for chat chat_xxxxx
[Retell Webhook] Available fields: ['chat_id', 'agent_id', 'chat_status', ...]
[Retell Webhook] Transcript field type: undefined undefined
[Retell Webhook] Full payload structure: { ... }
```

This will help us understand exactly what Retell is sending.

---

## 📝 Next Steps

1. **Check Retell Dashboard** - Enable transcript in webhook settings
2. **Complete a test chat** - Verify transcript is now included
3. **Monitor logs** - Look for the storing messages log
4. **Run diagnostic** - Confirm messages are being saved
5. **If still not working** - Implement Option 2 (API fetch)

---

## 💡 Why Two Message Tables?

Remember:

- **`widget_chat_history`**: Real-time messages (stored as chat happens)
- **`retell_transcript_messages`**: Complete analyzed transcript (sent after chat ends)

Both serve different purposes:

- Widget chat history: For continuing conversations, showing history
- Transcript messages: For analytics, reviewing AI performance, tool usage

---

## 🆘 If Issue Persists

Check:

1. Retell dashboard webhook logs for errors
2. Network connectivity between Retell and your server
3. Retell API version compatibility
4. Agent configuration in Retell dashboard

Contact Retell support if transcript is never included in `chat_analyzed` events.
