#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routesPath = path.join(__dirname, 'server', 'routes.ts');
let content = fs.readFileSync(routesPath, 'utf-8');

// Pattern to find and replace SHA256 validation with bcrypt validation
const sha256Pattern =
  /\/\/ Validate API key\s+const keyHash = createHash\('sha256'\)\.update\(apiKey\)\.digest\('hex'\);\s+const apiKeyRecord = await storage\.getApiKeyByHash\(keyHash\);\s+if \(!apiKeyRecord\) \{\s+return res\.status\(401\)\.json\(\{ error: 'Invalid API key' \}\);\s+\}/g;

const bcryptReplacement = `// Validate API key - get all keys and verify with bcrypt
      const allApiKeys = await storage.getAllApiKeys();
      let apiKeyRecord = null;

      for (const key of allApiKeys) {
        const isMatch = await verifyPassword(apiKey, key.keyHash);
        if (isMatch) {
          apiKeyRecord = key;
          break;
        }
      }

      if (!apiKeyRecord) {
        return res.status(401).json({ error: 'Invalid API key' });
      }`;

const originalCount = (content.match(sha256Pattern) || []).length;
content = content.replace(sha256Pattern, bcryptReplacement);
const newCount = (content.match(/Validate API key - get all keys and verify with bcrypt/g) || [])
  .length;

fs.writeFileSync(routesPath, content, 'utf-8');

console.log(`✅ Fixed API key validation!`);
console.log(`   Found ${originalCount} SHA256 validations`);
console.log(`   Replaced with bcrypt validation`);
console.log(`   Total bcrypt validations now: ${newCount}`);
