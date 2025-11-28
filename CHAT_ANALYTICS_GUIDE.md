# Chat Analytics Guide

## Overview

The Chat Analytics feature provides comprehensive analytics for Retell AI chat agents. Since Retell AI only provides analytics for voice agents, this custom implementation captures and displays chat analytics data.

## Features

### 1. Analytics Dashboard
The analytics dashboard is accessible from the Platform Admin page under the "Analytics" tab.

#### Dashboard Tabs

**Overview Tab**
- **Summary Cards**: Display key metrics at a glance
  - Total Chats: Total number of chat sessions in selected time range
  - Success Rate: Percentage of successful chat completions
  - Average Duration: Mean duration of chat sessions
  - Total Cost: Cumulative cost across all chats
- **Sentiment Distribution**: Visual breakdown of user sentiment (Positive, Neutral, Negative, Unknown)
- **Recent Chat Sessions**: Table showing the 10 most recent chats

**Chat Sessions Tab**
- Comprehensive table of all chat sessions with:
  - Timestamp
  - Agent Name
  - Duration
  - Message Count
  - Sentiment (with color-coded badges)
  - Status (Success/Failure)
  - Cost
- Shows up to 50 most recent sessions

**Sentiment Analysis Tab**
- Detailed sentiment breakdown with:
  - Count and percentage for each sentiment type
  - Visual progress bars
  - Success rate correlation
  - Color-coded indicators (Green: Positive, Blue: Neutral, Yellow: Negative, Gray: Unknown)

**Cost Tracking Tab**
- Financial analytics including:
  - Total Cost: Cumulative cost for selected period
  - Average Cost per Chat: Mean cost calculation
  - Daily Cost Breakdown: Chart showing costs over time

### 2. Filtering Options

**Time Range Filter**
- Last 24 Hours
- Last 7 Days
- Last 30 Days
- Last 90 Days

**Agent Filter**
- Filter by specific agent
- "All Agents" option to view combined data

**Auto-Refresh**
- Dashboard automatically refreshes every 60 seconds
- Ensures real-time data visibility

## Architecture

### Database Schema

