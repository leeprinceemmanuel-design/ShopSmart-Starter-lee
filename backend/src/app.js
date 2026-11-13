import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import assistantRouter from './routes/assistant.js';
import authRouter from './routes/auth.js';
import { prisma } from './lib/prisma.js';
import { loadUser, requireUser } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

// Asks PostgreSQL the smallest possible question. Gives up after 3 seconds.
async function pingDatabase() {
  let timer;
  const timeout = new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Database check timed out')), 3000); });
  try { await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]); } finally { clearTimeout(timer); }
}

// checkDatabase can be replaced in tests, so the readiness route can be tested without PostgreSQL.
export function createApp({ checkDatabase = pingDatabase } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // On a host like Render, or behind Caddy on EC2, requests pass through a proxy first. TRUST_PROXY=1 tells
  // Express to read the real visitor IP from X-Forwarded-For, so the rate limits
  // count each visitor separately. Leave it unset locally (no proxy there).
  const proxyHops = Number(process.env.TRUST_PROXY || 0);
  if (proxyHops > 0) app.set('trust proxy', proxyHops);
  app.use(helmet());
  // The request ID is set first, so even a request whose body cannot be read gets a traceId.
  app.use((request, response, next) => { request.id = crypto.randomUUID(); response.setHeader('X-Request-ID', request.id); next(); });
  // credentials: true lets the browser send the sign-in cookie when the frontend runs on another port (local dev).
  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
  app.use(morgan(':method :url :status :response-time ms'));
  app.use(express.json({ limit: '100kb' }));

  // Liveness: is the Node process answering? (does NOT touch the database)
  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
  // Readiness: can the API actually reach PostgreSQL? 503 when it cannot.
  app.get('/api/health/ready', async (request, response) => {
    try {
      await checkDatabase();
      response.json({ status: 'ok', database: 'ok' });
    } catch (error) {
      // Log only the error type, never the connection string.
      console.error(`[${request.id}] health/ready database check failed: ${error?.code || error?.name || 'Error'}`);
      response.status(503).json({ status: 'error', database: 'unreachable' });
    }
  });
  app.use('/api/auth', loadUser, authRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/orders', loadUser, requireUser, ordersRouter);
  app.use('/api/assistant', assistantRouter);
  app.use((_request, response) => response.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'API route could not be found.' } }));
  app.use(errorHandler);
  return app;
}
