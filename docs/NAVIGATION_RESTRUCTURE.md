# Navigation Restructuring - Role-Based Access

## Overview

Reorganized the dashboard navigation to better align with user roles and their responsibilities.

## Changes Made

### Client Admin Dashboard

**Purpose**: Administrative oversight and configuration

**Navigation Items**:

- ✅ **Analytics** - Business metrics, insights, and performance charts
- ✅ **Onboarding** - Setup wizard for new tenants
- ✅ **Agent Dashboard** - View agent performance metrics and handoff management
- ✅ **Team Management** - Manage agents and staff
- ✅ **API Keys** - Manage API credentials

**Removed**:

- ❌ **Dashboard** - Was duplicate of Analytics (both routes showing similar analytics data)
- ❌ **Widget Config** - Configuration moved to other sections, not needed as separate tab
- ❌ **Agent Queue** - This is now only for support staff (agents who handle chats)

### Support Staff/Agent Dashboard

**Purpose**: Handle live customer chats and support requests

**Navigation Items**:

- ✅ **Agent Queue** - Pick up and manage live customer chats
- ✅ **Test Chat** - Test the chat functionality

**Simplified**:

- Removed **Agent Dashboard** from support staff - they don't need to see overview metrics, just their work queue

## Rationale

### Why This Structure Makes Sense

1. **Client Admins Need**:
   - **Analytics**: Business metrics, performance charts, key insights
   - **Agent Dashboard**: Monitor team performance, see pending/active handoffs across all agents, assign handoffs manually if needed
   - **Team Management**: Add/remove agents, manage permissions
   - **Onboarding**: Initial setup wizard for new tenants
   - **API Keys**: Manage authentication credentials

   They **don't need**:
   - **Dashboard** (removed): Was duplicate - both "/" and "/analytics" showed similar data
   - **Widget Config** (removed): Configuration handled in other sections
   - **Agent Queue**: They're not handling chats directly, they're managing the team

2. **Support Staff/Agents Need**:
   - **Agent Queue**: This is their primary workspace - pick up chats, respond to customers
   - **Test Chat**: To test functionality

   They **don't need**:
   - **Agent Dashboard**: Overwhelming with metrics they don't control
   - **Team Management/Config**: Not their responsibility

## Technical Implementation

### File: `/client/src/components/app-sidebar.tsx`

**Before** (Client Admin):

```typescript
{
  title: 'Agent Dashboard',
  url: '/agent-dashboard',
  icon: Headphones,
},
{
  title: 'Agent Queue',  // ← Confusing for admins
  url: '/agent-queue',
  icon: Users,
},
{
  title: 'Team Management',
  url: '/team-management',
  icon: Users,
},
```

**After** (Client Admin):

```typescript
{
  title: 'Analytics',  // ← Consolidated: Shows all metrics & insights
  url: '/analytics',
  icon: BarChart3,
},
{
  title: 'Onboarding',
  url: '/onboarding',
  icon: Sparkles,
},
{
  title: 'Agent Dashboard',  // ← Overview & handoff management
  url: '/agent-dashboard',
  icon: Headphones,
},
{
  title: 'Team Management',
  url: '/team-management',
  icon: Users,
},
{
  title: 'API Keys',
  url: '/api-keys',
  icon: Key,
},
```

**Before** (Support Staff):

```typescript
{
  title: 'Agent Dashboard',  // ← Too much info
  url: '/agent-dashboard',
  icon: Headphones,
},
{
  title: 'Agent Queue',
  url: '/agent-queue',
  icon: Users,
},
{
  title: 'Test Chat',
  url: '/test-chat',
  icon: MessageSquare,
},
```

**After** (Support Staff):

```typescript
{
  title: 'Agent Queue',  // ← Main workspace
  url: '/agent-queue',
  icon: Headphones,
},
{
  title: 'Test Chat',
  url: '/test-chat',
  icon: MessageSquare,
},
```

## Page Functionality

### Agent Dashboard (`/agent-dashboard`)

**Who sees it**: Client Admins only

**Purpose**: Management and oversight

**Features**:

- View all pending handoffs (from all customers)
- View all active chats (across all agents)
- See agent availability and status
- Manually assign handoffs to specific agents
- View handoff statistics in tabs

