import { dataSource } from './infraestructure/database/dataSource';
import { config } from './infraestructure/config/env';
import { buildContainer } from './infraestructure/config/container';
import { refreshDemoData } from './infraestructure/database/refreshDemoData';
import { LockExpirationJob } from './infraestructure/cron/lockExpirationJob';
import { logger } from './infraestructure/utilities';
import { createApp } from './app';

async function main(): Promise<void> {
  try {
    await dataSource.initialize();
    await dataSource.runMigrations();
    logger.info('Database initialized and migrations run');
    await refreshDemoData(dataSource);

    const container = buildContainer(dataSource);
    const expirationJob = new LockExpirationJob(container.expireLocks, logger, config.expirationJobIntervalMs);

    container.sseHub.start();
    expirationJob.start();

    const server = createApp(container).listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
    });

    const shutdown = (signal: string): void => {
      logger.info(`${signal} received, shutting down gracefully`);
      container.sseHub.stop();
      expirationJob.stop();
      server.close(() => {
        void dataSource.destroy().then(() => process.exit(0));
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', { error: String(error) });
    process.exit(1);
  }
}

void main();
