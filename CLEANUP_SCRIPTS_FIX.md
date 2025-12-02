# Database Cleanup Scripts Fix

## Issue Discovered

When running `clean-dev-database.cjs` on Dec 2, 2025, not all tables were being dropped. This resulted in orphaned data persisting across "clean" restarts.

## Root Cause

The cleanup scripts (`clean-dev-database.cjs` and `clean-prod-database.cjs`) had an **incomplete table list**. Several tables were missing from the DROP sequence:

### Missing Tables:

- ❌ `n8n_webhooks` - **Critical**: Contained webhooks from Dec 1st after "clean"
- ❌ `webhook_analytics`
- ❌ `chat_messages`
- ❌ `analytics_events`
- ❌ `users` (legacy table)

## Evidence

After running cleanup and migrations, the `n8n_webhooks` table still contained:

```
Workflow: contact_form
Tenant ID: e3fe58df-4077-4fc2-a75a-f0fa8ac50028  ← Orphaned (tenant deleted)
Created: Mon Dec 01 2025 14:06:50 GMT+0000

Workflow: get_booking_details-pm
Tenant ID: e3fe58df-4077-4fc2-a75a-f0fa8ac50028  ← Orphaned (tenant deleted)
Created: Mon Dec 01 2025 15:27:26 GMT+0000
```

These webhooks pointed to tenants that were deleted when `tenants` table was dropped, but the webhooks survived because their table wasn't in the DROP list.

## Fix Applied

Updated both cleanup scripts with **complete table list** (23 tables total):

```javascript
const tables = [
  // Analytics and messages (leaf tables)
  'chat_messages',
  'webhook_analytics',
  'daily_analytics',
  'analytics_events',
  'messages',

  // Conversations and handoffs
  'conversations',
  'widget_handoff_messages',
  'widget_handoffs',
  'widget_chat_messages',

  // Analytics
  'chat_analytics',
  'voice_analytics',

  // Webhooks and integrations
  'n8n_webhooks',
  'oauth_credentials',
  'tenant_integrations',

  // Widget and agent configs
  'widget_configs',
  'human_agents',

  // Users and auth
  'password_reset_tokens',
  'user_invitations',
  'client_users',
  'api_keys',

  // Tenants (parent table)
  'tenants',

  // Legacy
  'users',

  // Migrations
  'migrations',
  'schema_migrations',
];
```

## Impact

- **Before**: Partial cleanup left orphaned data (foreign key violations, stale webhooks)
- **After**: Complete cleanup ensures truly fresh database state
- **Note**: These scripts are gitignored, so changes are local only

## Recommendation

If you encounter foreign key errors or unexpected data after cleanup, the scripts have been fixed. Consider re-running cleanup if needed:

```bash
node clean-dev-database.cjs
# Then restart server to run migrations
npm run dev
```

## All Current Tables (23 total)

1. analytics_events
2. api_keys
3. chat_analytics
4. chat_messages
5. client_users
6. conversations
7. daily_analytics
8. human_agents
9. messages
10. n8n_webhooks
11. oauth_credentials
12. password_reset_tokens
13. schema_migrations
14. tenant_integrations
15. tenants
16. user_invitations
17. users (legacy)
18. voice_analytics
19. webhook_analytics
20. widget_chat_messages
21. widget_configs
22. widget_handoff_messages
23. widget_handoffs
