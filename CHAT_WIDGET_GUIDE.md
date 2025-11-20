# Chat Widget Implementation Guide

## Overview

The Embellics Chat Widget is a text-based chat interface powered by Retell AI agents. It allows external websites to embed an AI-powered chat assistant that responds to customer inquiries in real-time.

## Features

- ✅ **Text-based chat interface** with message bubbles
- ✅ **Real-time AI responses** via Retell AI Chat API
- ✅ **Persistent chat sessions** across messages
- ✅ **Customizable branding** (colors, greeting, placeholder text)
- ✅ **Mobile-responsive design**
- ✅ **Easy embed** with single script tag
- ✅ **Domain whitelisting** for security
- ✅ **Multi-tenant support** with API key authentication

## Architecture

### Frontend (widget.js)

- **Location**: `/client/public/widget.js`
- **Size**: ~250 lines of vanilla JavaScript
- **Features**:
  - Self-contained IIFE (Immediately Invoked Function Expression)
  - No external dependencies
  - Responsive CSS with mobile support
  - Message history with user/assistant/system message types
  - Error handling with user-friendly messages
  - Typing indicator during AI processing

### Backend Endpoints

#### 1. Widget Initialization

```
POST /api/widget/init
```

**Request:**

```json
{
  "apiKey": "embellics_...",
  "referrer": "example.com"
}
```

**Response:**

```json
{
  "tenantId": "uuid",
  "primaryColor": "#667eea",
  "greeting": "Chat Assistant",
  "placeholder": "Type your message..."
}
```

**Purpose**: Validates API key, checks domain whitelist, returns widget configuration

#### 2. Chat Message

```
POST /api/widget/chat
```

**Request:**

```json
{
  "apiKey": "embellics_...",
  "message": "User message text",
  "chatId": "chat_..." // optional, for continuing conversation
}
```

**Response:**

```json
{
  "response": "AI agent response",
  "chatId": "chat_..."
}
```

**Purpose**: Sends user message to Retell AI agent, returns AI response

#### 3. Widget Script

```
GET /widget.js
```

**Purpose**: Serves the widget JavaScript file

## Embedding the Widget

### Basic Usage

Add this script tag before the closing `</body>` tag of your HTML:

```html
<script src="https://your-domain.com/widget.js" data-api-key="embellics_YOUR_API_KEY_HERE"></script>
```

### Example

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My Website</title>
  </head>
  <body>
    <h1>Welcome to my website</h1>

    <!-- Your content here -->

    <!-- Embellics Chat Widget -->
    <script
      src="http://localhost:3000/widget.js"
      data-api-key="embellics_915f494a4e853a5dc97a2f09de314572460c7b40dc6c9699d41c23d7575a6844"
    ></script>
  </body>
