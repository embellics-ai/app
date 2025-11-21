import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function addLastSeenColumn() {
  console.log('Adding last_seen column to human_agents table...\n');

  try {
    // Add last_seen column with default value of NOW()
    await sql`
      ALTER TABLE human_agents 
      ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT NOW()
    `;

    console.log('✅ Added last_seen column successfully');

    // Update existing rows to have last_seen = created_at
    await sql`
      UPDATE human_agents 
      SET last_seen = created_at 
      WHERE last_seen IS NULL
    `;

    console.log('✅ Updated existing rows with last_seen = created_at');

    // Verify the migration
    const agents = await sql`
      SELECT name, email, status, last_seen 
      FROM human_agents 
      ORDER BY name
    `;

    console.log('\n📊 Current agents:');
    agents.forEach((agent: any) => {
      console.log(`   ${agent.name} (${agent.email})`);
      console.log(`   Status: ${agent.status}, Last seen: ${agent.last_seen}`);
      console.log('');
    });

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addLastSeenColumn();
