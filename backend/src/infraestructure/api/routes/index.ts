import { Router, Request, Response } from 'express';
import { adminKeyMiddleware } from '../middlewares';

export function createRouter(): Router {
  const router = Router();

  // Public endpoints
  router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  router.get('/airports', async (req: Request, res: Response) => {
    // Controller.listAirports()
    res.json([]);
  });

  router.get('/flights', async (req: Request, res: Response) => {
    // Validate and extract query: origin, destination, date
    // Controller.searchFlights(origin, destination, date)
    res.json([]);
  });

  router.get('/flights/:id/seats', async (req: Request, res: Response) => {
    // Controller.getSeatSnapshot(id, clientId from header or undefined)
    res.json({});
  });

  router.post('/flights/:id/seats/:seat/lock', async (req: Request, res: Response) => {
    // Validate X-Client-Id header
    // Controller.lockSeat(id, seat, clientId)
    res.json({});
  });

  router.delete('/flights/:id/seats/:seat/lock', async (req: Request, res: Response) => {
    // Validate X-Client-Id header
    // Controller.unlockSeat(id, seat, clientId)
    res.status(204).send();
  });

  router.post('/flights/:id/seats/:seat/checkout', async (req: Request, res: Response) => {
    // Validate X-Client-Id header
    // Controller.startCheckout(id, seat, clientId)
    res.json({});
  });

  router.post('/reservations', async (req: Request, res: Response) => {
    // Validate X-Client-Id and Idempotency-Key headers
    // Validate request body with createReservationSchema
    // Controller.createReservation(...)
    res.status(201).json({});
  });

  router.get('/reservations/:code', async (req: Request, res: Response) => {
    // Controller.getReservation(code)
    res.json({});
  });

  router.get('/events', async (req: Request, res: Response) => {
    // Set up SSE connection
    // res.setHeader('Content-Type', 'text/event-stream');
    // res.setHeader('Cache-Control', 'no-cache');
    // res.setHeader('Connection', 'keep-alive');
    // res.setHeader('X-Accel-Buffering', 'no');
    // res.flushHeaders();
    // SSE handler implementation here
  });

  // Administrative endpoints (require X-Admin-Key)
  const adminRouter = Router();
  adminRouter.use(adminKeyMiddleware);

  adminRouter.post('/flights/:id/cancel', async (req: Request, res: Response) => {
    // Controller.changeFlightStatus(id, 'cancel')
    res.json({});
  });

  adminRouter.get('/flights/:id/lock-stages', async (req: Request, res: Response) => {
    // Controller.getLockStages(id)
    res.json({ flightId: '', selecting: 0, checkout: 0 });
  });

  router.use('/admin', adminRouter);

  return router;
}
