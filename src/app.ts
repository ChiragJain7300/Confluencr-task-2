import express, { Express } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './config/swagger.js';
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

  // Interactive Swagger UI documentation
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // All API routes are mounted under /api/v1
  app.use('/api/v1', apiRouter);

  // Global Error Handler — must be registered last so it catches errors from all routes
  app.use(errorHandler);

  return app;
};
