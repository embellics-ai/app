-- ============================================================
-- Create Human Agent for Testing Live Handoff Feature
-- ============================================================
-- 
-- This script creates a test human agent for the live handoff feature.
-- Run this in your database console or using a database client.
--
-- INSTRUCTIONS:
-- 1. Find your tenant_id: Look in the api_keys table for your active API key
-- 2. Find your user email: The email you use to login to the platform
-- 3. Update the VALUES below with your actual tenant_id and email
-- 4. Run this script in your database
--
-- ============================================================

-- Step 1: Find your tenant_id (uncomment to run)
-- SELECT tenant_id, prefix, name FROM api_keys WHERE active = true LIMIT 5;

-- Step 2: Find your user email (uncomment to run)
-- SELECT id, email, first_name, last_name, role FROM client_users LIMIT 10;

-- ============================================================
-- CREATE HUMAN AGENT
-- ============================================================

-- Replace 'YOUR_TENANT_ID_HERE' with your actual tenant_id from api_keys table
-- Replace 'your.email@example.com' with your actual login email
INSERT INTO human_agents (
  id,
  tenant_id,
  name,
  email,
  status,
  active_chats,
  max_chats,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),                              -- Auto-generate unique ID
  'YOUR_TENANT_ID_HERE',                          -- ⚠️ REPLACE THIS with your tenant_id
  'Test Agent',                                    -- Agent display name
  'your.email@example.com',                       -- ⚠️ REPLACE THIS with your login email
  'available',                                     -- Status: available, busy, or offline
  0,                                               -- Current active chats (start at 0)
  5,                                               -- Maximum concurrent chats
  NOW(),                                           -- Created timestamp
  NOW()                                            -- Updated timestamp
)
ON CONFLICT (tenant_id, email) DO UPDATE SET
  status = 'available',
  max_chats = 5,
  updated_at = NOW();

-- ============================================================
-- VERIFY CREATION
-- ============================================================

-- Check if agent was created successfully
SELECT 
  id,
  name,
  email,
  status,
  active_chats,
  max_chats,
  created_at
FROM human_agents
WHERE email = 'your.email@example.com';  -- ⚠️ REPLACE THIS with your email

-- ============================================================
-- HELPER QUERIES (Optional - uncomment if needed)
-- ============================================================

-- View all human agents for your tenant
-- SELECT * FROM human_agents WHERE tenant_id = 'YOUR_TENANT_ID_HERE';

-- Update agent status
-- UPDATE human_agents SET status = 'available' WHERE email = 'your.email@example.com';
-- UPDATE human_agents SET status = 'offline' WHERE email = 'your.email@example.com';
-- UPDATE human_agents SET status = 'busy' WHERE email = 'your.email@example.com';

-- Delete test agent (if needed)
-- DELETE FROM human_agents WHERE email = 'your.email@example.com';

-- ============================================================
-- QUICK SETUP GUIDE
-- ============================================================
--
-- If you're using Neon Database Console:
-- 1. Go to https://console.neon.tech/
-- 2. Select your project
-- 3. Click "SQL Editor" in the left sidebar
-- 4. Copy and paste this script
-- 5. Replace the placeholders with your actual values
-- 6. Run the INSERT statement
--
-- ============================================================
