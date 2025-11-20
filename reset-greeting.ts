import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL!);

async function resetGreeting() {
  try {
    console.log('🔄 Resetting custom greeting to default...\n');

    const result = await sql`
      UPDATE widget_configs 
      SET greeting = 'Hi! How can I help you today?'
      WHERE greeting != 'Hi! How can I help you today?'
      RETURNING tenant_id, greeting
    `;

    if (result.length > 0) {
      console.log('✅ Updated greetings:\n');
      result.forEach((row: any) => {
        console.log(`Tenant: ${row.tenant_id.slice(0, 8)}...`);
        console.log(`New Greeting: "${row.greeting}"\n`);
      });
    } else {
      console.log('✅ All greetings are already set to default!');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

resetGreeting();
