# ⚠️ HOW TO COPY THE API KEY CORRECTLY

## The Problem

You've been copying the API key from the **WRONG place**!

## ❌ WRONG: Don't copy from the embed code

The embed code at the bottom of the API Keys page shows:

```
'embellics_4fd1dfd3...'
```

This is just a **PLACEHOLDER** showing the prefix. It's NOT the real full key!

## ✅ CORRECT: Copy from the green banner

When you click "Create API Key", a **GREEN BANNER** appears at the TOP of the page:

```
┌─────────────────────────────────────────────────────────┐
│ 🔑 New API Key Created                                   │
│                                                          │
│ Copy this key now. For security reasons, it won't be    │
│ shown again.                                             │
│                                                          │
│ embellics_4fd1dfd3daa54...  [👁️] [📋 Copy] [✖ Dismiss] │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

This has the **FULL 64-character hex string** after `embellics_`.

## Step-by-Step Instructions

1. **Go to API Keys page**
   - Login as client admin
   - Click "API Keys" in sidebar

2. **Delete any existing keys**
   - Click the trash icon on any existing keys
   - This ensures you start fresh

3. **Click "Create API Key"**
   - A dialog appears
   - Enter optional name (e.g., "Test Key")
   - Click "Generate Key"

4. **IMMEDIATELY copy from the green banner**
   - A green banner appears at the TOP
   - Click the eye icon (👁️) to show the full key
   - Click "Copy" button OR manually select and copy the ENTIRE key
   - The key should be: `embellics_` followed by 64 hex characters

5. **Use THAT key in your HTML**
   - Paste it into your test HTML file
   - Replace the `data-api-key` value with this full key

6. **Test immediately**
   - Open your HTML file in a browser
   - The widget should now work!

## How to Verify You Have the Right Key

The correct key format:

```
embellics_[64 hexadecimal characters]
```

Example (yours will be different):

```
embellics_YOUR_64_CHARACTER_HEX_STRING_HERE
```

Count the characters after `embellics_` - should be EXACTLY 64!

## Why This Happens

For security:

- The full key is shown ONLY when created
- After that, only the prefix (first 8 chars) is stored
- The database stores a hash of the full key
- If the key you use doesn't hash to match the database = Invalid API key error

## Current Situation

Your database has:

- Key prefix: `4fd1dfd3`
- Hash: `8364c2d56f6bedbd0e185c4846bf909aa0aeb41175bd129a8103c5a0aa8c41f1`

You need the full key that hashes to this value. Only way to get it:

1. It was shown in the green banner when you created it
2. If you didn't copy it then, you must delete and create a NEW key
3. Then copy it from the green banner IMMEDIATELY
