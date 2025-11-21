import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function fixAgentStatus() {
  console.log('Fixing Bhukkha Reddy agent status...\n');

  // Update status to offline
  const result = await sql`
    UPDATE human_agents 
    SET status = 'offline' 
    WHERE email = 'hisloveforwords@gmail.com'
    RETURNING id, name, email, status
  `;

  if (result.length > 0) {
    console.log('✅ Updated agent status:');
    console.log(`   Name:   ${result[0].name}`);
    console.log(`   Email:  ${result[0].email}`);
    console.log(`   Status: ${result[0].status}`);
  } else {
    console.log('❌ Agent not found');
  }

  console.log('\n✅ Done! Agent should now show as offline in the dashboard.');
  process.exit(0);
}

fixAgentStatus().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
