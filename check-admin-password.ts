import 'dotenv/config';
import { storage } from './server/storage';
import { verifyPassword } from './server/auth';

(async () => {
  try {
    const users = await storage.getAllUsers();
    const admin = users.find((u: any) => u.email === 'admin@embellics.com');

    if (!admin) {
      console.log('❌ admin@embellics.com NOT FOUND in database');
      process.exit(1);
    }

    console.log('✅ Platform Admin Found:');
    console.log('-----------------------------------');
    console.log('Email:', admin.email);
    console.log('Has Password Hash:', !!admin.password);
    console.log('Password Hash Length:', admin.password?.length || 0);
    console.log('Password Hash Preview:', admin.password?.substring(0, 30) + '...');

    // Test common passwords
    const testPasswords = [
      'admin123',
      'Admin123!',
      'password',
      'Password123!',
      'embellics',
      'Embellics123!',
    ];

    console.log('\n🔐 Testing common passwords:');
    console.log('-----------------------------------');

    for (const testPwd of testPasswords) {
      try {
        const isValid = await verifyPassword(testPwd, admin.password);
        if (isValid) {
          console.log(`✅ PASSWORD MATCH: "${testPwd}"`);
        } else {
          console.log(`❌ No match: "${testPwd}"`);
        }
      } catch (error) {
        console.log(`⚠️  Error testing "${testPwd}":`, error);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
