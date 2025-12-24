# Retell Transcript Messages - Design Decision

**Date:** December 4, 2024  
**Decision:** Do NOT store Retell transcript messages  
**Status:** ✅ **IMPLEMENTED**

---

## 📋 Background

The `retell_transcript_messages` table was originally designed to store the complete transcript that Retell AI sends via the `chat_analyzed` webhook after a chat completes. This would include:

- Full conversation history
- Tool/function calls
- Node transitions
- Detailed metadata

---

## 🚫 Why We DON'T Store Transcripts

### **Primary Reason: Redundant Storage**

We already store messages in **real-time** in the `widget_chat_history` table as the conversation happens:

```
User sends message → Stored in widget_chat_history immediately
AI responds        → Stored in widget_chat_history immediately
Chat continues     → All messages captured in real-time
Chat ends          → Complete history already in widget_chat_history
```

Storing Retell's post-chat transcript would:

- ❌ Duplicate data we already have
- ❌ Waste database storage
- ❌ Add unnecessary processing overhead
- ❌ Complicate data synchronization

### **Benefits of Real-Time Storage**

Using `widget_chat_history`:

- ✅ Messages available immediately (no waiting for webhook)
- ✅ Can display chat history to users in real-time
- ✅ Can resume conversations seamlessly
- ✅ Single source of truth for message data

---

## 🏗️ Architecture Decision

### **What We Store:**

| Table                        | Purpose                         | When Populated            |
| ---------------------------- | ------------------------------- | ------------------------- |
| `widget_chat_history`        | Real-time conversation messages | During chat (immediate)   |
| `chat_analytics`             | Summary analytics & metadata    | After chat ends (webhook) |
| `retell_transcript_messages` | ~~Retell's transcript~~         | **NOT USED**              |

### **Workflow:**

```
1. User starts chat
   └─> Messages stored in widget_chat_history (real-time)

2. Chat continues
   └─> Each message → widget_chat_history immediately

3. Chat ends
   └─> Retell sends chat_analyzed webhook
       └─> Creates chat_analytics record (summary only)
       └─> Does NOT store transcript (redundant)

4. Viewing chat history
   └─> Query widget_chat_history (real-time messages)
   └─> Query chat_analytics (cost, duration, sentiment)
```

---

## 📊 Database Changes Made

### 1. **Webhook Handler Updated** (`server/routes/webhook.routes.ts`)

**Before:**

```typescript
// Store transcript messages in chat_messages table
if (chat.transcript && Array.isArray(chat.transcript)) {
  for (const message of chat.transcript) {
    await storage.createChatMessage({ ... });
  }
}
```

**After:**

```typescript
// NOTE: We intentionally DO NOT store Retell's transcript
// Messages are already stored in real-time in widget_chat_history
console.log('Chat analytics stored. Messages already in widget_chat_history.');
```

### 2. **Schema Documentation Updated** (`shared/schema.ts`)

Added clear comment block:

```typescript
// Retell Transcript Messages - INTENTIONALLY UNUSED
// NOTE: This table exists but is NOT populated by design
// REASON: We already store messages in real-time in widget_chat_history
// TODO: Consider removing this table in future migration
```

### 3. **Analytics Route Updated** (`server/routes/analytics.routes.ts`)

Returns empty messages array with explanation:

```typescript
res.json({
  ...chat,
  messages: [], // Not stored by design
  note: 'Real-time messages available in widget_chat_history table',
});
```

---

## 🗑️ Optional: Remove Table Entirely

If you want to completely remove the unused table from your database:

### **Migration Created:** `migrations/0015_remove_retell_transcript_messages.sql`

```sql
DROP TABLE IF EXISTS retell_transcript_messages CASCADE;
```

### **To Apply:**

```bash
npm run db:migrate
```

### **Should You Remove It?**

**Remove if:**

- ✅ You're certain you don't need Retell's post-chat transcript
- ✅ You want to simplify your schema
- ✅ You want to save a tiny bit of database overhead

**Keep if:**

- ⚠️ You might want to store transcripts in the future
- ⚠️ You're not 100% certain about this decision
- ⚠️ The empty table doesn't bother you (no real harm)

**Recommendation:** Keep the table for now. It's harmless when empty and gives you flexibility if requirements change.

---

## 🔄 If Requirements Change

If you later decide you DO need Retell's transcript data:

1. **Re-enable in webhook handler:**

   ```typescript
   // In webhook.routes.ts, restore the transcript storage code
   if (chat.transcript && Array.isArray(chat.transcript)) {
     for (const message of chat.transcript) {
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
   ```

2. **Configure Retell webhook** to include transcript

3. **Update analytics route** to return transcript messages

---

## 📝 Related Tables

For reference, here's the full message storage architecture:

### **`widget_chat_history`** (ACTIVE)

- **Purpose:** Real-time conversation messages
- **Populated:** During chat (immediately)
- **Used for:** Chat history, resuming conversations
- **Query by:** `chatId`

### **`widget_handoff_messages`** (ACTIVE)

- **Purpose:** Human agent handoff conversations
- **Populated:** During handoff
- **Used for:** Human-to-user communication
- **Query by:** `handoffId`

### **`retell_transcript_messages`** (INACTIVE)

- **Purpose:** ~~Post-chat analytics transcript~~
- **Populated:** **Never (by design)**
- **Used for:** Nothing currently
- **Query by:** N/A

---

## ✅ Summary

**Decision:** Store messages in real-time (`widget_chat_history`) only  
**Rationale:** Avoids redundant storage, provides immediate access  
**Impact:** `retell_transcript_messages` table exists but stays empty  
**Action:** Webhook handler updated to skip transcript storage  
**Future:** Can re-enable if needed, or drop table to simplify schema

**This is the correct architectural decision for this application.**