**chat_analytics Table**
```typescript
{
  id: string (UUID)
  chatId: string (from Retell AI)
  tenantId: string (organization reference)
  agentId: string (Retell AI agent ID)
  agentName: string
  transcript: string (full conversation)
  messageCount: number
  chatSummary: text
  userSentiment: 'positive' | 'neutral' | 'negative' | 'unknown'
  chatSuccessful: boolean
  combinedCost: numeric (total cost)
  productCosts: jsonb (breakdown by product)
  chatStartTimestamp: timestamp
  chatEndTimestamp: timestamp
  chatDuration: number (seconds)
  disconnectionReason: string
  retellLlmUsage: jsonb (LLM usage stats)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**chat_messages Table**
```typescript
{
  id: string (UUID)
  chatAnalyticsId: string (foreign key)
  messageId: string
  role: string (user/assistant/system)
  content: text
  timestamp: timestamp
  toolCallId: string (optional)
}
```

**Indexes**
- `tenant_chat_idx`: (tenantId, chatStartTimestamp) - Optimizes tenant queries
- `tenant_agent_idx`: (tenantId, agentId) - Optimizes agent filtering
- `sentiment_idx`: (userSentiment) - Optimizes sentiment queries
- `chat_messages_idx`: (chatAnalyticsId) - Optimizes message lookups

### API Endpoints

All endpoints require platform admin authentication.

#### GET /api/platform/tenants/:id/analytics/overview
Returns combined voice and chat analytics overview.

**Query Parameters:**
- `startDate` (optional): ISO timestamp for date range start
- `endDate` (optional): ISO timestamp for date range end
- `agentId` (optional): Filter by specific agent

**Response:**
```json
{
  "voice": {
    "totalCalls": number,
    "successfulCalls": number,
    "avgDuration": number,
    "totalCost": number
  },
  "chat": {
    "totalChats": number,
    "successfulChats": number,
    "avgDuration": number,
    "totalCost": number,
    "sentimentBreakdown": {
      "positive": number,
      "neutral": number,
      "negative": number,
      "unknown": number
    }
  }
}
```

#### GET /api/platform/tenants/:id/analytics/chats
Returns list of chat sessions with filtering.

**Query Parameters:**
- `startDate` (optional): ISO timestamp
- `endDate` (optional): ISO timestamp
- `agentId` (optional): Filter by agent ID
- `sentiment` (optional): Filter by sentiment ('positive' | 'neutral' | 'negative' | 'unknown')
- `chatStatus` (optional): Filter by status ('successful' | 'failed')
- `limit` (optional): Max results (default: 50)

**Response:**
```json
{
  "chats": [
    {
      "id": string,
      "chatId": string,
      "agentId": string,
      "agentName": string,
      "messageCount": number,
      "userSentiment": string,
      "chatSuccessful": boolean,
      "combinedCost": number,
      "chatStartTimestamp": string,
      "chatEndTimestamp": string,
      "chatDuration": number
    }
  ]
}
```

#### GET /api/platform/tenants/:id/analytics/chats/:chatId
Returns detailed chat information including full transcript and messages.

**Response:**
```json
{
  "chat": {
    // All fields from chat_analytics table
    "messages": [
      {
        "role": string,
        "content": string,
        "timestamp": string
      }
    ]
  }
}
```

#### GET /api/platform/tenants/:id/analytics/sentiment
Returns sentiment distribution analytics.

**Query Parameters:**
- `startDate` (optional)
- `endDate` (optional)
- `agentId` (optional)

**Response:**
```json
{
  "sentimentBreakdown": {
    "positive": number,
    "neutral": number,
    "negative": number,
    "unknown": number
  },
  "totalChats": number,
  "successfulChats": number
}
```

#### GET /api/platform/tenants/:id/analytics/costs
Returns cost tracking data.

**Query Parameters:**
- `startDate` (optional)
- `endDate` (optional)
- `agentId` (optional)

**Response:**
```json
{
  "totalCost": number,
  "averageCost": number,
  "dailyCosts": [
    {
      "date": string,
      "cost": number
    }
  ]
}
```

### Webhook Endpoint

#### POST /api/retell/chat-analyzed
Receives `chat_analyzed` events from Retell AI.

**Authentication:** 
- Public endpoint (no JWT required)
- Uses Retell signature verification (to be implemented)

**Expected Payload:**
```json
{
  "event": "chat_analyzed",
  "chat": {
    "chat_id": string,
    "agent_id": string,
    "metadata": {
      "tenant_id": string  // Required for tenant association
    },
    "transcript": string,
    "transcript_with_tool_calls": string,
    "recording_url": string,
    "public_log_url": string,
    "start_timestamp": number,
    "end_timestamp": number,
    "duration": number,
    "disconnection_reason": string,
    "call_successful": boolean,
    "call_analysis": {
      "user_sentiment": string,
      "call_summary": string
    },
    "retell_llm_dynamic_variables": object,
    "opt_out_sensitive_data_storage": boolean,
    "cost_analysis": {
      "combined": number,
      "product_costs": object
    },
    "retell_llm_usage": object
  }
}
```

**Process Flow:**
1. Receive webhook event
2. Extract tenant_id from metadata
3. Verify tenant exists
4. Parse chat data and transcript
5. Store in chat_analytics table
6. Store individual messages in chat_messages table
7. Return 200 OK

## Setup Guide

### 1. Database Migration

Run the database migration to create required tables:

```bash
npm run db:push
```

This will create:
- `chat_analytics` table
- `chat_messages` table
- Required indexes

### 2. Configure Retell AI Webhook

In your Retell AI dashboard:

1. Navigate to **Settings** → **Webhooks**
2. Add a new webhook URL:
   ```
   https://yourdomain.com/api/retell/chat-analyzed
   ```
3. Subscribe to the `chat_analyzed` event
4. Save the webhook configuration

**Important:** Ensure your chat agents include `tenant_id` in the metadata field when initiating chats. This is required for proper tenant association.

### 3. Verify Webhook Connectivity

Test the webhook endpoint:

```bash
curl -X POST https://yourdomain.com/api/retell/chat-analyzed \
  -H "Content-Type: application/json" \
  -d '{
    "event": "chat_analyzed",
    "chat": {
      "chat_id": "test_123",
      "agent_id": "agent_456",
      "metadata": {
        "tenant_id": "your-tenant-id"
      },
      "transcript": "User: Hello\nAgent: Hi there!",
      "start_timestamp": 1234567890,
      "end_timestamp": 1234567950,
      "duration": 60,
      "call_successful": true,
      "call_analysis": {
        "user_sentiment": "positive",
        "call_summary": "Test chat"
      },
      "cost_analysis": {
        "combined": 0.05,
        "product_costs": {}
      }
    }
  }'
