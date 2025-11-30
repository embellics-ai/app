# Multi-Tenant Widget Test Page - Enhanced Implementation

## Overview

Enhanced the platform admin widget test page to support **multi-tenant widget testing**. Platform admins can now select any tenant and test their widget configuration - essential for troubleshooting client widget issues.

## 🎯 Key Enhancement: Tenant Selection

### Problem Solved

- Platform admins need to test client widgets when they report issues
- Different tenants have different Retell agent configurations
- Need to verify widget behavior for specific clients

### Solution

- Added tenant selection dropdown on `/widget-test` page
- Dynamically loads selected tenant's widget configuration
- Opens widget test page in new window with tenant-specific settings
- Shows configuration status for each tenant

## Architecture

### Frontend: Tenant Selection Page (`/widget-test`)

**File**: `client/src/pages/widget-test.tsx` (205 lines)

**Features**:

1. **Tenant Dropdown**:
   - Fetches all tenants from `/api/platform/tenants`
   - Displays tenant name with building icon
   - Shows "(No widget configured)" for tenants without Retell agent
2. **Selected Tenant Info Card**:
   - Tenant name
   - Widget configuration status (✓ Configured / ⚠ Not Configured)
   - Agent ID (if configured)

3. **Test Button**:
   - Opens widget test page in new window
   - Passes `tenantId` as query parameter
   - Disabled until tenant is selected

4. **Instructions**:
   - Clear step-by-step testing guide
   - Browser console monitoring tips
   - Multi-tenant testing capabilities

**Code Structure**:

```tsx
interface Tenant {
  id: string;
  name: string;
  retellApiKey: string | null;
  retellAgentId: string | null;
}

const [tenants, setTenants] = useState<Tenant[]>([]);
const [selectedTenantId, setSelectedTenantId] = useState<string>('');

// Fetch tenants on mount
useEffect(() => {
  fetchTenants(); // GET /api/platform/tenants
}, [user]);

// Open test page with tenant ID
const handleTestWidget = () => {
  window.open(`/api/platform/widget-test-page?tenantId=${selectedTenantId}`, '_blank');
};
```

### Backend: Dynamic Widget Loading

**File**: `server/routes.ts` (lines 1323-1456)

**Endpoint**: `GET /api/platform/widget-test-page?tenantId=<id>`

**Enhanced Flow**:

1. ✅ **Validate tenant ID** (query parameter required)
2. ✅ **Fetch tenant** from database
3. ✅ **Get widget config** for tenant
4. ✅ **Check agent configuration**:
   - If no widget config → Return "Widget Not Configured" HTML
   - If widget configured → Inject tenant-specific scripts
5. ✅ **Read HTML template** from `client/public/widget-test.html`
6. ✅ **Inject tenant data**:
   - Tenant ID, name, agent ID
   - Retell Web Client script
   - Widget initialization script
   - Call registration logic
7. ✅ **Audit logging**: Log which admin tested which tenant's widget
8. ✅ **Return modified HTML** with tenant-specific widget

**Injected Scripts**:

```javascript
// 1. Tenant configuration (global variable)
window.WIDGET_TEST_CONFIG = {
  tenantId: 'tenant-123',
  tenantName: 'Acme Corp',
  agentId: 'agent_abc123xyz',
};

// 2. Update DOM with tenant info
document.getElementById('tenant-name').textContent = 'Acme Corp';
document.getElementById('agent-id').textContent = 'agent_abc123xyz';

// 3. Load Retell Web Client
<script src="https://unpkg.com/@retell-ai/web-client@latest/dist/index.umd.js"></script>;

// 4. Initialize widget
const retellClient = new window.RetellWebClient();

// 5. Register call with backend
fetch('/api/widget/register-call', {
  method: 'POST',
  body: JSON.stringify({ agentId: 'agent_abc123xyz' }),
}).then((data) => {
  retellClient.startCall({
    callId: data.callId,
    accessToken: data.accessToken,
    sampleRate: data.sampleRate,
  });
});
```

**Error Handling**:

- ❌ No tenant ID → 400 "Tenant ID is required"
- ❌ Tenant not found → 404 "Tenant not found"
- ❌ Widget not configured → 400 with friendly HTML message
- ❌ HTML file missing → 404 "Widget test page not found"

### HTML Template Updates

**File**: `client/public/widget-test.html`

**Changes**:

1. **Replaced static cards** with dynamic tenant info:

   ```html
   <div class="widget-card">
     <h4>Tenant</h4>
     <p id="tenant-name">Loading...</p>
   </div>
   <div class="widget-card">
     <h4>Agent ID</h4>
     <p id="agent-id" style="word-break: break-all;">Loading...</p>
   </div>
   ```

2. **Removed static widget check** (backend now injects initialization)

3. **Added tenant logging**:
   ```javascript
   if (window.WIDGET_TEST_CONFIG) {
     console.log('[Widget Test] Testing widget for tenant:', window.WIDGET_TEST_CONFIG.tenantName);
   }
   ```

## User Flow

### 1. Platform Admin Accesses Widget Test

```
User clicks "Widget Test" in sidebar
  ↓
Loads /widget-test page
  ↓
Fetches all tenants from API
  ↓
Displays tenant dropdown
```

### 2. Admin Selects Tenant

```
Admin selects "Acme Corp" from dropdown
  ↓
Shows tenant info card:
  - Name: Acme Corp
  - Status: ✓ Configured
  - Agent ID: agent_abc123xyz
  ↓
"Open Widget Test Page" button enabled
```

