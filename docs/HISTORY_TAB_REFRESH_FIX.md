# History Tab Refresh Fix

## Issue

After a chat is ended (either by the agent from the dashboard or by the user from the widget), the History tab in the Agent Queue page doesn't show the newly resolved chat unless the page is manually reloaded.

## Root Cause

The History tab was relying only on periodic polling (refetchInterval: 10 seconds) to update the list of handoffs. While WebSocket events were being sent when handoffs were resolved, there were two issues:

1. **Missing WebSocket invalidation**: The `handoff_resolved` WebSocket event handler wasn't invalidating the pending handoffs query, so resolved chats remained visible in the pending tab
2. **No tab-switch refresh**: When users switched to the History tab, there was no mechanism to force a fresh data fetch

## Solution

### 1. Enhanced WebSocket Handler

Updated `/client/src/hooks/use-websocket.ts` to invalidate all relevant queries when a handoff is resolved:

```typescript
if (message.type === 'handoff_resolved') {
  const { handoffId } = message.payload;
  console.log('[WebSocket] Handoff resolved:', handoffId);
  // Invalidate all handoff queries (pending, active, and history)
  queryClient.invalidateQueries({
    queryKey: ['/api/widget-handoffs/pending'],
  });
  queryClient.invalidateQueries({
    queryKey: ['/api/widget-handoffs/active'],
  });
  queryClient.invalidateQueries({
    queryKey: ['/api/widget-handoffs'], // History
  });
  queryClient.invalidateQueries({
    queryKey: [`/api/widget-handoffs/${handoffId}`],
  });
}
```

**What changed**: Added invalidation for `/api/widget-handoffs/pending` query, ensuring resolved chats are immediately removed from the pending list.

### 2. Tab-Switch Refresh

Added a `useEffect` hook in `/client/src/pages/agent-queue.tsx` to force data refresh when switching to the History tab:

```typescript
// Refetch history when switching to history tab
useEffect(() => {
  if (activeTab === 'history') {
    queryClient.invalidateQueries({ queryKey: ['/api/widget-handoffs'] });
  }
}, [activeTab]);
```

**How it works**: Whenever the user clicks the History tab, React Query immediately refetches the handoffs data, ensuring the latest resolved chats are displayed.

### 3. Reduced Polling Interval

Updated the history query polling interval from 10 seconds to 5 seconds:

```typescript
// Fetch all handoffs for history
const { data: allHandoffs = [], isLoading: allLoading } = useQuery<WidgetHandoff[]>({
  queryKey: ['/api/widget-handoffs'],
  refetchInterval: 5000, // Refresh every 5 seconds (WebSocket provides real-time updates)
});
```

**Rationale**: Since WebSocket now handles real-time updates, the polling interval serves as a fallback. Reducing it to 5 seconds provides better UX while still preventing excessive server load.

## How It Works Now

### Scenario 1: Agent Resolves Chat

1. Agent clicks "Resolve Chat" button in dashboard
2. Backend updates handoff status to "resolved"
3. Backend broadcasts `handoff_resolved` WebSocket event
4. **All connected clients** receive the event
5. React Query invalidates all handoff-related queries
6. Agent Queue page automatically:
   - Removes chat from Active tab
   - Removes chat from Pending tab (if applicable)
   - **Adds chat to History tab immediately**

### Scenario 2: User Ends Chat from Widget

1. User clicks "End Chat" → Confirms in modal
2. Widget sends POST to `/api/widget/end-chat`
3. Backend resolves handoff and broadcasts WebSocket event
4. Same query invalidation flow as Scenario 1
5. Agent sees chat move to History in real-time

### Scenario 3: User Manually Switches to History Tab

1. User clicks "History" tab
2. `useEffect` hook detects tab change
3. React Query invalidates `/api/widget-handoffs` query
4. **Fresh data fetched from server immediately**
5. All resolved chats (including most recent) are displayed

### Scenario 4: WebSocket Disconnected (Fallback)

1. WebSocket connection drops
2. Polling mechanism takes over
3. History refreshes every 5 seconds automatically
4. User can also manually click History tab to force refresh

## Testing Checklist

### ✅ Real-time Update (WebSocket Active)

- [ ] Start a chat in widget
- [ ] Agent picks up the chat
- [ ] Agent resolves chat from dashboard
- [ ] **Verify**: History tab shows resolved chat immediately (without refresh)
- [ ] User ends chat from widget
- [ ] **Verify**: History tab shows resolved chat immediately

### ✅ Manual Tab Switch

- [ ] Have multiple resolved chats in database
- [ ] View Pending or Active tab
- [ ] Click History tab
- [ ] **Verify**: All resolved chats load immediately (no stale data)

### ✅ Fallback Polling

- [ ] Disconnect WebSocket (close browser DevTools network, or disable network briefly)
- [ ] Resolve a chat
- [ ] **Verify**: History tab updates within 5 seconds

### ✅ Mixed Scenarios

- [ ] Have chats in Pending, Active, and History
- [ ] Resolve an active chat
- [ ] **Verify**: Chat disappears from Active and appears in History
- [ ] **Verify**: Pending and Active counts update correctly

## Technical Details

### React Query Invalidation

- **What it does**: Marks cached data as stale and triggers a background refetch
- **When it happens**:
  - WebSocket `handoff_resolved` event received
  - User switches to History tab
  - Automatic polling interval (5 seconds)
- **Performance**: Efficient because React Query deduplicates simultaneous requests

### WebSocket Event Flow

```
Widget/Dashboard Action
    ↓
Backend Server
    ↓
wss.clients.forEach() broadcasts
    ↓
All connected browsers receive event
    ↓
useWebSocket hook processes message
    ↓
queryClient.invalidateQueries()
    ↓
React Query refetches data
    ↓
UI updates automatically
```

### Query Keys Structure

```typescript
'/api/widget-handoffs/pending'; // Pending handoffs only
'/api/widget-handoffs/active'; // Active handoffs only
'/api/widget-handoffs'; // All handoffs (History)
'/api/widget-handoffs/:id'; // Specific handoff details
```

## Benefits

### User Experience

✅ **Instant Feedback**: Agents see chats move to history immediately  
✅ **No Manual Refresh**: Eliminates need to reload the page  
✅ **Always Up-to-Date**: History tab shows latest data on every visit  
✅ **Reliable**: Fallback polling ensures updates even if WebSocket fails

### Technical

✅ **Real-time**: WebSocket provides sub-second latency  
✅ **Efficient**: Query invalidation only refetches when needed  
✅ **Resilient**: Multiple fallback mechanisms (WebSocket + polling + manual)  
✅ **Scalable**: Minimal server load with smart caching

## Related Files

- `/client/src/hooks/use-websocket.ts` - WebSocket event handlers
- `/client/src/pages/agent-queue.tsx` - Tab-switch refresh logic
- `/server/routes.ts` - Backend endpoints and WebSocket broadcasts

## Future Enhancements

- Add toast notification when new chat appears in History
- Add "pull to refresh" gesture for mobile
- Implement optimistic UI updates for faster perceived performance
- Add analytics to track how often users manually refresh vs. real-time updates
