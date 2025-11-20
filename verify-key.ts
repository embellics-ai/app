import { createHash } from 'crypto';

const fullKey = 'embellics_2e5a123d6582c4f1f89c8b180cbef73b67a0af76d849a6a43632b2de93521a05';
const keyHash = createHash('sha256').update(fullKey).digest('hex');

console.log('Full API Key:', fullKey);
console.log('Calculated Hash:', keyHash);
console.log('\nThis hash should match what\'s in the database for prefix: 2e5a123d');
