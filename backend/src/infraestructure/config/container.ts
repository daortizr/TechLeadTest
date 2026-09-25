import { DataSource } from 'typeorm';
import { FlightEvent } from '@flight-reservations/shared';
import { config } from './env';
import { UnitOfWorkImpl } from '../database/UnitOfWorkImpl';
import {
  AirportRepositoryImpl,
  FlightRepositoryImpl,
  SeatRepositoryImpl,
  ReservationRepositoryImpl,
  PaymentRepositoryImpl,
  IdempotencyRepositoryImpl
} from '../outputAdapters';
import { FakePaymentGateway } from '../serviceAdapters/FakePaymentGateway';
import { EventBus } from '../mq/EventBus';
import { SseHub } from '../api/sse/SseHub';
import {
  AdminController,
  AirportController,
  EventsController,
  FlightController,
  HealthController,
  ReservationController,
  SeatController
} from '../api/controllers';
import { Controllers } from '../api/routes';
import { logger } from '../utilities';
import { ExpireLocksInputPort } from '../../application/inputPorts';
import {
  ChangeFlightStatusUseCase,
  CreateReservationUseCase,
  ExpireLocksUseCase,
  GetLockStagesUseCase,
  GetReservationUseCase,
  GetSeatSnapshotUseCase,
  ListAirportsUseCase,
  LockSeatUseCase,
  SearchFlightsUseCase,
  StartCheckoutUseCase,
  UnlockSeatUseCase
} from '../../application/useCases';

export interface Container {
  controllers: Controllers;
  expireLocks: ExpireLocksInputPort;
  sseHub: SseHub;
}

// The only place that knows every concrete class
export function buildContainer(dataSource: DataSource): Container {
  const settings = {
    lockTtlSeconds: config.lockTtlSeconds,
    checkoutTtlSeconds: config.checkoutTtlSeconds,
    paymentMarginSeconds: config.paymentMarginSeconds
  };

  const unitOfWork = new UnitOfWorkImpl(dataSource);
  const airports = new AirportRepositoryImpl();
  const flights = new FlightRepositoryImpl();
  const seats = new SeatRepositoryImpl();
  const reservations = new ReservationRepositoryImpl();
  const payments = new PaymentRepositoryImpl();
  const idempotency = new IdempotencyRepositoryImpl();
  const paymentGateway = new FakePaymentGateway();

  const sseHub = new SseHub(config.heartbeatIntervalMs);
  const eventBus = new EventBus();
  const broadcast = (event: FlightEvent): void => sseHub.broadcast(event);
  eventBus.subscribe('seat.locked', broadcast);
  eventBus.subscribe('seat.released', broadcast);
  eventBus.subscribe('seat.reserved', broadcast);
  eventBus.subscribe('flight.updated', broadcast);

  const listAirports = new ListAirportsUseCase(airports, unitOfWork, logger);
  const searchFlights = new SearchFlightsUseCase(flights, airports, unitOfWork, logger);
  const getSeatSnapshot = new GetSeatSnapshotUseCase(flights, seats, unitOfWork, settings, logger);
  const lockSeat = new LockSeatUseCase(seats, unitOfWork, eventBus, settings, logger);
  const unlockSeat = new UnlockSeatUseCase(seats, unitOfWork, eventBus, logger);
  const startCheckout = new StartCheckoutUseCase(seats, unitOfWork, eventBus, settings, logger);
  const createReservation = new CreateReservationUseCase(
    seats,
    flights,
    reservations,
    payments,
    idempotency,
    unitOfWork,
    eventBus,
    paymentGateway,
    settings,
    logger
  );
  const getReservation = new GetReservationUseCase(reservations, flights, unitOfWork);
  const changeFlightStatus = new ChangeFlightStatusUseCase(flights, unitOfWork, eventBus, logger);
  const getLockStages = new GetLockStagesUseCase(seats, flights, unitOfWork);
  const expireLocks = new ExpireLocksUseCase(seats, unitOfWork, eventBus, logger);

  return {
    controllers: {
      health: new HealthController(dataSource),
      airports: new AirportController(listAirports),
      flights: new FlightController(searchFlights, getSeatSnapshot),
      seats: new SeatController(lockSeat, unlockSeat, startCheckout),
      reservations: new ReservationController(createReservation, getReservation),
      events: new EventsController(sseHub),
      admin: new AdminController(changeFlightStatus, getLockStages)
    },
    expireLocks,
    sseHub
  };
}
