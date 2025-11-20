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

## Next Steps

1. **Production Deployment**: Update production environment with new chat widget
2. **Documentation**: Update customer-facing docs with chat widget instructions
3. **Monitoring**: Set up logging/monitoring for chat widget usage
4. **Analytics**: Track widget engagement and conversation metrics
5. **Customization**: Add more customization options (avatar, welcome message, etc.)

## Support

For issues or questions:

- Check server logs for error messages
- Review Retell AI dashboard for agent configuration
- Verify API keys and domain whitelisting
- Test with widget-simple-test.html first before external embedding