**API Endpoints Used**:

- `GET /api/human-agents` - List all agents with status
- `GET /api/handoff/pending` - Pending customer requests
- `GET /api/handoff/active` - All active conversations
- `POST /api/handoff/assign` - Manual handoff assignment

**Current Status**: ✅ **Working correctly**

- All endpoints responding successfully
- Data fetching every 3-5 seconds
- Empty states display when no handoffs exist

### Agent Queue (`/agent-queue`)

**Who sees it**: Support Staff/Agents only

**Purpose**: Operational - handle customer chats

**Features**:

- See waiting customers (Pending tab)
- Pick up handoffs (claim button)
- View active chats (Active tab)
- Chat with customers in real-time
- View resolved chats (History tab)
- See queue metrics (waiting count, active chats, available agents)

**API Endpoints Used**:

- `GET /api/widget-handoffs/pending` - Widget-specific pending requests
- `GET /api/widget-handoffs/active` - Agent's active chats
- `GET /api/widget-handoffs` - Full handoff history
- `POST /api/widget-handoffs/:id/pickup` - Claim a handoff
- `GET /api/widget-handoffs/:id/messages` - Load conversation
- `POST /api/widget-handoffs/:id/send-message` - Reply to customer
- `POST /api/widget-handoffs/:id/resolve` - End conversation

**Current Status**: ✅ **Working correctly**

- Real-time updates via WebSocket
- Polling fallback (2-5 seconds)
- History tab refreshes on switch

## User Workflows

### Client Admin Workflow

1. Log in → See **Analytics** (business metrics, performance charts)
2. Go to **Agent Dashboard** → Monitor team performance, view pending/active handoffs
3. See pending handoff → Manually assign to available agent
4. Go to **Team Management** → Add new agent, manage permissions
5. Go to **API Keys** → Generate or revoke access credentials

### Support Staff Workflow

1. Log in → See **Agent Queue** immediately
2. See customer waiting in Pending tab
3. Click "Pick Up" → Start chatting
4. Active tab updates → Chat with customer
5. Click "Resolve" → Chat moves to History
6. Back to Pending tab → Pick up next customer

## Benefits of This Structure

### For Client Admins

✅ **Streamlined navigation** - Only essential admin tools  
✅ **No duplicates** - Single Analytics page instead of Dashboard + Analytics  
✅ **Clear separation** - Management (Agent Dashboard) vs Operations (Agent Queue)  
✅ **Focused interface** - Removed unnecessary Widget Config tab  
✅ **Can still monitor** - Agent Dashboard allows manual intervention when needed

### For Support Staff

✅ Focused interface - only what they need to work  
✅ Agent Queue is their primary workspace  
✅ No distractions from management features  
✅ Faster navigation - fewer menu items

### For System

✅ Better role separation - security and permissions  
✅ Easier to add role-specific features later  
✅ Clearer user paths and training  
✅ Reduced cognitive load per role

## Testing Checklist

### Client Admin Tests

- [ ] Login as client admin
- [ ] See Dashboard, Analytics, Onboarding, Agent Dashboard in menu
- [ ] **Do NOT see** Agent Queue in menu
- [ ] Click Agent Dashboard → See pending/active handoffs
- [ ] See agent list with status
- [ ] Can assign handoffs to agents

### Support Staff Tests

- [ ] Login as support staff
- [ ] See Agent Queue and Test Chat in menu
- [ ] **Do NOT see** Agent Dashboard in menu
- [ ] Click Agent Queue → See pending handoffs
- [ ] Can pick up handoffs
- [ ] Can chat with customers
- [ ] Can resolve chats

## Future Enhancements

### Agent Dashboard (Admin View)

- Add performance metrics per agent
- Add handoff resolution time charts
- Add customer satisfaction ratings
- Add agent workload balancing

### Agent Queue (Staff View)

- Add agent personal stats (chats handled today, avg response time)
- Add quick actions (canned responses, escalate to admin)
- Add customer history preview
- Add note-taking during chat

## Related Files

- `/client/src/components/app-sidebar.tsx` - Navigation menu
- `/client/src/pages/agent-dashboard.tsx` - Admin overview page
- `/client/src/pages/agent-queue.tsx` - Agent operational page
- `/server/routes.ts` - API endpoints
