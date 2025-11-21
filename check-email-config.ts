import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Load .env first, then .env.local (which overrides .env)
config(); // Load .env
const envLocalPath = resolve(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true }); // Load .env.local and override
  console.log('✅ Loaded .env.local\n');
} else {
  console.log('⚠️  No .env.local found, using .env only\n');
}

console.log('Current SMTP Configuration:');
console.log('----------------------------');
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_SECURE:', process.env.SMTP_SECURE);
console.log('SMTP_USER:', process.env.SMTP_USER || '(none)');
console.log('SMTP_FROM_EMAIL:', process.env.SMTP_FROM_EMAIL);
console.log('----------------------------\n');

if (process.env.SMTP_HOST === 'localhost') {
  console.log('✅ Using MailDev (localhost:1025)');
  console.log('📧 View emails at: http://localhost:1080\n');
} else if (process.env.SMTP_HOST === 'smtp.gmail.com') {
  console.log('⚠️  Using Gmail SMTP (real emails will be sent!)');
} else {
  console.log('ℹ️  Using custom SMTP:', process.env.SMTP_HOST);
}
