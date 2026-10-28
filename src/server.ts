import { createApp } from './app.js';
import { config } from './config/index.js';
import { prisma } from './config/prisma.js';

const app = createApp();

const startServer = async () => {
  try {
    // Verify DB Connection
    await prisma.$connect();
    console.log('Successfully connected to PostgreSQL database');

    const server = app.listen(config.port, () => {
      console.log(`Server listening on port ${config.port} in ${config.nodeEnv} mode`);
    });

    const shutdown = async () => {
      console.log('Shutting down gracefully...');
      server.close(async () => {
        await prisma.$disconnect();
        console.log('Prisma client disconnected');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();

