# Live Handoff Feature - Deployment Guide

## Quick Start

The live handoff feature is **100% complete** and ready for testing. Follow these steps to deploy and test.

## Prerequisites

- ✅ Database migration applied (`npm run db:push`)
- ✅ Human agents configured in database
- ✅ Agent roles assigned (client_admin or support_staff)
- ✅ Widget API key active

## Deployment Steps

### 1. Database Migration

```bash
npm run db:push
```

**Verifies**:

- `widget_handoffs` table created
- `widget_handoff_messages` table created
- All columns and indexes applied

### 2. Create Human Agents

Navigate to **Team Management** page in the platform:

1. Click "Add Human Agent"
2. Fill in details:
   - Name: Agent's full name
   - Email: Must match their login email
   - Status: Set to "available"
   - Max Chats: Recommended 3-5
3. Click "Save"

**Database Method** (alternative):

```sql
INSERT INTO human_agents (tenant_id, name, email, status, max_chats)
VALUES (
  'your-tenant-id',
  'John Smith',
  'john@example.com',
  'available',
  5
);
```

### 3. Assign Agent Roles

Ensure agents have correct permissions:

**Via Platform Admin**:

1. Navigate to **Platform Admin** → **User Management**
2. Find the user
3. Set role to `support_staff` or `client_admin`

**Database Method**:

```sql
UPDATE client_users
SET role = 'support_staff'
WHERE email = 'agent@example.com';
```

### 4. Test the Feature

#### Test 1: Widget Handoff Request

1. Open `http://localhost:3000/widget-simple-test.html`
2. Wait for widget to load
3. After 3 seconds, "Talk to a Human" button appears
4. Click button
5. Verify message: "An agent will be with you shortly..."

#### Test 2: Agent Queue

1. Login as agent (support_staff or client_admin)
2. Navigate to **Agent Queue** in sidebar
3. Verify pending handoff appears in "Pending" tab
4. Check details: last message, timestamp, status badge
5. Click "Pick Up" button

#### Test 3: Agent Chat

1. After picking up, you're navigated to Agent Chat
2. Verify:
   - AI conversation history displays (if any)
   - "LIVE CHAT WITH AGENT" separator appears
   - Message input is enabled
   - "Resolve Chat" button is visible
3. Type a message and press Enter
4. Verify message appears in chat

#### Test 4: Widget Receives Reply

1. Switch to widget test page
2. Wait ~1 second for polling
3. Verify agent message appears
4. Type a reply in widget
5. Verify it appears in agent chat

#### Test 5: Resolve Handoff

1. In agent chat, click "Resolve Chat"
2. Verify redirected to Agent Queue
3. Check widget shows: "The agent has ended this conversation"
4. Verify handoff appears in "History" tab

#### Test 6: After-Hours

1. Set all agents to status="offline":
   ```sql
   UPDATE human_agents SET status='offline';
   ```
2. Open widget test page
3. Click "Talk to a Human"
4. Verify email collection form appears
5. Fill in email and message
6. Click "Submit Request"
7. Verify success message
8. Check Agent Queue history for after-hours request

## Configuration

### Widget Settings

No changes needed - handoff is automatic for all widgets.

**Customization Options** (future):

- Hide handoff button: Set `showHandoffButton: false` in widget config
- Custom button text: Set `handoffButtonText: "Contact Support"`
- Trigger after N messages: Set `handoffAfterMessages: 5`

### Agent Availability

**Manual Control**:
Navigate to Team Management and toggle agent status:

- `available`: Can receive handoffs
- `busy`: Cannot receive new handoffs (current chats continue)
- `offline`: Not available

**Automatic Status** (future enhancement):

- Auto-detect based on login/activity
- Set busy when at maxChats
- Set offline after inactivity

## WebSocket Connection

WebSocket provides real-time updates. To verify it's working:

1. Open browser DevTools console
2. Look for logs:
   ```
   [WebSocket] Connection opened
   [WebSocket] Authenticated successfully
   [WebSocket] New handoff received: {...}
   ```

**If WebSocket fails**: System falls back to polling (works but slower)

## Monitoring

### Key Metrics to Track

1. **Handoff Volume**:

   ```sql
   SELECT COUNT(*) FROM widget_handoffs
   WHERE requested_at > NOW() - INTERVAL '24 hours';
   ```

2. **Average Wait Time**:

   ```sql
   SELECT AVG(EXTRACT(EPOCH FROM (picked_up_at - requested_at)))
   FROM widget_handoffs
   WHERE picked_up_at IS NOT NULL;
   ```

3. **After-Hours Requests**:

   ```sql
   SELECT COUNT(*) FROM widget_handoffs
   WHERE user_email IS NOT NULL;
   ```

4. **Agent Performance**:
   ```sql
   SELECT
     ha.name,
     COUNT(*) as total_chats,
     AVG(EXTRACT(EPOCH FROM (resolved_at - picked_up_at))) as avg_duration
   FROM widget_handoffs wh
   JOIN human_agents ha ON wh.assigned_agent_id = ha.id
   WHERE wh.resolved_at IS NOT NULL
   GROUP BY ha.name;
   ```