```

Expected response: `200 OK` with `{ "success": true }`

### 4. Access Analytics Dashboard

1. Log in as a platform admin
2. Navigate to **Platform Admin** page
3. Click on **Analytics** tab
4. Select a tenant from the dropdown
5. View analytics across all 4 tabs

## Metrics Explained

### Success Rate
Percentage of chats marked as `chatSuccessful: true` by Retell AI's analysis.

**Calculation:** `(successful chats / total chats) × 100`

### Average Duration
Mean duration of all chat sessions in the selected time range.

**Calculation:** `sum(chatDuration) / total chats`

Displayed in format: `XXm YYs`

### Combined Cost
Total cost across all chats, including:
- LLM costs (Retell AI's language model usage)
- TTS costs (text-to-speech if applicable)
- STT costs (speech-to-text if applicable)
- Telephony costs (if applicable)

Displayed in format: `$X.XX`

### Sentiment Distribution
Breakdown of user sentiment as analyzed by Retell AI:
- **Positive**: User expressed satisfaction or positive feedback
- **Neutral**: User was neutral or matter-of-fact
- **Negative**: User expressed dissatisfaction or frustration
- **Unknown**: Sentiment could not be determined

## Troubleshooting

### Chat Analytics Not Showing

**Symptoms:**
- Analytics dashboard shows "No data available"
- Chat count is 0 despite having chat sessions

**Possible Causes & Solutions:**

1. **Webhook not configured**
   - Verify webhook URL in Retell AI dashboard
   - Check webhook is subscribed to `chat_analyzed` event
   - Ensure webhook URL is accessible (not localhost)

2. **Missing tenant_id in metadata**
   - Check your chat initiation code includes metadata
   - Verify `tenant_id` is set correctly
   - Example:
     ```javascript
     {
       "agent_id": "your-agent-id",
       "metadata": {
         "tenant_id": "your-tenant-id"
       }
     }
     ```

3. **Database connection issues**
   - Check server logs for database errors
   - Verify tables were created: `chat_analytics`, `chat_messages`
   - Run `npm run db:push` if tables missing

4. **Webhook signature verification failing** (future implementation)
   - Check Retell signing secret matches
   - Verify signature verification logic

### Data Not Updating in Real-Time

**Symptoms:**
- New chats not appearing immediately
- Data seems stale

**Solutions:**

1. **Auto-refresh disabled**
   - Check browser console for errors
   - Verify react-query is enabled
   - Dashboard should refresh every 60 seconds

2. **Manual refresh**
   - Change time range filter to force refetch
   - Switch tabs and come back
   - Reload the page

3. **Caching issues**
   - Clear browser cache
   - Hard reload (Cmd+Shift+R or Ctrl+Shift+R)

### Costs Not Tracked Correctly

**Symptoms:**
- Cost shows as $0.00
- Cost missing from some chats

**Possible Causes:**

1. **Retell AI not sending cost data**
   - Verify your Retell AI plan includes cost tracking
   - Check webhook payload contains `cost_analysis` field
   - Some chat types may not incur costs

2. **Cost parsing error**
   - Check server logs for parsing errors
   - Verify `cost_analysis.combined` format is numeric

### Sentiment Always Shows "Unknown"

**Symptoms:**
- All chats show "Unknown" sentiment
- Sentiment breakdown shows 100% unknown

**Possible Causes:**

1. **Sentiment analysis disabled**
   - Verify Retell AI agent has sentiment analysis enabled
   - Check agent configuration in Retell dashboard

2. **Data parsing issue**
   - Verify webhook payload includes `call_analysis.user_sentiment`
   - Check server logs for parsing errors

### Server Errors (500)

**Check server logs for detailed error messages:**

```bash
# If using PM2
pm2 logs

# If using terminal
# Check the terminal where server is running
```

Common errors:
- Database connection timeout → Check database credentials
- Missing required fields → Check webhook payload structure
- Type errors → Check data types match schema

### Empty State Despite Having Data

**Symptoms:**
- Analytics dashboard shows empty state
- But database has chat_analytics records

**Solutions:**

1. **Wrong tenant selected**
   - Verify correct tenant is selected in dropdown
   - Check `tenantId` field in database records

2. **Date range filter**
   - Change time range (try "Last 90 Days")
   - Chats might be outside selected range

3. **Agent filter**
   - Check if specific agent is selected
   - Try selecting "All Agents"

## Development Notes

### Adding New Metrics

To add new metrics to the dashboard:

1. **Update Database Schema** (`shared/schema.ts`)
   - Add new field to `chatAnalytics` table
   - Run migration: `npm run db:push`

2. **Update Storage Layer** (`server/storage.ts`)
   - Add field to `ChatAnalytics` interface
   - Update `createChatAnalytics` method to store new field
   - Update summary methods if needed for aggregation

3. **Update API Endpoints** (`server/routes.ts`)
   - Modify response to include new field
   - Add filtering if needed

4. **Update UI Component** (`client/src/components/AgentAnalyticsDashboard.tsx`)
   - Add new card or visualization
   - Update TypeScript interfaces
   - Add helper functions if needed

### Testing Webhooks Locally

Use ngrok to expose local server:

```bash
# Install ngrok
brew install ngrok

# Expose local port
ngrok http 5000

