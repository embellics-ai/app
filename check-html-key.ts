import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { apiKeys } from './shared/schema';
import dotenv from 'dotenv';
import { createHash } from 'crypto';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL!;

async function checkHtmlKey() {
  const sql = neon(DATABASE_URL);
  const db = drizzle(sql);

  const htmlKey = 'embellics_a30ec232bff311b45537c0fe626d4e365b4da69581160082468e2ac887434169';
  const htmlKeyHash = createHash('sha256').update(htmlKey).digest('hex');
  
  console.log('Key in your HTML file:');
  console.log('  Key:', htmlKey);
  console.log('  Hash:', htmlKeyHash);
  console.log('');

  const allKeys = await db.select().from(apiKeys);
  
  console.log('Keys in database:');
  allKeys.forEach(key => {
    console.log(`  Prefix: ${key.keyPrefix}`);
    console.log(`  Hash: ${key.keyHash}`);
    console.log(`  Match: ${key.keyHash === htmlKeyHash ? '✅ YES!' : '❌ No'}`);
    console.log('');
  });

  if (allKeys.some(k => k.keyHash === htmlKeyHash)) {
    console.log('✅ Your HTML key EXISTS in the database!');
    console.log('The widget SHOULD work. If it doesn\'t, check:');
    console.log('1. Is the server running on port 3000?');
    console.log('2. Are there any CORS errors in browser console?');
    console.log('3. Is the widget.js file loading correctly?');
  } else {
    console.log('❌ Your HTML key DOES NOT exist in the database!');
    console.log('You need to use the key that was just created.');
  }
}

checkHtmlKey()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
