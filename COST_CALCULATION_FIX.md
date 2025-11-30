# Cost Calculation Fix

## Issues Found

### Issue 1: Wrong API Fields

Cost data was not being captured correctly from Retell AI webhooks, resulting in $0.00 being displayed for all chat and voice sessions in the analytics dashboard.

### Issue 2: Wrong Display Format

Cost values were being divided by 100 in the `AgentAnalyticsDashboard` component, treating dollars as cents. For example, a $0.12 cost was being displayed as $0.0012.

## Root Causes

### 1. Webhook Handler - Incorrect Field Paths

The webhook handlers were reading cost data from incorrect field paths:

**Incorrect (old code):**

```typescript
// Chat webhook
combinedCost: chat.chat_cost?.combined_cost || chat.combined_cost || 0,
productCosts: chat.chat_cost?.product_costs || chat.product_costs || null,

// Call webhook
combinedCost: call.call_cost?.combined_cost || call.combined_cost || 0,
productCosts: call.call_cost?.product_costs || call.product_costs || null,
```

**Correct (Retell API structure):**

```json
{
  "cost_analysis": {
    "combined": 0.12,
    "product_costs": {
      "llm": 0.08,
      "tts": 0.03,
      "stt": 0.01
    }
  }
}
```

### 2. Frontend Display - Incorrect Currency Formatting

**Incorrect (old code):**

```typescript
const formatCost = (cents: number) => {
  return `$${(cents / 100).toFixed(2)}`;
};
```

This treated the value as cents and divided by 100, but Retell sends values in dollars.

**Correct:**

```typescript
const formatCost = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};
```

## Solutions Applied

### 1. Backend - Updated Webhook Handlers

**Chat webhook (`/api/retell/chat-analyzed`):**

```typescript
combinedCost: chat.cost_analysis?.combined || 0,
productCosts: chat.cost_analysis?.product_costs || null,
```

**Voice webhook (`/api/retell/call-ended`):**

```typescript
combinedCost: call.cost_analysis?.combined || 0,
productCosts: call.cost_analysis?.product_costs || null,
```

### 2. Frontend - Fixed Currency Formatting

Updated `formatCost` function in `AgentAnalyticsDashboard.tsx` to use proper `Intl.NumberFormat` without dividing by 100, matching the implementation in `unified-analytics.tsx`.

## Files Modified

### Backend

- `server/routes.ts`
  - Line ~1957: Fixed chat webhook cost parsing
  - Line ~2108: Fixed call webhook cost parsing

### Frontend

- `client/src/components/AgentAnalyticsDashboard.tsx`
  - Line ~219: Fixed `formatCost` function to not divide by 100

## Testing

To verify the fix is working:

1. **Existing data**: Already stored sessions will show $0.00 (historical data cannot be retroactively fixed)
2. **New sessions**: After this fix, new chat/voice sessions should display correct costs
3. **Test webhook**: Use the test script to send a sample webhook:
   ```bash
   ./scripts/test-chat-analytics.sh
   ```
4. **Check dashboard**: Navigate to Platform Admin → [Tenant] → Analytics → Cost Tracking tab

## Expected Results

- Chat sessions should now display actual costs (e.g., $0.060, $0.120, etc.)
- Product cost breakdowns should be visible (LLM, TTS, STT costs)
- Total cost and average cost metrics should be accurate
- Daily cost charts should reflect actual usage

## Notes

- Historical data (sessions before this fix) will remain at $0.00 since the cost data was not captured
- Only new webhook events received after deploying this fix will have accurate cost data
- The cost data is provided by Retell AI and depends on their pricing and usage tracking