# Use the ngrok URL in Retell AI webhook configuration
# Example: https://abc123.ngrok.io/api/retell/chat-analyzed
```

### Sample Webhook Payload for Testing

```json
{
  "event": "chat_analyzed",
  "chat": {
    "chat_id": "chat_abc123xyz",
    "agent_id": "agent_456def",
    "metadata": {
      "tenant_id": "tenant_789ghi",
      "user_id": "user_123",
      "session_id": "session_456"
    },
    "transcript": "User: I need help with my account\nAgent: I'd be happy to help! Can you tell me more about the issue?\nUser: I can't log in\nAgent: Let me help you reset your password.",
    "transcript_with_tool_calls": "User: I need help with my account\nAgent: I'd be happy to help! Can you tell me more about the issue?\nUser: I can't log in\nAgent: [Tool Call: check_account_status(user_id='user_123')]\nAgent: Let me help you reset your password.\n[Tool Call: send_reset_email(user_id='user_123')]",
    "recording_url": "https://example.com/recordings/chat_abc123xyz.mp3",
    "public_log_url": "https://example.com/logs/chat_abc123xyz",
    "start_timestamp": 1704067200,
    "end_timestamp": 1704067320,
    "duration": 120,
    "disconnection_reason": "user_hangup",
    "call_successful": true,
    "call_analysis": {
      "user_sentiment": "positive",
      "call_summary": "User requested help with login issue. Agent assisted with password reset process. Issue resolved successfully."
    },
    "retell_llm_dynamic_variables": {
      "user_name": "John Doe",
      "account_type": "premium"
    },
    "opt_out_sensitive_data_storage": false,
    "cost_analysis": {
      "combined": 0.08,
      "product_costs": {
        "llm": 0.05,
        "tts": 0.02,
        "stt": 0.01
      }
    },
    "retell_llm_usage": {
      "total_tokens": 450,
      "prompt_tokens": 200,
      "completion_tokens": 250
    }
  }
}
```

## Security Considerations

### Webhook Signature Verification

**Current Status:** Placeholder implementation

**To Implement:**
1. Get signing secret from Retell AI dashboard
2. Store in environment variable: `RETELL_WEBHOOK_SECRET`
3. Implement HMAC signature verification in webhook handler
4. Reject requests with invalid signatures

**Implementation Reference:**
```typescript
import crypto from 'crypto';

function verifyRetellSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Data Privacy

- Chat transcripts may contain sensitive information
- Ensure compliance with data protection regulations (GDPR, CCPA, etc.)
- Consider implementing:
  - Transcript encryption at rest
  - Automatic data deletion after retention period
  - User consent mechanisms
  - Audit logging for analytics access

### Access Control

- Analytics endpoints require platform admin authentication
- Tenant data is isolated (users can only see their own tenant's data)
- Consider implementing:
  - Role-based access (e.g., tenant admins can view their own analytics)
  - IP whitelisting for webhook endpoint
  - Rate limiting on webhook endpoint

## Performance Optimization

### Database Indexes

Current indexes optimize:
- Tenant-based queries
- Date range filtering
- Agent filtering
- Sentiment filtering

**Add additional indexes if:**
- Queries are slow (>1 second)
- Filtering by new fields frequently
- Large dataset (>100k records)

### Caching Strategy

Consider implementing caching for:
- Summary statistics (cache for 5 minutes)
- Sentiment distribution (cache for 10 minutes)
- Daily cost breakdown (cache for 1 hour)

Use Redis or in-memory cache for production.

### Data Retention

Implement automatic cleanup:

```typescript
// Example: Delete chats older than 90 days
storage.deleteOldChatAnalytics(90);
```

Schedule via cron job:
```bash
# Add to crontab
0 2 * * * node scripts/cleanup-old-analytics.js
```

## Future Enhancements

### Planned Features
- [ ] Advanced filtering (multiple agents, date presets)
- [ ] Export to CSV/PDF
- [ ] Scheduled reports via email
- [ ] Real-time dashboard (WebSocket updates)
- [ ] Comparison views (this week vs last week)
- [ ] Agent performance benchmarking
- [ ] Custom alerts (e.g., sentiment drops below threshold)
- [ ] Integration with business intelligence tools

### API Enhancements
- [ ] GraphQL API for flexible queries
- [ ] Batch webhook processing
- [ ] Webhook retry mechanism
- [ ] Rate limiting
- [ ] API versioning

### UI Improvements
- [ ] Dark mode support
- [ ] Customizable dashboards
- [ ] Drill-down capabilities
- [ ] Chat transcript viewer
- [ ] Audio playback integration
- [ ] Mobile responsive design

## Support

For issues or questions:
1. Check this guide's troubleshooting section
2. Review server logs for errors
3. Check Retell AI documentation: https://docs.retellai.com
4. Contact development team

## Version History

- **v1.0.0** (Current)
  - Initial release
  - Basic analytics dashboard
  - Webhook integration
  - 4 dashboard tabs
  - Time range and agent filtering
  - Auto-refresh functionality
