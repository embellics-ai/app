import { createHash } from 'crypto';

const fullKey = 'embellics_YOUR_API_KEY_HERE'; // Replace with actual key for testing
const keyHash = createHash('sha256').update(fullKey).digest('hex');

console.log('Full API Key:', fullKey);
console.log('Calculated Hash:', keyHash);
console.log("\nThis hash should match what's in the database for prefix: 2e5a123d");
