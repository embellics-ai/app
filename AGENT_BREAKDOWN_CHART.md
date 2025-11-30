# Agent Breakdown Chart Implementation

## Overview

Added a new chart to the Enhanced Chat Analytics dashboard that displays the distribution of chats across different agents.

## Changes Made

### 1. Backend - Storage Layer (`server/storage.ts`)

#### Added Method: `getChatAnalyticsAgentBreakdown`

- **Location**: DbStorage class (line ~3063)
- **Purpose**: Aggregates chat counts grouped by agent
- **Returns**: Array of `{ agentId: string; agentName: string; count: number }`
- **Features**:
  - Filters by tenant ID
  - Optional date range filtering (startDate, endDate)
  - Groups chats by agentId
  - Uses agentName from chat data (falls back to agentId if not available)
  - Sorts results by count (descending)

#### Added Stub Implementation

- **Location**: MemStorage class (line ~1453)
- **Returns**: Empty array for in-memory storage

### 2. Backend - API Routes (`server/routes.ts`)

#### Added Endpoint: `/api/platform/tenants/:tenantId/analytics/chats/agent-breakdown`

- **Method**: GET
- **Location**: After time-series endpoint (line ~2543)
- **Auth**: Requires authentication and platform admin role
- **Query Parameters**:
  - `startDate` (optional): ISO date string
  - `endDate` (optional): ISO date string
- **Response**: Array of agent breakdown objects
- **Features**:
  - Console logging for debugging
  - Error handling with 500 status on failure

### 3. Frontend - Enhanced Analytics Component (`client/src/components/EnhancedChatAnalytics.tsx`)

#### Added Query Hook

- **Query Key**: `['chat-agent-breakdown', tenantId, startDate, endDate]`
- **Endpoint**: Calls the new agent-breakdown API
- **Conditional Loading**: Only fetches when:
  - Tenant ID exists
  - No specific agent filter is active (or agentId === 'all')

#### Added Chart Component

- **Type**: Horizontal Bar Chart (using Recharts)
- **Location**: After "User Sentiment" pie chart
- **Features**:
  - Displays agent names on Y-axis (150px width for readability)
  - Shows chat count on X-axis
  - Purple color scheme (matches theme)
  - Rounded bar edges for modern look
  - Custom tooltip with dark theme
  - Grid lines for better readability
  - Only renders when data is available
  - Hidden when filtering by specific agent (avoids redundancy)

## Visual Design

### Chart Specifications

- **Height**: 300px
- **Layout**: Horizontal bars (better for agent names)
- **Color**: Purple (`#8b5cf6`) - matches primary theme
- **Y-Axis**: Agent names (truncated if too long)
- **X-Axis**: Number of chats
- **Bar Style**: Rounded right corners (radius: [0, 4, 4, 0])

## Usage

### How to View

1. Navigate to **Platform Admin** → **Analytics** tab
2. Select a tenant from dropdown
3. Choose desired date range
4. Click **"Visualizations"** tab
5. Scroll to **"Chats by Agent"** card

### When It Appears

- ✅ Shows when viewing all agents
- ✅ Shows when data exists for multiple agents
- ❌ Hidden when filtering by specific agent
- ❌ Hidden when no agent data available

## Data Flow

```
User Request
    ↓
Frontend Query (React Query)
    ↓
API Endpoint (/api/platform/tenants/:tenantId/analytics/chats/agent-breakdown)
    ↓
Auth Middleware (requireAuth, requirePlatformAdmin)
    ↓
Storage Method (getChatAnalyticsAgentBreakdown)
    ↓
Database Query (PostgreSQL via Drizzle)
    ↓
Data Aggregation (Group by agentId)
    ↓
Response (JSON array)
    ↓
Frontend Rendering (Recharts BarChart)
```

## Example Response

```json
[
  {
    "agentId": "agent-123",
    "agentName": "Customer Support Bot",
    "count": 145
  },
  {
    "agentId": "agent-456",
    "agentName": "Sales Assistant",
    "count": 89
  },
  {
    "agentId": "agent-789",
    "agentName": "Technical Support",
    "count": 62
  }
]
```

## Performance Considerations

- **Caching**: React Query caches results based on tenant, startDate, and endDate
- **Conditional Loading**: Only fetches when viewing all agents (saves API calls)
- **Database**: Uses existing indexes on chatAnalytics table
- **Sorting**: Done in backend for efficiency

## Future Enhancements (Optional)

1. **Click-to-Filter**: Click on agent bar to filter all analytics by that agent
2. **Pie Chart Alternative**: Toggle between bar and pie chart views
3. **Percentage Labels**: Show percentage alongside count
4. **Color Coding**: Different colors for different agents
5. **Agent Comparison**: Side-by-side metrics for selected agents
6. **Export**: Download agent breakdown data as CSV

## Testing

To test the implementation:

1. Ensure you have chat data with multiple agents in the database
2. Start the development server: `npm run dev`
3. Login as platform admin
4. Navigate to Analytics → Select tenant → Visualizations tab
5. Verify the "Chats by Agent" chart appears with data
6. Test date range filtering to ensure counts update correctly
7. Test agent filtering - chart should hide when specific agent selected

## Files Modified

1. `/server/storage.ts` - Added agent breakdown method
2. `/server/routes.ts` - Added API endpoint
3. `/client/src/components/EnhancedChatAnalytics.tsx` - Added chart component

## Summary

This implementation provides a clean, visual way to see which agents are handling the most chats, helping platform administrators:

- Identify busiest agents
- Balance workload distribution
- Monitor agent activity trends
- Make data-driven decisions about agent allocation

The chart integrates seamlessly with the existing Enhanced Chat Analytics dashboard and follows the same design patterns and styling conventions.
