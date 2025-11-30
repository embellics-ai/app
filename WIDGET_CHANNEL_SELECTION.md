# Widget Channel Selection Feature

## Overview

The chat widget now provides mobile users with the option to choose between continuing the conversation on the web widget or seamlessly redirecting to WhatsApp. This feature enhances user experience by allowing them to select their preferred communication channel.

## Implementation Date

November 30, 2025

## Features

### 1. Mobile Detection

- **Function**: `isMobileDevice()`
- **Logic**: Detects mobile devices using `window.innerWidth <= 768`
- **Purpose**: Determines whether to show the channel selection modal

### 2. Channel Selection Modal

- **Display Condition**:
  - Mobile device detected
  - WhatsApp integration is available for the tenant
  - No existing chat session (first-time users)
- **UI Components**:
  - Modal overlay with backdrop blur effect
  - Two prominent buttons:
    - **WhatsApp Button**: Green (#25D366) with WhatsApp logo
    - **Web Chat Button**: Purple (matching widget theme)
- **Design**:
  - Responsive card design with shadow
  - Smooth animations (fadeIn, slideUp)
  - Mobile-optimized spacing and typography

### 3. WhatsApp Redirect

- **Function**: `redirectToWhatsApp()`
- **URL Format**: `https://wa.me/{phoneNumber}?text={greeting}`
- **Process**:
  1. Extracts phone number from widget config
  2. Removes whitespace from phone number
  3. URL-encodes the greeting message
  4. Opens WhatsApp in a new tab
  5. Closes the widget and modal

### 4. Backend Integration

- **Endpoint**: `/api/widget/init` (POST)
- **Enhanced Response**:
  ```json
  {
    "apiKey": "...",
    "greeting": "...",
    "whatsappAvailable": true,
    "whatsappPhoneNumber": "+1 234 567 8900",
    ...
  }
  ```

## User Flow

### Mobile User (WhatsApp Available)

1. User clicks chat widget button
2. Widget opens and displays channel selection modal
3. User sees two options:
   - **Continue on WhatsApp**: Redirects to WhatsApp app/web
   - **Continue Here**: Starts web chat conversation

### Mobile User (WhatsApp Not Available)

1. User clicks chat widget button
2. Widget opens directly to chat interface (no modal)
3. Web chat starts normally

### Desktop User

1. User clicks chat widget button
2. Widget opens directly to chat interface (no modal)
3. Web chat starts normally

### Returning User (Existing Session)

1. User clicks chat widget button
2. Widget opens directly to chat interface (no modal)
3. Previous conversation continues

## Technical Details

### CSS Classes Added

```css
.embellics-channel-modal
.embellics-channel-modal.show
.embellics-channel-content
.embellics-channel-title
.embellics-channel-subtitle
.embellics-channel-buttons
.embellics-channel-btn
.embellics-channel-btn-whatsapp
.embellics-channel-btn-web
.embellics-channel-icon
```

### JavaScript Functions Added

```javascript
isMobileDevice(); // Detects mobile devices
showChannelSelectionModal(); // Shows the modal
hideChannelSelectionModal(); // Hides the modal
redirectToWhatsApp(); // Handles WhatsApp redirect
```

### Modified Functions

```javascript
toggleWidget(); // Now checks for mobile + WhatsApp availability
```

### Event Listeners Added

```javascript
channelWhatsAppButton.click -> redirectToWhatsApp()
channelWebButton.click -> hideChannelSelectionModal() + focus input
```

## Configuration

### WhatsApp Setup

For the channel selection to appear, the tenant must have:

1. WhatsApp integration configured in `tenant_integrations` table
2. Valid `whatsappConfig.phoneNumber` stored
3. Integration active

### Widget Initialization

The widget config now includes:

```javascript
widgetConfig = {
  apiKey: "...",
  greeting: "...",
  whatsappAvailable: boolean,
  whatsappPhoneNumber: string,
  ...
}
```

## Styling

### Mobile Breakpoint

```css
@media (max-width: 768px) {
  /* Mobile-specific styles */
}
```

### Colors

- **WhatsApp Button**: `#25D366` (WhatsApp brand green)
- **Web Button**: `hsl(262, 75%, 65%)` (Purple, matching widget)
- **Modal Background**: `rgba(0, 0, 0, 0.7)` with backdrop blur

### Animations

```css
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

## Testing Scenarios

### Test 1: Mobile + WhatsApp Available

- ✅ Open widget on mobile device
- ✅ Channel selection modal appears
- ✅ Click WhatsApp button → redirects to WhatsApp
- ✅ Click Web button → starts web chat

### Test 2: Mobile + No WhatsApp

- ✅ Open widget on mobile device
- ✅ No modal appears
- ✅ Web chat starts directly

### Test 3: Desktop + WhatsApp Available

- ✅ Open widget on desktop
- ✅ No modal appears (desktop users don't see modal)
- ✅ Web chat starts directly

### Test 4: Returning User

- ✅ Open widget with existing `chatId`
- ✅ No modal appears
- ✅ Previous conversation continues

## Files Modified

1. **Backend**:
   - `/server/routes.ts` - Added WhatsApp availability check to widget init endpoint

2. **Frontend (Widget)**:
   - `/client/public/widget.js` - Added channel selection modal, mobile detection, and WhatsApp redirect

## Benefits

### For Users

- **Choice**: Select preferred communication channel
- **Seamless**: Smooth redirect to WhatsApp without manual steps
- **Familiar**: Use their preferred messaging app

### For Business

- **Flexibility**: Support multiple communication channels
- **Engagement**: Meet users on their preferred platform
- **Conversion**: Reduce friction in starting conversations

## Future Enhancements

- Add channel preference persistence (remember user's choice)
- Support other messaging platforms (Telegram, Facebook Messenger)
- A/B testing for channel selection effectiveness
- Analytics tracking for channel selection rates
