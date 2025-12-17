-- Script to completely wipe database and start fresh
-- WARNING: This will delete EVERYTHING including all data!
-- Run this on your NEW empty database before running migrations

-- Drop all tables (CASCADE will drop dependent objects)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Grant permissions back
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Verify it's empty
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
