import { createHash } from 'crypto';

const yourKey = 'embellics_4fd1dfd3da533b716356bd2108f53c821015a16c89a5b3212d49dfc0fb6acfdb';
const yourHash = createHash('sha256').update(yourKey).digest('hex');

const dbHash = '8364c2d56f6bedbd0e185c4846bf909aa0aeb41175bd129a8103c5a0aa8c41f1';

console.log('Your API Key:', yourKey);
console.log('Your Key Length:', yourKey.length);
console.log('Hex part length:', yourKey.replace('embellics_', '').length);
console.log('');
console.log('Your Key Hash:  ', yourHash);
console.log('Database Hash:  ', dbHash);
console.log('');

if (yourHash === dbHash) {
  console.log('✅ MATCH! Your key is correct!');
} else {
  console.log('❌ NO MATCH! Hashes are different.');
  console.log('');
  console.log('This means either:');
  console.log('1. You copied a different key than what was just created');
  console.log('2. The key in the database was changed/recreated after you copied');
  console.log('3. There was an error in key generation');
}