</html>
```

## Configuration

Widget configuration is managed through the admin panel at `/widget-config`:

- **Primary Color**: Brand color for widget (button, header, user messages)
- **Greeting**: Widget title shown in header
- **Placeholder**: Input field placeholder text
- **Allowed Domains**: Comma-separated list of domains where widget can be embedded
- **Custom CSS**: Additional CSS for advanced customization
- **Retell API Key**: Your Retell AI API key (encrypted)
- **Retell Agent ID**: Your Retell AI agent identifier

## Retell AI Integration

The widget uses Retell AI's Chat API for text-based conversations:

1. **Session Creation**: First message creates a new chat session via `retellClient.chat.create()`
2. **Message Exchange**: Each message is sent via `retellClient.chat.createChatCompletion()`
3. **Session Continuity**: `chatId` is maintained client-side for conversation history
4. **Agent Configuration**: Agent behavior is configured in Retell AI dashboard

### Chat vs Voice

⚠️ **Important**: The widget uses Retell's Chat API, not Web Call API. Your Retell agent must be configured as a **chat agent**, not a voice agent. Attempting to use a voice-only agent will result in errors.

## API Key Management

### Generating API Keys

API keys are generated through the admin panel:

1. Navigate to `/api-keys`
2. Click "Generate New Key"
3. Copy the key immediately (it's only shown once)
4. Key format: `embellics_[64-character-hash]`

### Security

- API keys are hashed with SHA-256 before storage
- Only key prefix is stored in plaintext for identification
- Domain whitelisting prevents unauthorized embedding
- CORS is properly configured for cross-origin requests

## Testing

### Local Development

1. Start the development server:

```bash
npm run dev
```

2. Open test page:

```
http://localhost:3000/widget-simple-test.html
```

3. Test the chat widget:
   - Click the chat button (bottom-right corner)
   - Type a message and press Enter or click Send
   - Verify AI responses appear correctly

### Production Testing

1. Ensure your domain is whitelisted in widget configuration
2. Embed the widget script on your test page
3. Verify widget loads and initializes
4. Test full conversation flow

## Troubleshooting

### Widget Not Loading

- **Check API Key**: Ensure API key is correct and active
- **Check Domain**: Verify domain is whitelisted in widget config
- **Check Console**: Open browser DevTools and check for errors
- **Check Server**: Ensure backend is running and accessible

### Chat Not Working

- **"Invalid API key"**: API key is incorrect or deactivated
- **"Widget not configured"**: Retell credentials not set in admin panel
- **"Failed to send message"**: Network issue or server error
- **"Can not start a call with chat agent"**: Wrong API endpoint (using voice instead of chat)

### AI Not Responding

- **Check Retell Agent**: Verify agent is configured as chat agent in Retell dashboard
- **Check API Key**: Ensure Retell API key in widget config is correct
- **Check Logs**: Review server logs for Retell API errors

## Files Modified

### New/Updated Files

1. **client/public/widget.js** - Complete rewrite from voice to text chat
2. **server/routes.ts** - Added `/api/widget/chat` endpoint, removed voice endpoints
3. **docs/widget-simple-test.html** - Updated test page for chat widget

### Removed Files

1. **VOICE_WIDGET_UPDATE.md** - Outdated voice widget documentation
2. **POST /api/widget/retell-token** - Voice call endpoint (no longer needed)
3. **OPTIONS /api/widget/retell-token** - CORS preflight for voice endpoint

## Live Handoff to Human Agents

### Overview

The chat widget now supports seamless handoff from AI to human agents. Customers can request to speak with a human agent at any time, and agents can pick up conversations through the Agent Queue dashboard.

### Features

- ✅ **User-initiated handoff**: "Talk to a Human" button appears after 3 seconds
- ✅ **Seamless transition**: Widget stays open, just switches from AI to human responses
- ✅ **AI conversation history**: Agents see the full previous conversation
- ✅ **Real-time messaging**: Bidirectional communication between customer and agent
- ✅ **After-hours support**: Email collection when no agents are available
- ✅ **Status updates**: Real-time notifications for pickup and resolution

### Customer Experience

1. **Requesting Handoff**:
   - Customer clicks "Talk to a Human" button in widget
   - Widget shows "Requesting connection to a human agent..."
   - If agents available: "An agent will be with you shortly..."
   - If no agents: Email collection form appears

2. **During Active Chat**:
   - Widget switches to human agent mode
   - Customer sees "Agent Name has joined the chat"
   - Messages route to human agent instead of AI
   - Real-time message delivery (polling every 1 second)

3. **Chat Resolution**:
   - Agent closes the conversation
   - Widget shows "The agent has ended this conversation. Thank you!"
   - Handoff button becomes unavailable

### Agent Experience

#### 1. Agent Queue Dashboard (`/agent-queue`)

**Access**: Navigate to "Agent Queue" in sidebar (client_admin and support_staff roles)

**Features**:

- **Three tabs**:
  - **Pending**: Handoffs waiting to be picked up
  - **Active**: Your current conversations
  - **History**: Past resolved handoffs
- **Quick stats**: Waiting customers, active chats, available agents
- **Auto-refresh**: 2-10 seconds depending on tab

**Handoff Card Information**:

- Chat ID and status badge
- Time since request
- Last user message preview
- Number of AI messages in history
- Contact email (if provided for after-hours)
- Assigned agent (for active chats)

**Actions**:

- **Pick Up** button: Claim a pending handoff
- **Open Chat** button: Navigate to active conversation

#### 2. Agent Chat Interface (`/agent-chat/:handoffId`)

**Layout**:

- **Left side**: Conversation area with message history
- **Right side**: Chat details sidebar

**Conversation Area**:

- **AI History Section**: Previous AI conversation (dimmed, with Bot icon)
- **Separator**: "LIVE CHAT WITH AGENT" divider
- **Live Messages**: Real-time customer ↔ agent messages
- **Message Input**: Text area with Send button (Enter to send, Shift+Enter for new line)

**Details Sidebar**:

- Status badge
- Chat ID
- Customer email (if provided)
- Initial request message
- Last user message
- Timestamps (requested, picked up, resolved)
- AI conversation message count

**Actions**:

- **Send message**: Type and press Enter or click Send
- **Resolve Chat**: Red button to end conversation
- **Back to Queue**: Return to dashboard

### After-Hours Support

When no agents are available (all offline or busy):

1. Widget detects no available agents
2. Shows email collection form:

   ```
   No agents are currently available
   Please leave your email and a message,
   and we'll get back to you soon.

   [Email input]
   [Message textarea]
   [Submit Request button]
   ```

3. Request stored in database with status "pending"
4. Admin can review after-hours requests in Agent Queue history

### API Endpoints

#### Widget Public Endpoints (CORS-enabled)

```
POST   /api/widget/handoff                    - Request handoff
GET    /api/widget/handoff/:id/status         - Check handoff status
POST   /api/widget/handoff/:id/message        - Send user message
GET    /api/widget/handoff/:id/messages       - Get agent messages
```

#### Agent Protected Endpoints (Auth required)

```
GET    /api/widget-handoffs                   - All handoffs for tenant
GET    /api/widget-handoffs/pending           - Pending handoffs
GET    /api/widget-handoffs/active            - Active handoffs
GET    /api/widget-handoffs/:id               - Specific handoff
POST   /api/widget-handoffs/:id/pickup        - Pick up handoff
POST   /api/widget-handoffs/:id/resolve       - Resolve handoff
POST   /api/widget-handoffs/:id/send-message  - Agent sends message
GET    /api/widget-handoffs/:id/messages      - Get all messages
```

### Database Schema

**widget_handoffs table**:

- `id`: UUID primary key
- `chatId`: Retell chat session ID
- `tenantId`: Client identifier
- `status`: 'pending', 'active', 'resolved'
- `requestedAt`, `pickedUpAt`, `resolvedAt`: Timestamps
- `assignedAgentId`: Reference to human_agents
- `userEmail`, `userMessage`: After-hours contact info
- `conversationHistory`: AI conversation JSON
- `lastUserMessage`: Most recent message

**widget_handoff_messages table**:

- `id`: UUID primary key
- `handoffId`: Reference to widget_handoffs
- `senderType`: 'user', 'agent', 'system'
- `senderId`: Agent ID for agent messages
- `content`: Message text
- `timestamp`: Message time

### Setup Requirements

#### 1. Human Agents Configuration

Navigate to **Team Management** and configure human agents:

```
Name: Agent Name
Email: agent@example.com
Status: available (or offline/busy)
Max Chats: 5
```

**Important**: Agents must exist in `human_agents` table to appear in queue

#### 2. Agent Permissions

- **client_admin**: Full access to Agent Queue and Agent Chat
- **support_staff**: Full access to Agent Queue and Agent Chat
- **Platform admins**: No access (tenant-specific feature)

### WebSocket Events

Real-time updates use WebSocket for instant notifications:

**Events**:

- `new_handoff`: Alert agents to new pending handoff
- `handoff_picked_up`: Update queue when agent claims chat
- `handoff_message`: Real-time message delivery
- `handoff_resolved`: Notify of conversation closure
- `agent_message`: Send agent replies to widget

**Connection**: Automatic via `useWebSocket()` hook, authenticates with JWT token

### Performance Considerations

**Polling Intervals** (fallback when WebSocket not connected):

- Widget status check: 2 seconds (only when pending)
- Widget message poll: 1 second (only when active)
- Agent queue refresh: 2-10 seconds (based on tab)
- Agent chat messages: 1 second

**Optimization**: WebSocket provides instant updates without polling overhead

### Troubleshooting

**Handoff Button Not Appearing**:

- Wait 3 seconds after widget initialization
- Check browser console for errors
- Verify widget.js is latest version

**"No agents available" Always Showing**:

- Verify human_agents exist in database
- Check agent status is 'available'
- Ensure activeChats < maxChats
- Review `getAvailableHumanAgents()` query

**Agent Can't Pick Up Handoff**:

- Verify agent has correct role (client_admin or support_staff)
- Check agent record exists with matching email
- Ensure handoff status is 'pending'
- Review browser console and server logs

**Messages Not Delivering**:

- Check WebSocket connection status (console logs)
- Verify polling is working (network tab)
- Ensure handoff status is 'active'
- Check tenant isolation (correct tenantId)

**After-Hours Form Not Showing**:

- Verify all agents are offline or at maxChats
- Check `getAvailableHumanAgents()` returns empty
- Review handoff creation logic

## Next Steps

1. **Production Deployment**: Deploy handoff feature to production
2. **Agent Training**: Train support staff on Agent Queue and Chat interfaces
3. **Monitoring**: Set up alerts for after-hours requests
4. **Analytics**: Track handoff rates and resolution times
5. **Enhancements**:
   - AI-triggered handoffs (sentiment detection)
   - Typing indicators
   - File/image sharing
   - Canned responses
   - Agent performance metrics

## Support

For issues or questions:

- Check server logs for error messages
- Review Retell AI dashboard for agent configuration
- Verify API keys and domain whitelisting
- Test with widget-simple-test.html first before external embedding
- Review Agent Queue for handoff status
- Check human_agents table for agent configuration
