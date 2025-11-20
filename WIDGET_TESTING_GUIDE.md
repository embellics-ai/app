# Widget Testing Guide

## ✅ Auto-Generation is Working!

The auto-generation feature is working correctly. When you assigned the Retell API key and Agent ID as platform admin, the system automatically created a widget API key for the client admin's tenant.

**Generated API Key Prefix:** `b2c9368e`
**Tenant:** SWC Animesh (9bce8dbf-6f32-496e-b88a-beacf4f4f787)

## ❌ Why the Test Page Didn't Work

The test page at `docs/widget-simple-test.html` has a **hardcoded old API key** from a previous setup:

```
embellics_915f494a4e853a5dc97a2f09de314572460c7b40dc6c9699d41c23d7575a6844
```

This key doesn't exist in the database anymore (it was deleted during cleanup). That's why you're seeing "Invalid API key" errors.

## ✅ How to Test the Widget Correctly

### Method 1: Get Embed Code from Dashboard (Recommended)

1. **Login as client admin:**
   - Email: william.animesh@gmail.com
   - Password: [your password]

2. **Navigate to Widget Config:**
   - Click on "Widget Config" in the sidebar
   - Scroll down to the "Embed Code" section

3. **Copy the embed code:**
   - The dashboard will show the correct embed code with the auto-generated API key
   - It should look like:

   ```html
   <script src="http://localhost:3000/widget.js" data-api-key="embellics_b2c9368e..."></script>
   ```

4. **Create a new test file:**
   - Create `my-widget-test.html`
   - Paste the embed code from the dashboard
   - Open in browser

### Method 2: Query the Database for the Full Key

If you need the full API key for testing, run:

```bash
npm run db:query -- "SELECT key_prefix, key_hash, name, created_at FROM api_keys WHERE tenant_id = '9bce8dbf-6f32-496e-b88a-beacf4f4f787'"
```

However, the embed code in the dashboard already includes the complete key - you don't need to manually reconstruct it.

## 🔍 How to Verify Widget is Working

Once you have the correct embed code:

1. Open the test HTML file in your browser
2. You should see the chat widget button in the bottom right
3. Click it to open the chat interface
4. Type a message and verify it gets a response from the Retell agent

## 📝 Summary

- ✅ Auto-generation feature: **WORKING**
- ✅ Widget API key created: **YES** (prefix: b2c9368e)
- ✅ Retell credentials saved: **YES** (Agent ID: agent_de94cbe24ccb0228908b12dac3)
- ❌ Old test page: **OUTDATED** (has wrong API key)
- ✅ Solution: **Use embed code from dashboard**

## 🎯 Next Steps

1. Login to the dashboard as client admin
2. Go to Widget Config page
3. Copy the embed code shown at the bottom
4. Test with that code instead of the old test page

The widget should work perfectly with the auto-generated API key!