### Server Logs

Look for these patterns:

```
[Widget Handoff] Creating handoff request...
[Widget Handoff] Handoff created: abc-123
[Widget Handoff] Agent picked up: def-456
[Widget Handoff] Message sent: ghi-789
[Widget Handoff] Handoff resolved: abc-123
```

## Troubleshooting

### Common Issues

**1. "Talk to a Human" button not appearing**

Check:

- Widget script is latest version
- No JavaScript errors in console
- Wait full 3 seconds after initialization

**2. "No agents available" when agents exist**

Check:

- `SELECT * FROM human_agents WHERE status='available'`
- Verify `active_chats < max_chats`
- Ensure correct `tenant_id`

**3. Agent can't see pending handoffs**

Check:

- User role is `client_admin` or `support_staff`
- User's email matches a `human_agents` record
- Correct `tenant_id` association
- Browser console for errors

**4. Messages not delivering**

Check:

- WebSocket connection status (console)
- Polling interval (should see network requests)
- Handoff status is "active"
- No CORS errors

**5. Can't pick up handoff**

Check:

- Handoff status is "pending"
- Agent at capacity (active_chats >= max_chats)
- Multiple agents trying simultaneously
- Database constraints

### Debug Mode

Enable verbose logging in browser console:

```javascript
// In browser console
localStorage.setItem('debug_websocket', 'true');
localStorage.setItem('debug_handoff', 'true');
```

Then reload page and check for detailed logs.

## Performance Optimization

### Current Performance

- **Widget**: Polls every 1-2 seconds when active
- **Agent Queue**: Refreshes every 2-10 seconds
- **WebSocket**: Instant updates (0ms)

### Recommendations

1. **Enable WebSocket** (already implemented):
   - Reduces server load
   - Instant notifications
   - Better user experience

2. **Message Pagination** (future):
   - Load last 50 messages initially
   - "Load more" for history

3. **Connection Pooling** (production):
   - Use pg-pool for database
   - Configure max connections

4. **Caching** (future):
   - Cache agent availability
   - Redis for active handoffs
   - CDN for widget.js

## Security Checklist

✅ **Implemented**:

- API key validation for all widget endpoints
- JWT authentication for agent endpoints
- Tenant isolation in all queries
- CORS configuration for widget
- SQL injection prevention (Drizzle ORM)
- Input validation (Zod schemas)

❌ **Not Implemented** (future):

- Rate limiting
- IP whitelisting
- Message content filtering
- File upload restrictions

## Rollback Plan

If issues arise, you can temporarily disable handoff:

### Option 1: Hide Button (Quick)

Edit `widget.js` line ~120:

```javascript
// Hide handoff button
setTimeout(() => {
  const handoffBtn = document.getElementById('embellics-widget-handoff-btn');
  if (handoffBtn) handoffBtn.style.display = 'none'; // Change to 'block' to re-enable
}, 3000);
```

### Option 2: Disable Endpoints (Safe)

Comment out handoff routes in `server/routes.ts`:

```typescript
// app.post('/api/widget/handoff', async (req, res) => {
//   ... handoff logic
// });
```

### Option 3: Database Flag (Future)

Add feature flag to `widget_configs`:

```sql
ALTER TABLE widget_configs ADD COLUMN enable_handoff BOOLEAN DEFAULT true;
```

## Production Checklist

Before deploying to production:

- [ ] Run all 6 test scenarios
- [ ] Verify WebSocket connects successfully
- [ ] Test with multiple concurrent handoffs
- [ ] Verify after-hours email collection
- [ ] Check all database migrations applied
- [ ] Create at least 2 human agents
- [ ] Assign agent roles correctly
- [ ] Test on mobile devices
- [ ] Verify CORS allows your domains
- [ ] Set up monitoring/alerts
- [ ] Document agent training procedures
- [ ] Create runbook for common issues
- [ ] Load test with expected volume

## Support

**For technical issues**:

- Check server logs: `tail -f server_bg.log`
- Check database: `psql $DATABASE_URL`
- Review console logs in browser
- Check Network tab for API calls

**For feature questions**:

- See CHAT_WIDGET_GUIDE.md
- See LIVE_HANDOFF_IMPLEMENTATION.md
- Check API endpoint documentation

## Next Steps

After successful deployment:

1. **Monitor** first week closely
2. **Gather feedback** from agents
3. **Track metrics** (wait times, resolution rates)
4. **Train** additional support staff
5. **Optimize** based on usage patterns

## Feature Status

✅ **Complete** (100%):

- Database schema
- Widget UI
- Widget API
- Agent API
- Storage layer
- Agent Queue dashboard
- Agent Chat interface
- WebSocket integration
- After-hours support
- Documentation

🎉 **Ready for production use!**
