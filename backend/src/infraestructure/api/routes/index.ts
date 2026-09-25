import { Router } from 'express';
import {
  AdminController,
  AirportController,
  EventsController,
  FlightController,
  HealthController,
  ReservationController,
  SeatController
} from '../controllers';
import { adminKeyMiddleware, clientIdMiddleware, idempotencyKeyMiddleware } from '../middlewares';

export interface Controllers {
  health: HealthController;
  airports: AirportController;
  flights: FlightController;
  seats: SeatController;
  reservations: ReservationController;
  events: EventsController;
  admin: AdminController;
}

// Mounted under /api. Business rules live in the use cases: routes only wire HTTP to controllers.
export function createRouter(controllers: Controllers): Router {
  const router = Router();
  const requireClient = clientIdMiddleware(true);
  const optionalClient = clientIdMiddleware(false);

  // Public
  router.get('/health', controllers.health.check);
  router.get('/airports', controllers.airports.list);
  router.get('/flights', controllers.flights.search);
  router.get('/flights/:id/seats', optionalClient, controllers.flights.seatSnapshot);
  router.post('/flights/:id/seats/:seat/lock', requireClient, controllers.seats.lock);
  router.delete('/flights/:id/seats/:seat/lock', requireClient, controllers.seats.unlock);
  router.post('/flights/:id/seats/:seat/checkout', requireClient, controllers.seats.checkout);
  router.post('/reservations', requireClient, idempotencyKeyMiddleware, controllers.reservations.create);
  router.get('/reservations/:code', controllers.reservations.get);
  router.get('/events', controllers.events.stream);

  // Administrative: a single middleware guards everything under /admin
  const adminRouter = Router();
  adminRouter.use(adminKeyMiddleware);
  adminRouter.post('/flights/:id/cancel', controllers.admin.cancelFlight);
  adminRouter.get('/flights/:id/lock-stages', controllers.admin.lockStages);
  router.use('/admin', adminRouter);

  return router;
}
