import 'dotenv/config';

console.log('\n📊 Database Connection Details for DBeaver\n');
console.log('='.repeat(60));

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.log('❌ DATABASE_URL not found in .env');
  process.exit(1);
}

// Parse the connection string
try {
  const url = new URL(dbUrl);

  console.log('\n🔧 Connection Settings:\n');
  console.log(`Host:     ${url.hostname}`);
  console.log(`Port:     ${url.port || '5432'}`);
  console.log(`Database: ${url.pathname.slice(1)}`);
  console.log(`Username: ${url.username}`);
  console.log(`Password: ${url.password ? '***' + url.password.slice(-4) : '(none)'}`);
  console.log(`SSL Mode: ${url.searchParams.get('sslmode') || 'require'}`);

  console.log('\n' + '='.repeat(60));
  console.log('\n📋 Full Connection String (for reference):\n');
  console.log(dbUrl);
  console.log('\n' + '='.repeat(60) + '\n');
} catch (error) {
  console.error('❌ Error parsing DATABASE_URL:', error);
  process.exit(1);
}
