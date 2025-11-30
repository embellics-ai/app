import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local (for dev) or .env (for production)
config({ path: '.env.local' });
config(); // Fallback to .env if .env.local doesn't exist

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface MigrationRecord {
  migration_name: string;
  applied_at: Date;
}

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  try {
    console.log('🔄 Starting database migrations...\n');

    // Ensure migrations tracking table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of applied migrations
    const appliedMigrations = await db.execute(sql`
      SELECT migration_name FROM schema_migrations ORDER BY migration_name
    `);

    const appliedSet = new Set(appliedMigrations.rows.map((r: any) => r.migration_name as string));

    // Read migration files from migrations directory
    const migrationsDir = join(__dirname, '..', 'migrations');
    const files = await readdir(migrationsDir);
    const migrationFiles = files.filter((f) => f.endsWith('.sql')).sort(); // Alphabetical order ensures correct sequence

    let appliedCount = 0;

    for (const file of migrationFiles) {
      if (appliedSet.has(file)) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`⚡ Applying ${file}...`);

      const migrationPath = join(migrationsDir, file);
      const migrationSQL = await readFile(migrationPath, 'utf-8');

      // Execute migration
      await db.execute(sql.raw(migrationSQL));

      // Record migration as applied
      await db.execute(sql`
        INSERT INTO schema_migrations (migration_name) 
        VALUES (${file})
      `);

      console.log(`✅ Applied ${file}`);
      appliedCount++;
    }

    if (appliedCount === 0) {
      console.log('\n✨ All migrations are up to date!');
    } else {
      console.log(`\n✅ Successfully applied ${appliedCount} migration(s)!`);
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigrations();
