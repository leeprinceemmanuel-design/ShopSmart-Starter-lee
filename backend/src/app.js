import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import assistantRouter from './routes/assistant.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // On a host like Render, requests pass through the host's proxy first. TRUST_PROXY=1 tells
  // Express to read the real visitor IP from X-Forwarded-For, so the assistant rate limit
  // counts each visitor separately. Leave it unset locally (no proxy there).
  const proxyHops = Number(process.env.TRUST_PROXY || 0);
  if (proxyHops > 0) app.set('trust proxy', proxyHops);
  app.use(helmet());
  // The request ID is set first, so even a request whose body cannot be read gets a traceId.
  app.use((request, response, next) => { request.id = crypto.randomUUID(); response.setHeader('X-Request-ID', request.id); next(); });
  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
  app.use(morgan(':method :url :status :response-time ms'));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
  app.use('/api/products', productsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/assistant', assistantRouter);
  app.use((_request, response) => response.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'API route could not be found.' } }));
  app.use(errorHandler);
  return app;
}
