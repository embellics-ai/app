import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

async function seedCustomerData() {
  try {
    console.log('🌱 Seeding customer data for testing...\n');

    // Get the first tenant (you can change this to your specific tenant)
    const [tenant] = await db.select().from(schema.tenants).limit(1);

    if (!tenant) {
      console.error('❌ No tenant found. Please create a tenant first.');
      await pool.end();
      process.exit(1);
    }

    console.log(`📍 Using tenant: ${tenant.name} (ID: ${tenant.id})\n`);

    // Get or create a business for this tenant
    let [business] = await db
      .select()
      .from(schema.tenantBusinesses)
      .where(eq(schema.tenantBusinesses.tenantId, tenant.id))
      .limit(1);

    if (!business) {
      console.log('📦 Creating business entity...');
      [business] = await db
        .insert(schema.tenantBusinesses)
        .values({
          tenantId: tenant.id,
          serviceName: 'phorest_api',
          businessId: 'test_business_123',
          businessName: 'Test Salon & Spa',
        })
        .returning();
      console.log(`   ✅ Business created: ${business.businessName}\n`);
    } else {
      console.log(`   ✅ Using existing business: ${business.businessName}\n`);
    }

    // Create sample clients
    const sampleClients = [
      {
        firstName: 'Emma',
        lastName: 'Johnson',
        email: 'emma.johnson@example.com',
        phone: '+353871234567',
        firstInteractionSource: 'voice',
        firstInteractionDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        firstBookingDate: new Date(Date.now() - 58 * 24 * 60 * 60 * 1000),
        lastBookingDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        status: 'active',
      },
      {
        firstName: 'Sophie',
        lastName: 'Brown',
        email: 'sophie.brown@example.com',
        phone: '+353872345678',
        firstInteractionSource: 'web',
        firstInteractionDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        firstBookingDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        lastBookingDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        status: 'active',
      },
      {
        firstName: 'Olivia',
        lastName: 'Wilson',
        email: null,
        phone: '+353873456789',
        firstInteractionSource: 'whatsapp',
        firstInteractionDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        firstBookingDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        lastBookingDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        status: 'active',
      },
      {
        firstName: 'Ava',
        lastName: 'Martinez',
        email: 'ava.martinez@example.com',
        phone: '+353874567890',
        firstInteractionSource: 'voice',
        firstInteractionDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        firstBookingDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        lastBookingDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: 'active',
      },
      {
        firstName: 'Isabella',
        lastName: 'Garcia',
        email: 'isabella.garcia@example.com',
        phone: '+353875678901',
        firstInteractionSource: 'web',
        firstInteractionDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        firstBookingDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        lastBookingDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        status: 'active',
      },
      {
        firstName: 'Mia',
        lastName: 'Rodriguez',
        email: 'mia.rodriguez@example.com',
        phone: '+353876789012',
        firstInteractionSource: 'whatsapp',
        firstInteractionDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        firstBookingDate: null,
        lastBookingDate: null,
        status: 'inactive',
      },
    ];

    console.log('👥 Creating clients...');
    const createdClients = [];

    for (const clientData of sampleClients) {
      const [client] = await db
        .insert(schema.clients)
        .values({
          tenantId: tenant.id,
          ...clientData,
        })
        .returning();

      createdClients.push(client);
      console.log(`   ✅ ${client.firstName} ${client.lastName} - ${client.phone}`);

      // Create service mapping for each client
      await db.insert(schema.clientServiceMappings).values({
        clientId: client.id,
        tenantId: tenant.id,
        businessId: business.id,
        branchId: null,
        serviceName: 'phorest_api',
        serviceProviderClientId: `phorest_${Math.random().toString(36).substr(2, 9)}`,
      });
    }

    console.log('');

    // Create bookings for active clients
    const services = [
      { name: 'Deep Tissue Massage', category: 'massage', price: 85, duration: 60 },
      { name: 'Swedish Massage', category: 'massage', price: 75, duration: 60 },
      { name: 'Hot Stone Massage', category: 'massage', price: 95, duration: 90 },
      { name: 'Classic Facial', category: 'facial', price: 70, duration: 60 },
      { name: 'Anti-Aging Facial', category: 'facial', price: 120, duration: 75 },
      { name: 'Hydrating Facial', category: 'facial', price: 85, duration: 60 },
      { name: 'Gel Manicure', category: 'nails', price: 45, duration: 45 },
      { name: 'Gel Pedicure', category: 'nails', price: 55, duration: 60 },
      { name: 'Hair Cut & Style', category: 'hair', price: 65, duration: 60 },
      { name: 'Hair Color', category: 'hair', price: 120, duration: 120 },
    ];

    const staffMembers = [
      "Sarah O'Connor",
      'Michael Ryan',
      'Rachel Murphy',
      'David Kelly',
      'Emma Walsh',
    ];

    console.log('📅 Creating bookings...');
    let totalBookings = 0;

    for (const client of createdClients) {
      if (client.status === 'inactive') continue; // Skip inactive clients

      // Create 2-5 bookings per active client
      const numBookings = Math.floor(Math.random() * 4) + 2;

      for (let i = 0; i < numBookings; i++) {
        const service = services[Math.floor(Math.random() * services.length)];
        const staffMember = staffMembers[Math.floor(Math.random() * staffMembers.length)];

        // Create bookings spread over the last 60 days
        const daysAgo = Math.floor(Math.random() * 60) + 1;
        const bookingDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

        // Most recent booking is more likely to be confirmed, older ones completed
        const isRecent = daysAgo < 7;
        const status = isRecent
          ? Math.random() > 0.2
            ? 'confirmed'
            : 'completed'
          : Math.random() > 0.1
            ? 'completed'
            : 'cancelled';

        const paymentStatus =
          status === 'completed' ? 'paid' : status === 'cancelled' ? 'refunded' : 'pending';

        await db.insert(schema.bookings).values({
          tenantId: tenant.id,
          clientId: client.id,
          businessId: business.id,
          branchId: null,
          serviceName: service.name,
          amount: service.price + (Math.random() * 10 - 5), // Add some variation
          currency: 'EUR',
          bookingDateTime: bookingDate,
          staffMemberId: `staff_${Math.random().toString(36).substr(2, 9)}`,
          status,
          serviceProvider: 'phorest_api',
          serviceProviderBookingId: `booking_${Math.random().toString(36).substr(2, 9)}`,
          bookingSource: client.firstInteractionSource,
          paymentStatus,
        });

        totalBookings++;
      }
    }

    console.log(`   ✅ Created ${totalBookings} bookings\n`);

    // Create some leads
    const sampleLeads = [
      {
        firstName: 'Charlotte',
        lastName: 'Taylor',
        email: 'charlotte.taylor@example.com',
        phone: '+353877890123',
        source: 'voice',
        status: 'new',
      },
      {
        firstName: 'Amelia',
        lastName: 'Anderson',
        email: null,
        phone: '+353878901234',
        source: 'web',
        status: 'contacted',
        callAttempts: 1,
        lastContactedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        nextFollowUpAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      },
      {
        firstName: 'Harper',
        lastName: 'Thomas',
        email: 'harper.thomas@example.com',
        phone: '+353879012345',
        source: 'whatsapp',
        status: 'interested',
        callAttempts: 2,
        lastContactedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    ];

    console.log('🎯 Creating leads...');
    for (const leadData of sampleLeads) {
      const [lead] = await db
        .insert(schema.leads)
        .values({
          tenantId: tenant.id,
          ...leadData,
        })
        .returning();

      console.log(`   ✅ ${lead.firstName} ${lead.lastName} - ${lead.status}`);
    }

    console.log('\n✅ Seed data created successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • Clients: ${createdClients.length}`);
    console.log(
      `   • Active Clients: ${createdClients.filter((c) => c.status === 'active').length}`,
    );
    console.log(`   • Bookings: ${totalBookings}`);
    console.log(`   • Leads: ${sampleLeads.length}`);
    console.log(`   • Tenant: ${tenant.name}`);
    console.log('\n💡 You can now view this data in the Customers dashboard!');
    console.log('\n🗑️  To remove seed data, run: npm run seed:clean-customers\n');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    await pool.end();
    process.exit(1);
  }
}

seedCustomerData();
