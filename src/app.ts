import express, { Express } from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/errorHandler.js';

export const createApp = (): Express => {
  const app = express();

  // Standard Middlewares
  app.use(cors());
  app.use(express.json());

  // Health Check
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Base API Router will be mounted here in Phase 2/3
  // app.use('/api/v1', apiRouter);

  // Global Error Handler
  app.use(errorHandler);

  return app;
};

