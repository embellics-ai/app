import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { apiKeys, tenants, widgetConfigs } from './shared/schema';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL!;

async function checkApiKeys() {
  const sql = neon(DATABASE_URL);
  const db = drizzle(sql);

  console.log('🔍 Checking API Keys and Widget Configs...\n');

  const allApiKeys = await db.select().from(apiKeys);
  const allTenants = await db.select().from(tenants);
  const allWidgetConfigs = await db.select().from(widgetConfigs);

  console.log(`📊 Found ${allTenants.length} tenants`);
  console.log(`📊 Found ${allWidgetConfigs.length} widget configs`);
  console.log(`📊 Found ${allApiKeys.length} API keys\n`);

  if (allTenants.length > 0) {
    for (const tenant of allTenants) {
      console.log(`\n--- Tenant: ${tenant.name} (ID: ${tenant.id}) ---`);

      const widgetConfig = allWidgetConfigs.find((w) => w.tenantId === tenant.id);
      if (widgetConfig) {
        console.log(`  Widget Config:`);
        console.log(
          `    - Retell API Key: ${widgetConfig.retellApiKey ? `${widgetConfig.retellApiKey.substring(0, 10)}...` : 'NOT SET'}`,
        );
        console.log(`    - Retell Agent ID: ${widgetConfig.retellAgentId || 'NOT SET'}`);
        console.log(`    - Greeting: ${widgetConfig.greeting || 'NOT SET'}`);
      } else {
        console.log(`  Widget Config: NOT FOUND`);
      }

      const tenantApiKeys = allApiKeys.filter((k) => k.tenantId === tenant.id);
      if (tenantApiKeys.length > 0) {
        console.log(`  API Keys (${tenantApiKeys.length}):`);
        tenantApiKeys.forEach((key) => {
          console.log(`    - Name: ${key.name || 'Unnamed'}`);
          console.log(`      Prefix: ${key.keyPrefix}`);
          console.log(`      Created: ${key.createdAt}`);
        });
      } else {
        console.log(`  API Keys: NONE`);
      }
    }
  }

  if (allApiKeys.length === 0) {
    console.log('\n⚠️  NO API KEYS FOUND!');
    console.log('The auto-generation may not have worked.');
  }
}

checkApiKeys()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
