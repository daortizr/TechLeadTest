import express from 'express';
import { dataSource } from './infraestructure/database/dataSource';
import { config } from './infraestructure/config/env';
import { logger } from './infraestructure/utilities';
import { errorHandlerMiddleware } from './infraestructure/api/middlewares';
import { createRouter } from './infraestructure/api/routes';
import { sseHub } from './infraestructure/api/sse/SseHub';

async function main() {
  try {
    // Initialize database
    await dataSource.initialize();
    await dataSource.runMigrations();
    logger.info('Database initialized and migrations run');

    // Initialize Express app
    const app = express();

    // Middleware
    app.use(express.json());

    // API routes
    app.use('/api', createRouter());

    // SSE Hub
    sseHub.start();

    // Error handling middleware (must be last)
    app.use(errorHandlerMiddleware);

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Ruta no encontrada'
        }
      });
    });

    // Start server
    const server = app.listen(config.PORT, () => {
      logger.info(`Server running on port ${config.PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      sseHub.stop();
      server.close(() => {
        dataSource.destroy();
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error: String(error) });
    process.exit(1);
  }
}

main();
