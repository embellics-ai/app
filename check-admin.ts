import 'dotenv/config';
import { storage } from './server/storage';

(async () => {
  try {
    const users = await storage.getAllUsers();
    const admin = users.find((u: any) => u.email === 'admin@embellics.com');

    if (admin) {
      console.log('✅ Platform Admin Found:');
      console.log('-----------------------------------');
      console.log('ID:', admin.id);
      console.log('Email:', admin.email);
      console.log('First Name:', admin.firstName);
      console.log('Last Name:', admin.lastName);
      console.log('Role:', admin.role);
      console.log('Is Platform Admin:', admin.isPlatformAdmin);
      console.log('Tenant ID:', admin.tenantId || '(none)');
      console.log('Onboarding Completed:', admin.onboardingCompleted);
      console.log('Must Change Password:', admin.mustChangePassword);
      console.log('Created At:', admin.createdAt);
    } else {
      console.log('❌ admin@embellics.com NOT FOUND in database');
    }

    console.log('\n📊 Total users in database:', users.length);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
