import { storage } from './storage';
import { hashPassword } from './auth';

/**
 * Initialize the database with the platform owner
 * This runs on every startup to ensure the platform owner exists with the correct password
 */
export async function initializeDatabase() {
  try {
    console.log('[DB Init] Checking for platform owner...');

    const PLATFORM_OWNER_ID = '682a3041-6df2-43cb-9d49-dcd6aa100d76';
    const PLATFORM_OWNER_EMAIL = 'admin@embellics.com';
    const PLATFORM_OWNER_PASSWORD = 'admin123';

    const platformOwner = await storage.getClientUserByEmail(PLATFORM_OWNER_EMAIL);

    if (!platformOwner) {
      console.log('[DB Init] Platform owner not found. Creating...');

      // Create platform owner with known password
      const hashedPassword = await hashPassword(PLATFORM_OWNER_PASSWORD);

      await storage.createClientUser({
        email: PLATFORM_OWNER_EMAIL,
        password: hashedPassword,
        firstName: 'Platform',
        lastName: 'Admin',
        tenantId: null,
        role: 'owner',
        isPlatformAdmin: true,
        phoneNumber: null,
        mustChangePassword: false, // Platform owner doesn't need password change
        onboardingCompleted: true,
      });

      console.log('[DB Init] ✓ Platform owner created successfully');
    } else {
      // Platform owner exists - ensure password is correct
      console.log('[DB Init] Platform owner found. Resetting password to ensure consistency...');
      const hashedPassword = await hashPassword(PLATFORM_OWNER_PASSWORD);
      await storage.updateClientUserPassword(platformOwner.id, hashedPassword);
      console.log('[DB Init] ✓ Platform owner password reset');
    }

    console.log('[DB Init] === LOGIN CREDENTIALS ===');
    console.log('[DB Init] Email: admin@embellics.com');
    console.log('[DB Init] Password: admin123');
    console.log('[DB Init] ========================');
  } catch (error) {
    console.error('[DB Init] Failed to initialize database:', error);
    // Don't throw - allow the app to start even if init fails
  }
}
