import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL!);

async function checkGreeting() {
  try {
    const result = await sql`SELECT tenant_id, greeting FROM widget_configs LIMIT 5`;
    console.log('\n📋 Widget Configs in Database:\n');
    result.forEach((row: any) => {
      console.log(`Tenant: ${row.tenant_id.slice(0, 8)}...`);
      console.log(`Greeting: "${row.greeting}"\n`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

checkGreeting();