### 3. Admin Opens Test Page

```
Admin clicks "Open Widget Test Page"
  ↓
Opens new window: /api/platform/widget-test-page?tenantId=tenant-123
  ↓
Backend flow:
  1. Validates platform admin auth
  2. Fetches tenant "Acme Corp"
  3. Gets widget config (agent_abc123xyz)
  4. Reads HTML template
  5. Injects tenant-specific scripts
  6. Logs: "admin@embellics.com tested Acme Corp widget"
  7. Returns HTML
  ↓
Widget loads in new window with Acme Corp's configuration
  ↓
Admin can test widget (chat, handoff, etc.)
```

### 4. Admin Tests Multiple Tenants

```
Admin can repeat for different tenants:
  - Select "Beta Industries" → Open test page (new window)
  - Select "Gamma Solutions" → Open test page (new window)
  - Test all clients' widgets simultaneously in separate windows
```

## Security Features

### ✅ All Previous Security Measures Maintained

1. Menu item only visible to platform admins
2. Frontend page blocks non-admins
3. Backend double-checks with `requireAuth + requirePlatformAdmin`

### ✅ New Security Enhancements

1. **Tenant validation**: Ensures tenant exists before loading widget
2. **Widget config check**: Prevents testing unconfigured widgets
3. **Audit logging**: Tracks which admin tested which tenant
4. **Query parameter validation**: Requires tenantId parameter

## Benefits

### 🎯 For Platform Admins

- **Troubleshooting**: Test any client's widget when they report issues
- **Verification**: Verify widget configuration after setup
- **Multi-client testing**: Test multiple tenants simultaneously
- **No client credentials needed**: Use admin access to test any widget

### 🎯 For Support

- Faster issue resolution
- Can reproduce client issues exactly as they appear
- Verify fixes by testing actual client configuration
- Document testing in audit logs

### 🎯 For Clients

- Better support experience (admins can see what they see)
- Faster bug fixes (admins can reproduce issues)
- Confidence that platform admins can test their setup

## Testing Checklist

### ✅ Access Control

- [x] Platform admin can access /widget-test
- [x] Non-admin sees "Access Denied" on /widget-test
- [x] Backend blocks non-admin API calls

### ✅ Tenant Selection

- [x] Dropdown loads all tenants
- [x] Shows configuration status per tenant
- [x] Button disabled until tenant selected
- [x] Selected tenant info displays correctly

### ✅ Widget Loading

- [x] Opens in new window with tenantId
- [x] Backend validates tenant exists
- [x] Backend checks widget configuration
- [x] Shows "Not Configured" for tenants without widget
- [x] Injects correct agent ID for tenant
- [x] Widget initializes with tenant's Retell agent

### ✅ Multi-Tenant Testing

- [x] Can test multiple tenants in separate windows
- [x] Each window loads correct tenant's widget
- [x] No cross-tenant contamination

### ✅ Error Handling

- [x] Missing tenant ID → 400 error
- [x] Invalid tenant ID → 404 error
- [x] Unconfigured widget → Friendly error page
- [x] Network errors handled gracefully

### ✅ Audit Logging

- [x] Logs admin email + tenant name + timestamp
- [x] Format: "[Widget Test] admin@embellics.com tested Acme Corp widget"

## Files Modified

### 1. Frontend

- **client/src/pages/widget-test.tsx** (205 lines):
  - Changed from redirect to tenant selection UI
  - Added tenant fetching logic
  - Added Select dropdown component
  - Added tenant info card
  - Added test button with window.open

### 2. Backend

- **server/routes.ts** (lines 1323-1456):
  - Added tenantId query parameter validation
  - Added tenant fetching logic
  - Added widget config check
  - Added dynamic script injection
  - Enhanced audit logging with tenant name

### 3. HTML Template

- **client/public/widget-test.html**:
  - Changed "Environment" card to "Tenant" card
  - Changed "Widget Version" card to "Agent ID" card
  - Removed static widget check script
  - Added tenant info logging

## API Endpoints Used

### Frontend Calls

1. `GET /api/platform/tenants` - Fetch all tenants
2. `window.open('/api/platform/widget-test-page?tenantId=X')` - Open test page

### Backend Provides

1. `GET /api/platform/widget-test-page?tenantId=<id>` - Serve tenant-specific widget test HTML
2. Widget initialization uses: `POST /api/widget/register-call` - Register Retell call

## Future Enhancements (Optional)

### 🔮 Phase 2 Ideas

1. **Widget Preview**: Show screenshot of widget before opening
2. **Test Scenarios**: Pre-configured test scenarios (greeting, handoff, etc.)
3. **Real-time Logs**: Show widget logs in admin panel
4. **Test History**: Track which admins tested which tenants when
5. **Widget Comparison**: Compare widget behavior across tenants
6. **Mobile Preview**: Toggle mobile/desktop view for testing
7. **Theme Testing**: Test all theme configurations
8. **Position Testing**: Test all position configurations

## Conclusion

The enhanced widget test page now supports **multi-tenant testing**, allowing platform admins to troubleshoot any client's widget configuration. The tenant selection UI provides clear visibility into which tenants have widgets configured, and the dynamic widget loading ensures each test uses the correct tenant-specific settings.

**Key Achievement**: Platform admins can now effectively support clients by testing their exact widget configuration without needing client credentials or manual configuration changes. 🎯✨
