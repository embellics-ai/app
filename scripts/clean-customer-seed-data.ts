import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../shared/schema';
import { eq, like } from 'drizzle-orm';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

async function cleanCustomerSeedData() {
  try {
    console.log('🗑️  Cleaning customer seed data...\n');

    // Get the first tenant
    const [tenant] = await db.select().from(schema.tenants).limit(1);

    if (!tenant) {
      console.log('❌ No tenant found.');
      await pool.end();
      process.exit(0);
    }

    console.log(`📍 Cleaning data for tenant: ${tenant.name} (ID: ${tenant.id})\n`);

    // Delete all bookings for this tenant
    const deletedBookings = await db
      .delete(schema.bookings)
      .where(eq(schema.bookings.tenantId, tenant.id))
      .returning();

    console.log(`   ✅ Deleted ${deletedBookings.length} bookings`);

    // Delete all client service mappings
    const deletedMappings = await db
      .delete(schema.clientServiceMappings)
      .where(eq(schema.clientServiceMappings.tenantId, tenant.id))
      .returning();

    console.log(`   ✅ Deleted ${deletedMappings.length} service mappings`);

    // Delete all leads
    const deletedLeads = await db
      .delete(schema.leads)
      .where(eq(schema.leads.tenantId, tenant.id))
      .returning();

    console.log(`   ✅ Deleted ${deletedLeads.length} leads`);

    // Delete all clients
    const deletedClients = await db
      .delete(schema.clients)
      .where(eq(schema.clients.tenantId, tenant.id))
      .returning();

    console.log(`   ✅ Deleted ${deletedClients.length} clients`);

    console.log('\n✅ Seed data cleaned successfully!\n');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning seed data:', error);
    await pool.end();
    process.exit(1);
  }
}

cleanCustomerSeedData();
