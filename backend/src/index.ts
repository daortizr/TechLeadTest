import express from 'express';
import { dataSource } from './infraestructure/database/dataSource';
import { UnitOfWorkImpl } from './infraestructure/database/UnitOfWorkImpl';
import { config } from './infraestructure/config/env';
import { logger } from './infraestructure/utilities';
import { errorHandlerMiddleware } from './infraestructure/api/middlewares';
import { createRouter } from './infraestructure/api/routes';
import { sseHub } from './infraestructure/api/sse/SseHub';
import { LockExpirationJob } from './infraestructure/cron/lockExpirationJob';
import { EventBus } from './infraestructure/mq/EventBus';
import { FakePaymentGateway } from './infraestructure/serviceAdapters/FakePaymentGateway';
import {
  AirportRepositoryImpl,
  FlightRepositoryImpl,
  SeatRepositoryImpl,
  ReservationRepositoryImpl,
  PaymentRepositoryImpl,
  IdempotencyRepositoryImpl
} from './infraestructure/outputAdapters';

async function main() {
  try {
    // Initialize database
    await dataSource.initialize();
    await dataSource.runMigrations();
    logger.info('Database initialized and migrations run');

    // Initialize repositories and services
    const unitOfWork = new UnitOfWorkImpl(dataSource);
    const eventBus = new EventBus();
    const paymentGateway = new FakePaymentGateway();

    const airportRepository = new AirportRepositoryImpl();
    const flightRepository = new FlightRepositoryImpl();
    const seatRepository = new SeatRepositoryImpl();
    const reservationRepository = new ReservationRepositoryImpl();
    const paymentRepository = new PaymentRepositoryImpl();
    const idempotencyRepository = new IdempotencyRepositoryImpl();

    // Subscribe to events
    eventBus.subscribe('seat.locked', (event) => sseHub.broadcast(event));
    eventBus.subscribe('seat.released', (event) => sseHub.broadcast(event));
    eventBus.subscribe('seat.reserved', (event) => sseHub.broadcast(event));
    eventBus.subscribe('flight.updated', (event) => sseHub.broadcast(event));

    // Initialize lock expiration job
    const expirationJob = new LockExpirationJob(
      dataSource,
      logger,
      (events) => eventBus.publishBatch(events)
    );

    // Initialize Express app
    const app = express();

    // Middleware
    app.use(express.json());

    // API routes
    app.use('/api', createRouter());

    // SSE Hub and Expiration Job
    sseHub.start();
    expirationJob.start();

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
      expirationJob.stop();
      server.close(async () => {
        await dataSource.destroy();
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error: String(error) });
    process.exit(1);
  }
}

main();
