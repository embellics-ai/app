# Widget Actions Menu - UI Cleanup

## Overview

Redesigned the widget UI to reduce clutter by replacing stacked action buttons with a clean dropdown menu system.

## Problem

The previous design had three buttons stacked in the input area:

- Send button (circular, always visible)
- "Talk to a Human" button (green, full width)
- "End Chat" button (red, full width)

This created a cluttered, unprofessional appearance, especially on mobile devices.

## Solution

Implemented a **3-dot actions menu** button that opens a dropdown with contextual actions:

- Clean input area with only: **Input field + Send button + Actions menu button**
- Dropdown menu shows available actions based on chat state
- Professional look similar to WhatsApp, Messenger, and modern chat apps

## UI Components

### Actions Menu Button

- **Location**: Right side of input area, next to Send button
- **Appearance**: Circular button with 3 vertical dots
- **Background**: Light gray (#f3f4f6)
- **Visibility**: Hidden by default, shown after first message
- **States**:
  - Default: Gray background
  - Hover: Darker gray (#e5e7eb)
  - Active (menu open): Darker gray with `.active` class

### Dropdown Menu

- **Position**: Absolute, above the input area (bottom: 70px, right: 16px)
- **Appearance**:
  - White background
  - Rounded corners (12px)
  - Subtle shadow (0 10px 40px rgba(0,0,0,0.15))
  - Minimum width: 200px
- **Animation**: Smooth slide-up and fade-in (0.2s ease-out)
- **Visibility**: Hidden by default, shown when actions button is clicked

### Menu Items

#### "Talk to a Human"

- **Icon**: People/users icon (18x18px)
- **Text**: "Talk to a Human"
- **Color**: Default text color (#374151)
- **States**:
  - Enabled: When chat session exists and no active handoff
  - Disabled: Before chat starts, during pending/active handoff
  - Hidden: Never (always visible in menu)

#### "End Chat"

- **Icon**: X/close icon (18x18px)
- **Text**: "End Chat"
- **Color**: Red danger color (#dc2626)
- **States**:
  - Enabled: When chat session is active
  - Disabled: While end chat is processing
  - Hidden: Before chat starts (using `.hidden` class)
- **Hover**: Light red background (#fef2f2)

## Behavior

### Menu Visibility

1. **Actions Button Shows When**:
   - User sends first message
   - Session is restored from localStorage

2. **Menu Opens When**:
   - User clicks actions button
   - Shows available actions based on current state

3. **Menu Closes When**:
   - User clicks an action (handoff or end chat)
   - User clicks outside menu
   - User clicks actions button again (toggle)

### State Management

#### Initial State (No Chat)

```
Actions Button: Hidden
Menu: N/A
```

#### After First Message

```
Actions Button: Visible
Menu Items:
  - Talk to a Human: Enabled
  - End Chat: Visible & Enabled
```

#### During Handoff (Pending/Active)

```
Actions Button: Visible
Menu Items:
  - Talk to a Human: Disabled
  - End Chat: Visible & Enabled
```

#### After Chat Ends

```
Actions Button: Hidden
Menu: N/A
```

## CSS Classes

### Button Classes

- `#embellics-widget-actions-btn`: Main actions menu button
- `.show`: Makes button visible
- `.active`: Active state when menu is open

### Menu Classes

- `#embellics-widget-actions-menu`: Dropdown container
- `.show`: Makes menu visible
- `.embellics-menu-item`: Individual menu items
- `.danger`: Red styling for destructive actions (End Chat)
- `.hidden`: Hides menu item completely

## Code Structure

### HTML

```html
<button id="embellics-widget-actions-btn" aria-label="Actions menu">
  <svg><!-- 3 vertical dots --></svg>
</button>

<div id="embellics-widget-actions-menu">
  <button class="embellics-menu-item" id="embellics-menu-handoff">
    <svg><!-- Users icon --></svg>
    <span>Talk to a Human</span>
  </button>
  <button class="embellics-menu-item danger hidden" id="embellics-menu-end-chat">
    <svg><!-- X icon --></svg>
    <span>End Chat</span>
  </button>
</div>
```

### JavaScript Functions

```javascript
// Menu control
showActionsMenu()      // Opens dropdown
hideActionsMenu()      // Closes dropdown
toggleActionsMenu()    // Toggles open/close

// State management
- Show button: actionsBtn.classList.add('show')
- Hide button: actionsBtn.classList.remove('show')
- Enable item: menuItem.disabled = false
- Disable item: menuItem.disabled = true
- Show item: menuItem.classList.remove('hidden')
- Hide item: menuItem.classList.add('hidden')
```

## User Flow

### Opening Menu

1. User clicks actions button (3 dots)
2. Menu slides up with fade-in animation
3. Available actions are shown based on chat state

### Selecting Action

1. User clicks menu item (e.g., "End Chat")
2. Menu closes immediately
3. Action executes (shows modal or starts handoff)

### Closing Menu

1. User clicks outside menu
2. Menu fades out
3. Actions button returns to default state

## Mobile Responsiveness

- Menu width: Min 200px, adapts to content
- Touch-friendly item height: 48px (14px padding × 2 + content)
- Large tap targets for easy interaction
- No horizontal scroll issues

## Benefits

### User Experience

✅ **Cleaner Interface**: Less visual noise in input area  
✅ **More Space**: Input field is more prominent  
✅ **Professional Look**: Matches modern chat app conventions  
✅ **Contextual**: Only shows available actions  
✅ **Discoverable**: 3-dot icon is universally recognized

### Technical

✅ **Scalable**: Easy to add more actions in future  
✅ **Maintainable**: Centralized menu system  
✅ **Consistent**: Same state management pattern throughout  
✅ **Accessible**: Proper ARIA labels and keyboard support

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS animations supported
- Position: absolute works in all target browsers
- SVG icons render correctly

## Future Enhancements

- Keyboard navigation (arrow keys)
- Keyboard shortcuts (e.g., Cmd+/ to open menu)
- Additional actions (download transcript, mute notifications)
- Action dividers for grouping
- Icons with different colors per action category
