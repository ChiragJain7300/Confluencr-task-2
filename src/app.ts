import express, { Express } from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/errorHandler.js';
import apiRouter from './routes/index.js';

export const createApp = (): Express => {
  const app = express();

  // Standard Middlewares
  app.use(cors());
  app.use(express.json());

  // Health Check — useful for uptime monitoring and deployment checks
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // All API routes are mounted under /api/v1
  app.use('/api/v1', apiRouter);

  // Global Error Handler — must be registered last so it catches errors from all routes
  app.use(errorHandler);

  return app;
};

