# Agent Chat Interface Messages Fix

## Overview

Fixed the "No messages yet" issue in the Agent Chat Interface by updating to use the correct API endpoints and data types for widget handoff messages.

**Date**: November 20, 2025
**Impact**: Messages now load correctly in the chat dialog

## Issue

**Problem**: Chat dialog showed "No messages yet" even when messages existed.

**Root Causes**:

1. Wrong API endpoint: Used `/api/conversations/:id/messages` (doesn't exist for widget handoffs)
2. Wrong message type: Used `Message` type with fields that don't match database schema
3. Wrong send message endpoint: Used `/api/handoff/send-message` instead of widget-specific endpoint
4. Wrong complete endpoint: Used `/api/handoff/complete` instead of widget resolve endpoint
5. Wrong sender types: Used 'ai', 'human' instead of 'agent', 'system'

## Changes Implemented

### 1. Updated Message Type Definition

**Before**:

```tsx
type Message = {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  senderType: string;
  humanAgentId?: string;
  timestamp: Date;
};
```

**After**:

```tsx
type WidgetHandoffMessage = {
  id: string;
  handoffId: string;
  senderType: string; // 'user', 'agent', 'system'
  senderId?: string | null;
  content: string;
  timestamp: string;
};
```

**Matches Database Schema**:

```typescript
export const widgetHandoffMessages = pgTable('widget_handoff_messages', {
  id: varchar('id').primaryKey(),
  handoffId: varchar('handoff_id').notNull(),
  senderType: text('sender_type').notNull(), // user, agent, system
  senderId: varchar('sender_id'), // humanAgents.id for agent messages
  content: text('content').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});
```

### 2. Fixed Fetch Messages Endpoint

**Before**:

```tsx
const { data: messages = [] } = useQuery<Message[]>({
  queryKey: ['/api/conversations', conversationId, 'messages'],
  refetchInterval: 2000,
});
```

**After**:

```tsx
const { data: messages = [] } = useQuery<WidgetHandoffMessage[]>({
  queryKey: ['/api/widget-handoffs', conversationId, 'messages'],
  refetchInterval: 2000,
});
```

**Backend Endpoint**: `GET /api/widget-handoffs/:id/messages`

### 3. Fixed Send Message Mutation

**Before**:

```tsx
const sendMessageMutation = useMutation({
  mutationFn: async (content: string) => {
    return apiRequest('POST', '/api/handoff/send-message', {
      conversationId,
      content,
      humanAgentId: handoff.assignedAgentId,
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: ['/api/conversations', conversationId, 'messages'],
    });
  },
});
```

**After**:

```tsx
const sendMessageMutation = useMutation({
  mutationFn: async (content: string) => {
    return apiRequest('POST', `/api/widget-handoffs/${conversationId}/send-message`, {
      message: content,
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: ['/api/widget-handoffs', conversationId, 'messages'],
    });
  },
});
```

**Key Changes**:

- Endpoint: `/api/widget-handoffs/:id/send-message`
- Payload: `{ message: string }` instead of `{ content: string, conversationId, humanAgentId }`
- Query invalidation: Updated to match new query key

### 4. Fixed Complete Handoff Mutation

**Before**:

```tsx
const completeMutation = useMutation({
  mutationFn: async () => {
    return apiRequest('POST', '/api/handoff/complete', {
      conversationId,
      humanAgentId: handoff.assignedAgentId,
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/handoff/active'] });
  },
});
```

**After**:

```tsx
const completeMutation = useMutation({
  mutationFn: async () => {
    return apiRequest('POST', `/api/widget-handoffs/${conversationId}/resolve`, {});
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/widget-handoffs/active'] });
    queryClient.invalidateQueries({ queryKey: ['/api/widget-handoffs'] });
  },
});
```

**Key Changes**:

- Endpoint: `/api/widget-handoffs/:id/resolve`
- No payload needed (endpoint knows the ID)
- Query invalidation: Updated to widget-handoffs keys

### 5. Fixed Sender Type Labels

**Before**:

```tsx
const getSenderIcon = (senderType: string) => {
  switch (senderType) {
    case 'user':
      return <User className="h-4 w-4" />;
    case 'ai':
      return <Bot className="h-4 w-4" />;
    case 'human':
      return <Headphones className="h-4 w-4" />;
  }
};

const getSenderLabel = (senderType: string) => {
  switch (senderType) {
    case 'user':
      return 'Customer';
    case 'ai':
      return 'AI Agent';
    case 'human':
      return currentAgent?.name || 'Human Agent';
  }
};
```

**After**:

```tsx
const getSenderIcon = (senderType: string) => {
  switch (senderType) {
    case 'user':
      return <User className="h-4 w-4" />;
    case 'agent':
      return <Headphones className="h-4 w-4" />;
    case 'system':
      return <Bot className="h-4 w-4" />;
  }
};

const getSenderLabel = (senderType: string) => {
  switch (senderType) {
    case 'user':
      return 'Customer';
    case 'agent':
      return currentAgent?.name || 'Agent';
    case 'system':
      return 'System';
  }
};
```

**Sender Types**:

- `user` - Messages from the customer
- `agent` - Messages from human support agents
- `system` - System notifications or AI messages

## API Endpoints Used

### GET /api/widget-handoffs/:id/messages

**Purpose**: Fetch all messages for a specific handoff

**Response**:

```json
[
  {
    "id": "msg-123",
    "handoffId": "handoff-456",
    "senderType": "user",
    "senderId": null,
    "content": "Hi, I need help",
    "timestamp": "2025-11-20T10:30:00Z"
  },
  {
    "id": "msg-124",
    "handoffId": "handoff-456",
    "senderType": "agent",
    "senderId": "agent-789",
    "content": "Hello! How can I help you?",
    "timestamp": "2025-11-20T10:31:00Z"
  }
]
```

### POST /api/widget-handoffs/:id/send-message

**Purpose**: Send a message as the assigned agent

**Request**:

```json
{
  "message": "I can help you with that"
}
```

**Response**:

```json
{
  "id": "msg-125",
  "handoffId": "handoff-456",
  "senderType": "agent",
  "senderId": "agent-789",
  "content": "I can help you with that",
  "timestamp": "2025-11-20T10:32:00Z"
}
```

### POST /api/widget-handoffs/:id/resolve

**Purpose**: Mark the handoff as resolved/complete

**Request**: Empty body `{}`

**Response**:

```json
{
  "id": "handoff-456",
  "status": "resolved",
  "resolvedAt": "2025-11-20T10:35:00Z"
}
```

**Side Effects**:

- Updates handoff status to 'resolved'
- Sets `resolvedAt` timestamp
- Decrements agent's active chat count
- Broadcasts WebSocket event to all connected clients

## Data Flow

### Fetching Messages

```
Component mounts
  ↓
useQuery triggers GET /api/widget-handoffs/:id/messages
  ↓
Backend fetches from widget_handoff_messages table
  ↓
Returns array of WidgetHandoffMessage objects
  ↓
Component renders messages with icons/labels
  ↓
Auto-refetches every 2 seconds
```

### Sending Messages

```
User types message and hits Send
  ↓
sendMessageMutation.mutate(content)
  ↓
POST /api/widget-handoffs/:id/send-message
  ↓
Backend validates agent is assigned
  ↓
Inserts into widget_handoff_messages table
  ↓
Broadcasts to WebSocket clients
  ↓
Returns saved message
  ↓
Invalidates message query
  ↓
Messages refetch automatically
  ↓
New message appears in chat
```

### Completing Handoff

```
Agent clicks "Complete Handoff"
  ↓
completeMutation.mutate()
  ↓
POST /api/widget-handoffs/:id/resolve
  ↓
Backend updates status to 'resolved'
  ↓
Sets resolvedAt timestamp
  ↓
Decrements agent active chats
  ↓
Broadcasts handoff_resolved event
  ↓
Invalidates queries
  ↓
Dialog closes
  ↓
Handoff moves to history
```

## Testing Checklist

### Message Display

- [x] Login as support agent
- [x] Pick up a handoff from Agent Queue
- [x] Navigate to Agent Dashboard → History
- [x] Click "View Chat" on resolved conversation
- [x] Verify messages load (no "No messages yet")
- [x] Verify user messages show with User icon
- [x] Verify agent messages show with Headphones icon
- [x] Verify system messages show with Bot icon
- [x] Verify message timestamps are correct
- [x] Verify sender labels are correct

### Sending Messages

- [x] Type message in text area
- [x] Click send button
- [x] Verify message appears in chat
- [x] Verify message has correct sender (agent)
- [x] Verify timestamp is current
- [x] Verify input clears after send
- [x] Verify toast notification appears
- [x] Test Enter key to send
- [x] Test Shift+Enter for new line

### Completing Handoff

- [x] Click "Complete Handoff" button
- [x] Verify confirmation (if any)
- [x] Verify dialog closes
- [x] Verify handoff moves to history tab
- [x] Verify handoff shows "Resolved" badge
- [x] Verify agent's active chat count decrements
- [x] Re-open chat → Verify messages still visible

### Edge Cases

- [x] No messages → Shows "No messages yet"
- [x] Very long message → Text wraps properly
- [x] Many messages → Scrolling works
- [x] Auto-scroll to bottom on new message
- [x] Network error on send → Error toast
- [x] Network error on load → Error state

## Debugging Notes

### Why Messages Weren't Loading

**Investigation**:

1. Opened browser dev tools → Network tab
2. Looked for API calls when opening chat dialog
3. Found: `GET /api/conversations/:id/messages` returning 404
4. Checked server routes → No such endpoint exists for widget handoffs
5. Found correct endpoint: `/api/widget-handoffs/:id/messages`

**Solution**:

- Changed query key from `/api/conversations` to `/api/widget-handoffs`
- Updated type from `Message` to `WidgetHandoffMessage`
- All messages now load correctly

### Why Send Wasn't Working

**Investigation**:

1. Tried sending message → Got error toast
2. Checked browser console → 404 on `/api/handoff/send-message`
3. Checked server routes → Found `/api/widget-handoffs/:id/send-message`
4. Checked request payload → Was sending `{ content }`, needs `{ message }`

**Solution**:

- Changed endpoint to `/api/widget-handoffs/:id/send-message`
- Changed payload from `{ content }` to `{ message }`
- Messages now send successfully

## Related Files Modified

1. `/client/src/components/agent-chat-interface.tsx`
   - Type definition: `Message` → `WidgetHandoffMessage`
   - Fetch endpoint: `/api/conversations` → `/api/widget-handoffs`
   - Send endpoint: `/api/handoff/send-message` → `/api/widget-handoffs/:id/send-message`
   - Complete endpoint: `/api/handoff/complete` → `/api/widget-handoffs/:id/resolve`
   - Sender types: 'ai', 'human' → 'agent', 'system'
   - Query invalidations updated

## Benefits

### For Users

- **Messages Load**: Can now see conversation history
- **Can Reply**: Send messages to customers
- **Can Complete**: Mark conversations as resolved
- **Real-time**: Messages update every 2 seconds

### For Development

- **Type Safety**: Correct types match database schema
- **Consistency**: Uses same endpoints as Agent Queue
- **Maintainability**: Clear data flow
- **Debugging**: Easy to trace API calls

## Conclusion

The Agent Chat Interface now correctly loads and displays messages from widget handoffs. All CRUD operations (read messages, send messages, resolve handoffs) work correctly with the proper API endpoints.

**Result**: Agents can view conversation history, send messages to customers, and mark conversations as complete. The "No messages yet" issue is completely resolved.
