/**
 * Migration Script: Remove Widget Customization Columns
 *
 * This script removes columns from the widget_configs table that are no longer used
 * since the widget now uses fixed styling matching the application design system.
 *
 * Removed columns:
 * - primary_color: Widget now uses CSS-defined colors from design system
 * - position: Not used (always bottom-right)
 * - placeholder: Hardcoded in widget
 * - custom_css: No longer allowing custom CSS
 *
 * Run: npx tsx db/migrations/run-remove-widget-customization.ts
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as dotenv from 'dotenv';

dotenv.config();

neonConfig.webSocketConstructor = ws;

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🔄 Connecting to database...');
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  try {
    console.log('📝 Running migration: Remove widget customization columns');

    // Drop columns that are no longer used
    await pool.query('ALTER TABLE widget_configs DROP COLUMN IF EXISTS primary_color');
    console.log('✅ Dropped column: primary_color');

    await pool.query('ALTER TABLE widget_configs DROP COLUMN IF EXISTS position');
    console.log('✅ Dropped column: position');

    await pool.query('ALTER TABLE widget_configs DROP COLUMN IF EXISTS placeholder');
    console.log('✅ Dropped column: placeholder');

    await pool.query('ALTER TABLE widget_configs DROP COLUMN IF EXISTS custom_css');
    console.log('✅ Dropped column: custom_css');

    console.log('\n✨ Migration completed successfully!');
    console.log('📊 Remaining columns in widget_configs:');
    console.log('   - id');
    console.log('   - tenant_id');
    console.log('   - retell_agent_id');
    console.log('   - retell_api_key');
    console.log('   - greeting');
    console.log('   - allowed_domains');
    console.log('   - updated_at');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n👋 Database connection closed');
  }
}

runMigration();
