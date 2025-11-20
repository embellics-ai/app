# Widget "Invalid API Key" Error - Fixed

## Problem Summary

The widget was initializing successfully but showing "Invalid API key" error when sending messages.

## Root Cause

The test file (`docs/widget-simple-test.html`) had an **old API key** that no longer exists in the database:

```
OLD KEY: embellics_de81b5ae9282712cd1f55247f5cfa3a67e9431793d96aea5bda96d17ca729729
```

This key had the correct prefix (`embellics_de81b5ae`) but the full key value didn't match what was in the database anymore. This is because:

1. API keys are hashed and stored in the database for security
2. The full key is only shown ONCE when created
3. You can't retrieve the full key later - only the prefix is stored
4. The key in the test file was from a previous test/setup

## Solution Applied

**Created a fresh API key** for the SWC tenant using the script `regenerate-test-key-simple.ts`

**New API Key:**

```
embellics_01ba1bdd3ae1fedd2ebdc98c665f9d971ff21c65aa421618a4cb1d9bc84b0845
```

**Updated Files:**

- `docs/widget-simple-test.html` - Updated with new API key

## Testing

1. Server is running on http://localhost:3000
2. Open `docs/widget-simple-test.html` in your browser
3. Click the chat button
4. Send a message - it should now work!

## How API Key Authentication Works

```
Widget sends message with API key
     ↓
Server receives: "embellics_01ba1bdd3ae1fedd2ebdc98c665f9d971ff21c65aa421618a4cb1d9bc84b0845"
     ↓
Server gets all API keys from database
     ↓
For each key in database:
  - Hash the received key
  - Compare with stored hash
  - If match found → Authentication succeeds
     ↓
If NO match found → "Invalid API key" error
```

## Important Notes

1. **API keys are only shown ONCE** when created for security
2. **You cannot retrieve** the full key from the database later
3. **If you lose a key**, you must regenerate it
4. The prefix (like `embellics_01ba1bdd`) is stored for display purposes only
5. The actual key validation uses bcrypt hash comparison

## Scripts Available

### Check Current API Keys

```bash
npx tsx get-current-api-key.ts
```

Shows all API keys in database (with prefixes only)

### Regenerate Test API Key

```bash
npx tsx regenerate-test-key-simple.ts
```

Deletes old key and creates a new one with the full key displayed

## For Production Use

In production, users should:

1. Login to the dashboard
2. Go to their tenant's settings
3. Generate an API key
4. Copy it immediately when shown
5. Store it securely (password manager, env file, etc.)

The embed code in the dashboard shows the key prefix only for security, but the full key is provided when first generated.

## Next Steps

The widget should now work correctly with the new API key. Test by:

1. Opening the test page
2. Clicking the chat button
3. Sending a message
4. Verifying you get a response from the AI agent
