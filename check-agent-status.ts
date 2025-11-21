import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function checkAgentStatus() {
  console.log('Checking agent statuses...\n');

  const agents = await sql`
    SELECT 
      id, 
      name, 
      email, 
      status, 
      active_chats, 
      max_chats,
      created_at,
      last_seen
    FROM human_agents
    ORDER BY name
  `;

  console.log('Found', agents.length, 'agents:\n');

  agents.forEach((agent: any) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Name:         ${agent.name}`);
    console.log(`Email:        ${agent.email}`);
    console.log(`Status:       ${agent.status}`);
    console.log(`Active Chats: ${agent.active_chats} / ${agent.max_chats}`);
    console.log(`Created:      ${agent.created_at}`);
    console.log(`Last Seen:    ${agent.last_seen}`);
    console.log('');
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check if there are any users currently logged in
  console.log('Checking client_users table for comparison...\n');

  const users = await sql`
    SELECT 
      id,
      email,
      first_name,
      last_name,
      role,
      tenant_id
    FROM client_users
    WHERE role IN ('support_staff', 'client_admin')
    ORDER BY email
  `;

  console.log('Found', users.length, 'users with agent roles:\n');

  users.forEach((user: any) => {
    console.log(`${user.first_name || ''} ${user.last_name || ''} (${user.email}) - ${user.role}`);
  });

  process.exit(0);
}

checkAgentStatus().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
