#!/usr/bin/env node

/**
 * Wipe Database Script
 * Completely drops all tables and schemas to start fresh
 * USE WITH CAUTION - THIS DELETES EVERYTHING!
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import * as readline from 'readline';

// Load environment variables
dotenv.config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment');
  process.exit(1);
}

// Create readline interface for confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function askConfirmation(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function wipeDatabase() {
  console.log('\n🚨 WARNING: DATABASE WIPE OPERATION 🚨');
  console.log('═'.repeat(50));
  console.log(`Database: ${DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown'}`);
  console.log('This will delete:');
  console.log('  - ALL tables');
  console.log('  - ALL data');
  console.log('  - ALL schemas');
  console.log('  - ALL migrations history');
  console.log('═'.repeat(50));

  const confirmed = await askConfirmation('\nType "yes" to proceed: ');

  if (!confirmed) {
    console.log('❌ Operation cancelled');
    rl.close();
    process.exit(0);
  }

  const doubleCheck = await askConfirmation('\n⚠️  Are you ABSOLUTELY sure? Type "yes" again: ');

  if (!doubleCheck) {
    console.log('❌ Operation cancelled');
    rl.close();
    process.exit(0);
  }

  console.log('\n🔥 Starting database wipe...\n');

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Drop public schema and recreate
    await pool.query('DROP SCHEMA public CASCADE;');
    console.log('✅ Dropped public schema');

    await pool.query('CREATE SCHEMA public;');
    console.log('✅ Created fresh public schema');

    await pool.query('GRANT ALL ON SCHEMA public TO postgres;');
    await pool.query('GRANT ALL ON SCHEMA public TO public;');
    console.log('✅ Granted permissions');

    // Verify it's empty
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);

    console.log(`\n✅ Database wiped successfully!`);
    console.log(`📊 Tables remaining: ${result.rows.length}`);

    if (result.rows.length === 0) {
      console.log('✨ Database is completely empty and ready for fresh migrations');
    }
  } catch (error) {
    console.error('❌ Error wiping database:', error);
    process.exit(1);
  } finally {
    await pool.end();
    rl.close();
  }
}

wipeDatabase();
