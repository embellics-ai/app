import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { clientUsers } from './shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function initializeAdmin() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  const ADMIN_EMAIL = 'admin@embellics.com';
  const ADMIN_PASSWORD = 'admin123';

  console.log('[Init Admin] Checking for platform owner...');

  // Check if admin exists
  const existing = await db.select().from(clientUsers).where(eq(clientUsers.email, ADMIN_EMAIL));

  if (existing.length > 0) {
    console.log('[Init Admin] ✅ Platform owner already exists');
    console.log('[Init Admin] Email:', ADMIN_EMAIL);
    console.log('[Init Admin] Resetting password to: admin123');

    // Reset password
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await db
      .update(clientUsers)
      .set({ password: hashedPassword })
      .where(eq(clientUsers.email, ADMIN_EMAIL));

    console.log('[Init Admin] ✅ Password reset complete');
  } else {
    console.log('[Init Admin] Creating platform owner...');

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await db.insert(clientUsers).values({
      email: ADMIN_EMAIL,
      password: hashedPassword,
      firstName: 'Platform',
      lastName: 'Admin',
      tenantId: null,
      role: 'owner',
      isPlatformAdmin: true,
      phoneNumber: null,
      mustChangePassword: false,
      onboardingCompleted: true,
    });

    console.log('[Init Admin] ✅ Platform owner created');
  }

  console.log('\n=== LOGIN CREDENTIALS ===');
  console.log('Email: admin@embellics.com');
  console.log('Password: admin123');
  console.log('========================\n');
}

initializeAdmin()
  .then(() => {
    console.log('[Init Admin] ✅ Initialization complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Init Admin] ❌ Error:', error);
    process.exit(1);
  });
