import { createHash } from 'crypto';

// From server logs: Widget is sending "embellics_4fd1dfd3da..."
// Let me check what prefix you're using and calculate what the hash would be

const dbHash = '8364c2d56f6bedbd0e185c4846bf909aa0aeb41175bd129a8103c5a0aa8c41f1';
const yourKeyHashFromLogs = 'f05f64c3b292f9a733e5...';

console.log('Database Hash:', dbHash);
console.log('Your Key Hash:', yourKeyHashFromLogs);
console.log('');
console.log('❌ HASHES DO NOT MATCH!');
console.log('');
console.log('This means the API key you copied is NOT the one in the database.');
console.log('');
console.log('The API key prefix from the widget is: 4fd1dfd3da');
console.log('The API key prefix in database is: 4fd1dfd3');
console.log('');
console.log('They START the same, but the full key is different!');
console.log('');
console.log('💡 Solution: Look at the green banner at the top of the API Keys page');
console.log('   It should show "New API Key Created" with the FULL key.');
console.log('   Copy that EXACT key (all 64 hex characters after "embellics_")');
