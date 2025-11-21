#!/usr/bin/env node
/**
 * Entry point that loads environment variables before starting the server
 */

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Load .env first, then .env.local (which overrides .env)
config(); // Load .env
const envLocalPath = resolve(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true }); // Load .env.local and override
  console.log('[Server] 🔧 Loaded .env.local - using local configuration');
}

// Now that environment variables are loaded, start the server
import('./index.js').catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
