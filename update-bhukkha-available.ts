import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function updateBhukkhaStatus() {
  console.log('Updating Bhukkha Reddy status to available...\n');

  // Update status to available and last_seen to now
  const result = await sql`
    UPDATE human_agents 
    SET 
      status = 'available',
      last_seen = NOW()
    WHERE email = 'hisloveforwords@gmail.com'
    RETURNING id, name, email, status, last_seen
  `;

  if (result.length > 0) {
    console.log('✅ Updated agent:');
    console.log(`   Name:      ${result[0].name}`);
    console.log(`   Email:     ${result[0].email}`);
    console.log(`   Status:    ${result[0].status}`);
    console.log(`   Last Seen: ${result[0].last_seen}`);
  } else {
    console.log('❌ Agent not found');
  }

  console.log('\n✅ Done! Agent should now show as available in the dashboard.');
  console.log('💡 Refresh the dashboard to see the change.');
  process.exit(0);
}

updateBhukkhaStatus().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
