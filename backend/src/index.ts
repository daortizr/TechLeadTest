import express from 'express';
import { dataSource } from './infraestructure/database/dataSource';
import { config } from './infraestructure/config/env';
import { logger } from './infraestructure/utilities';
import { AppError } from './application/errorHandler';

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

    // Health check
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // TODO: Add routes
    // TODO: Add SSE handler

    // Error handling middleware
    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error', { error: err.message, stack: err.stack });

      if (err instanceof AppError) {
        return res.status(err.statusCode).json(err.toJSON());
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error interno del servidor'
        }
      });
    });

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
    app.listen(config.PORT, () => {
      logger.info(`Server running on port ${config.PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: String(error) });
    process.exit(1);
  }
}

main();
