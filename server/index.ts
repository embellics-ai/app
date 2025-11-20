import 'dotenv/config';
import express, { type Request, Response, NextFunction, type Express } from 'express';
import expressWs from 'express-ws';
import { createServer } from 'http';
import rateLimit from 'express-rate-limit';
import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';
import { initializeDatabase } from './db-init';

const app = express();
// Create HTTP server first, then add WebSocket support to it
const httpServer = createServer(app);
const { app: wsApp, getWss } = expressWs(app, httpServer);

// Export WebSocket broadcast function for use in routes
export { getWss };

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + '…';
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Serve widget test HTML file BEFORE registerRoutes and Vite middleware
  // This ensures this specific route is not intercepted by the SPA
  const fs = await import('fs');
  const path = await import('path');

  // Rate limiter for test HTML file to prevent abuse
  const testHtmlLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });

  app.get('/widget-simple-test.html', testHtmlLimiter, async (req, res) => {
    try {
      const filePath = path.resolve(process.cwd(), 'docs', 'widget-simple-test.html');

      if (!fs.existsSync(filePath)) {
        return res.status(404).send('Test file not found');
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      const content = fs.readFileSync(filePath, 'utf-8');
      res.send(content);
    } catch (error) {
      console.error('Error serving test HTML:', error);
      res.status(500).send('Failed to load test file');
    }
  });

  await registerRoutes(wsApp as any as Express);

  // Initialize database with platform owner if needed
  await initializeDatabase();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get('env') === 'development') {
    await setupVite(app, httpServer);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 3000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0'; // Bind to all interfaces in production
  httpServer.listen(port, host, () => {
    log(`serving on ${host}:${port}`);
  });
})();
