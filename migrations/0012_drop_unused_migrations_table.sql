-- Migration: Drop unused migrations table
-- Date: 2025-12-18
-- Description: Remove the unused 'migrations' table. The system uses 'schema_migrations' table instead.

DROP TABLE IF EXISTS migrations CASCADE;
