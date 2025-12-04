-- Migration: Remove unused tables
-- Date: 2024-12-04
-- Description: Drop 4 completely unused tables

-- 1. Drop analytics_events (never actually used)
DROP TABLE IF EXISTS analytics_events CASCADE;

-- 2. Drop daily_analytics (never populated or queried)
DROP TABLE IF EXISTS daily_analytics CASCADE;

-- 3. Drop webhook_analytics (planned but never implemented)
DROP TABLE IF EXISTS webhook_analytics CASCADE;

-- 4. Drop users table (replaced by client_users)
DROP TABLE IF EXISTS users CASCADE;

-- Note: Keeping conversations and messages tables as they are still used in:
-- - conversation.routes.ts
-- - handoff.routes.ts
-- These can be removed in a future migration after those features are refactored
