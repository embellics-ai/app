# Design Guidelines: Retell AI Chat Interface

## Design Approach

**Selected Approach**: Design System with Modern Chat Interface References

Drawing inspiration from ChatGPT's clean simplicity, Linear's developer-focused precision, and Slack's message organization patterns. This is a utility-focused tool requiring clear information hierarchy and efficient workflows.

**Core Principles**:
- Clarity over decoration - messages must be instantly readable
- Efficient configuration - developer-friendly setup flows
- Professional minimalism - clean, trustworthy interface

---

## Typography

**Font Family**: 
- Primary: 'Inter' (Google Fonts) - for UI elements, buttons, labels
- Monospace: 'JetBrains Mono' (Google Fonts) - for API keys, code snippets

**Hierarchy**:
- Page Titles: text-2xl, font-semibold
- Section Headers: text-lg, font-medium
- Chat Messages: text-base, font-normal
- Timestamps/Metadata: text-xs, font-normal
- Buttons/CTAs: text-sm, font-medium
- Input Labels: text-sm, font-medium

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 3, 4, 6, 8, 12, 16**

**Application Layout**:
- Two-column split: Sidebar (w-80) + Main Chat Area (flex-1)
- Sidebar: Configuration panel, conversation flow settings, API management
- Main: Full-height chat interface with header, message area, input

**Container Structure**:
- Full viewport height: h-screen with flex column
- Message container: flex-1 with overflow-y-auto
- Input area: Fixed at bottom, sticky positioning

---

## Component Library

### Chat Interface Components

**Message Bubbles**:
- User messages: Aligned right, max-w-2xl, rounded-2xl rounded-tr-sm
- Agent messages: Aligned left, max-w-2xl, rounded-2xl rounded-tl-sm
- Padding: px-4 py-3 for message content
- Gap between messages: space-y-4

**Message Metadata**:
- Timestamp below each message: text-xs, opacity-60
- Sender label for agent messages: text-xs, font-medium, mb-1

**Typing Indicator**:
- Three animated dots, inline-flex, gap-1
- Each dot: w-2 h-2, rounded-full
- Subtle bounce animation (stagger delays)

**Chat Input Area**:
- Sticky bottom bar: border-t, px-6, py-4
- Textarea: rounded-xl, border, px-4, py-3, resize-none
- Max height with auto-grow: max-h-32
- Send button: Positioned absolute right-2, rounded-lg, p-2

### Sidebar Components

**Configuration Panel**:
- Collapsible sections with chevron icons
- Section headers: px-4, py-3, font-medium, border-b
- Content padding: p-4

**API Key Input**:
- Masked input (password type) with reveal toggle
- Monospace font for displayed key
- Copy button with success feedback
- Save button: Primary style, full width, mt-3

**Node Flow Visualizer** (if implementing):
- Vertical stack of node cards
- Each node: border, rounded-lg, p-3, space-y-2
- Connection lines between nodes: border-l-2, ml-4

**Action Buttons**:
- Primary: px-4, py-2, rounded-lg, font-medium
- Secondary: px-4, py-2, rounded-lg, border, font-medium
- Icon buttons: p-2, rounded-lg

### Status & Feedback

**Connection Status Indicator**:
- Pill shape in header: px-3, py-1, rounded-full, text-xs
- Position: Top-right of chat header
- States: Connected, Disconnecting, Error

**Toast Notifications**:
- Fixed bottom-right: bottom-4, right-4
- Width: w-80, rounded-lg, p-4
- Shadow: shadow-lg
- Auto-dismiss with progress bar

---

## Layout Specifications

### Desktop (lg and up)
- Sidebar: Fixed w-80, h-screen, border-r
- Main chat: flex-1, flex flex-col
- Message container: px-6, max-w-4xl, mx-auto
- Chat input: max-w-4xl, mx-auto, w-full

### Tablet (md)
- Collapsible sidebar (overlay on mobile, persistent on tablet)
- Hamburger menu button in header when sidebar hidden
- Reduce padding: px-4 instead of px-6

### Mobile (base)
- Full-width single column
- Sidebar as slide-over drawer
- Chat input: px-3, py-3
- Message bubbles: Smaller padding px-3 py-2

---

## Icons

**Library**: Heroicons (via CDN)
- Navigation: bars-3, x-mark, chevron-down, chevron-right
- Actions: paper-airplane, clipboard-document, eye, eye-slash
- Status: check-circle, exclamation-triangle, signal
- Configuration: cog-6-tooth, plus-circle, trash

---

## Animations

**Use Sparingly**:
- Typing indicator: Subtle bounce (0.5s ease-in-out)
- Message appearance: Slide up fade-in (200ms)
- Sidebar toggle: Slide transition (300ms)
- Toast notifications: Slide in from right (250ms)

**No animations for**:
- Text input
- Scrolling
- Button hover states (rely on browser defaults)

---

## Accessibility

- Chat messages in semantic `<article>` tags with ARIA labels
- Timestamp in `<time>` elements with datetime attribute
- Input textarea with proper label association
- Focus visible states: ring-2, ring-offset-2
- Keyboard navigation: Tab through all interactive elements
- Screen reader announcements for new messages (aria-live="polite")

---

## Images

**No hero images** - This is a functional chat interface, not a marketing page. The interface is the product.

**Avatar placeholders**: 
- User avatar: Circular, w-8 h-8, top-right of sidebar
- Agent avatar: Circular, w-6 h-6, next to agent messages
- Use initials or generic icon (Heroicons user-circle)