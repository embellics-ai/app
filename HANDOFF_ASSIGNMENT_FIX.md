# Handoff Assignment Fix

## Problem

When a client admin clicked "Assign to [Agent Name]" button to assign a pending handoff to a support staff member, the assignment was not working correctly:

1. ❌ The toast message said "You've been assigned to this conversation" (misleading)
2. ❌ The staff member was NOT actually assigned to the handoff
3. ❌ The handoff remained in "Pending" status instead of moving to "Active"

## Root Cause

The `/api/handoff/assign` endpoint had two major issues:

### Issue 1: Wrong Table Updates
- The endpoint was updating the `conversations` table
- However, the UI queries the `widget_handoffs` table
- These are two separate tracking systems, causing a disconnect

### Issue 2: ID Mismatch
- The frontend passes the `widget_handoff.id` as `conversationId`
- The backend was treating it as a `conversations` table ID
- This caused the update to fail silently (no matching record in conversations table)

### Issue 3: Misleading Toast Message
- The success message said "You've been assigned to this conversation"
- This implied the client admin was assigned, not the selected agent
- Caused confusion about who was actually handling the handoff

## Solution

### Backend Fix (`server/routes.ts`)

Changed the `/api/handoff/assign` endpoint to:

1. **Correctly identify the ID**: Treat `conversationId` parameter as `widget_handoff.id`
2. **Validate the handoff**: Check if handoff exists and is in `pending` status
3. **Use correct storage method**: Call `storage.assignHandoffToAgent()` which:
   - Updates `widget_handoffs` table (not conversations)
   - Sets `assignedAgentId` to the specified agent
   - Changes status from `pending` to `active`
   - Sets `pickedUpAt` timestamp
4. **Increment agent chats**: Track active chat count for the agent
5. **Broadcast via WebSocket**: Notify connected clients about the assignment
6. **Add logging**: Log assignment success for debugging

### Frontend Fixes (`client/src/pages/agent-dashboard.tsx`)

1. **Fixed toast message**:
   - Changed from "You've been assigned to this conversation"
   - To "Successfully assigned to [Agent Name]"
   - Makes it clear which agent was assigned

2. **Pass agent name**: Include agent name in mutation for better user feedback

3. **Fix query invalidation**:
   - Changed from `/api/handoff/pending` and `/api/handoff/active`
   - To `/api/widget-handoffs/pending` and `/api/widget-handoffs/active`
   - Ensures UI refreshes with correct data after assignment

## What Now Works

✅ Client admin can assign pending handoffs to available support staff  
✅ Handoff status changes from `pending` to `active`  
✅ Staff member's active chat count increments  
✅ Handoff appears in "Active Chats" tab for assigned agent  
✅ Clear toast message shows which agent was assigned  
✅ UI automatically refreshes to show updated status  

## Testing

1. **Create a handoff**:
   - Open widget test page
   - Send a message
   - Request handoff to human agent

2. **Assign from dashboard**:
   - Login as client admin
   - Go to Agent Dashboard
   - See pending handoff in "Pending Handoffs" tab
   - Click "Assign to [Agent Name]" button

3. **Verify**:
   - Toast shows "Successfully assigned to [Agent Name]"
   - Handoff disappears from Pending tab
   - Handoff appears in Active Chats tab
   - Agent's active chat count increases
   - Login as the assigned agent - they can see the chat

## Files Changed

- `server/routes.ts`: Fixed `/api/handoff/assign` endpoint (~30 lines)
- `client/src/pages/agent-dashboard.tsx`: Fixed mutation and toast message (~10 lines)

## Related Code

- `server/storage.ts`: `assignHandoffToAgent()` method (already working correctly)
- `shared/schema.ts`: `widget_handoffs` table schema
- WebSocket broadcasting for real-time updates
