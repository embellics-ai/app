# Interactive Widget Options - Implementation Guide

## Overview

The widget now supports **interactive button options** that appear when the AI offers choices to the user. Instead of typing responses, users can click buttons for a seamless experience.

## How It Works

### 1. Frontend (Widget)

The widget automatically detects structured responses from the AI and renders them as clickable buttons.

**Structured Response Format:**

```json
{
  "message": "What would you like to do today?",
  "options": [
    { "label": "Book an appointment", "value": "booking" },
    { "label": "Reschedule existing", "value": "reschedule" },
    { "label": "Cancel appointment", "value": "cancel" }
  ]
}
```

**Alternative Simpler Format:**

```json
{
  "message": "Which time works best for you?",
  "options": ["11:00 AM", "12:00 PM", "2:00 PM", "4:00 PM"]
}
```

### 2. Backend Configuration

#### Option A: Configure Retell Agent Prompt

Update your Retell agent's system prompt to return JSON when presenting options:

```
When you need to present options to the user, respond with a JSON object in this format:
{
  "message": "Your question here",
  "options": ["Option 1", "Option 2", "Option 3"]
}

For example, when asking about appointment times:
{
  "message": "Which time slot would you prefer?",
  "options": ["10:00 AM", "11:00 AM", "2:00 PM", "3:00 PM"]
}

For booking type selection:
{
  "message": "How can I help you today?",
  "options": [
    {"label": "New Booking", "value": "new_booking"},
    {"label": "Reschedule", "value": "reschedule"},
    {"label": "Cancel", "value": "cancel"}
  ]
}
```

#### Option B: Use Retell's Function Calling

Configure a custom function in Retell that returns structured options:

1. Go to Retell Dashboard → Your Agent → Functions
2. Add a new function `present_options`:

```json
{
  "name": "present_options",
  "description": "Present multiple choice options to the user as clickable buttons",
  "parameters": {
    "type": "object",
    "properties": {
      "message": {
        "type": "string",
        "description": "The question or prompt to show the user"
      },
      "options": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "Array of option labels to display as buttons"
      }
    },
    "required": ["message", "options"]
  }
}
```

3. Update agent prompt to use this function when appropriate

### 3. Widget Features

**Visual Design:**

- Buttons appear below the AI message
- Purple outlined buttons that fill on hover
- Buttons slide slightly right on hover for visual feedback
- Once clicked, all buttons disable and selected one highlights
- Selected value is sent as user message automatically

**User Experience:**

- Click any button → Selection sent immediately
- No typing required for predefined options
- All buttons disable after selection to prevent duplicate submissions
- Works in both AI chat and human handoff modes

### 4. Testing

**Test the Feature:**

1. Start a conversation with the widget
2. Trigger a scenario where options should appear
3. Verify buttons render correctly
4. Click a button and confirm:
   - Button highlights
   - Other buttons disable
   - Selection appears as user message
   - AI responds appropriately

**Example Test Scenarios:**

- "I want to book an appointment" → Should show appointment type options
- "What times are available?" → Should show time slot buttons
- "Do you want to proceed?" → Should show Yes/No buttons

### 5. Example Retell Agent Configurations

**Appointment Booking Agent:**

```
You are an appointment booking assistant. When presenting options to users:

1. For appointment types:
{
  "message": "What type of appointment would you like to book?",
  "options": ["Consultation", "Follow-up", "Emergency", "Routine Check-up"]
}

2. For time slots:
{
  "message": "Which time works best for you?",
  "options": ["9:00 AM", "11:00 AM", "2:00 PM", "4:00 PM"]
}

3. For confirmation:
{
  "message": "Shall I confirm your appointment for March 15th at 2:00 PM?",
  "options": ["Yes, confirm", "No, change time", "Cancel"]
}
```

**Customer Support Agent:**

```
When helping customers, use buttons for common queries:

{
  "message": "How can I assist you today?",
  "options": [
    {"label": "Track my order", "value": "track_order"},
    {"label": "Return/Refund", "value": "return"},
    {"label": "Product question", "value": "product_help"},
    {"label": "Speak to human", "value": "human_handoff"}
  ]
}
```

## Benefits

✅ **Faster Interactions** - One click instead of typing
✅ **Reduced Errors** - No typos or misunderstandings
✅ **Better UX** - Clear, visible options
✅ **Mobile Friendly** - Easy to tap on mobile devices
✅ **Accessibility** - Structured choices are easier to navigate

## Deployment

1. Update widget.js (already done ✅)
2. Configure your Retell agent prompts to return JSON options
3. Test thoroughly before production
4. Deploy to production

The widget is backward compatible - if the AI sends plain text, it will display normally. JSON-structured responses with options will automatically render as buttons.
