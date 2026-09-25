import express, { Express } from 'express';
import { Container } from './infraestructure/config/container';
import { createRouter } from './infraestructure/api/routes';
import { errorHandlerMiddleware, notFoundMiddleware } from './infraestructure/api/middlewares';

// No compression middleware: it would buffer the SSE stream
export function createApp(container: Container): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', createRouter(container.controllers));
  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
