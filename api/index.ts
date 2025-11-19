import express from 'express';
import { registerRoutes } from '../server/routes';
import { initializeDatabase } from '../server/db-init';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for Vercel
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Initialize database and routes
let initialized = false;

async function initialize() {
  if (!initialized) {
    console.log('[Vercel API] Initializing database and routes...');
    await initializeDatabase();
    await registerRoutes(app);
    initialized = true;
    console.log('[Vercel API] Initialization complete');
  }
}

// Vercel serverless function handler
export default async function handler(req: any, res: any) {
  await initialize();
  
  // Convert Vercel request to Express request
  app(req, res);
}
