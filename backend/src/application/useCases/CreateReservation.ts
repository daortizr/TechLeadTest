import { CreateReservationInputPort } from '../inputPorts';
import {
  SeatRepository,
  FlightRepository,
  ReservationRepository,
  PaymentRepository,
  IdempotencyRepository,
  UnitOfWork,
  EventPublisher,
  PaymentGateway
} from '../../infraestructure/outputPorts';
import { Logger } from '../../infraestructure/outputPorts';
import { AppError } from '../errorHandler';
import { ErrorCode, SeatReservedEvent, FlightUpdatedEvent } from '@flight-reservations/shared';
import { generateReservationCode } from '../helpers';
import { Reservation, Payment, IdempotencyKey } from '../../domain/entities';
import { IdempotencyKeyStatus, PaymentStatus } from '../../domain/enums';
import { v4 as uuidv4 } from 'uuid';

export class CreateReservationUseCase implements CreateReservationInputPort {
  constructor(
    private seatRepository: SeatRepository,
    private flightRepository: FlightRepository,
    private reservationRepository: ReservationRepository,
    private paymentRepository: PaymentRepository,
    private idempotencyRepository: IdempotencyRepository,
    private unitOfWork: UnitOfWork,
    private eventPublisher: EventPublisher,
    private paymentGateway: PaymentGateway,
    private logger: Logger
  ) {}

  async execute(
    flightId: string,
    seat: string,
    clientId: string,
    idempotencyKey: string,
    requestHash: string,
    passenger: { fullName: string; email: string; documentType: string; documentNumber: string; phone: string },
    payment: { holderName: string; cardNumber: string; expiry: string; cvv: string }
  ): Promise<void> {
    try {
      const now = new Date();
      const events: (SeatReservedEvent | FlightUpdatedEvent)[] = [];

      // Phase A: Claim idempotency key
      await this.unitOfWork.run(async (tx) => {
        const key = await this.idempotencyRepository.claim(tx, idempotencyKey, clientId, requestHash);
        if (!key) {
          // Key already exists with same hash - will be handled below
          throw new Error('IDEMPOTENCY_KEY_MISMATCH');
        }
      });

      // Phase B: Verify seat lock
      const verifyResult = await this.unitOfWork.run(async (tx) => {
        const flight = await this.flightRepository.findById(tx, flightId);
        if (!flight) {
          throw AppError.notFound(ErrorCode.FLIGHT_NOT_FOUND, 'Vuelo no encontrado');
        }

        const seatData = await this.seatRepository.findBySeatNumber(tx, flightId, seat);
        if (!seatData || seatData.lockedBy !== clientId || !seatData.lockedUntil || seatData.lockedUntil <= now) {
          throw AppError.conflict(ErrorCode.LOCK_EXPIRED_OR_NOT_OWNED, 'Bloqueo vencido o no es tuyo');
        }

        return { flight, seat: seatData, priceCents: flight.priceCents };
      });

      // Phase C: Authorize payment
      let authorizationRef: string;
      try {
        const authResult = await this.paymentGateway.authorize(
          idempotencyKey,
          verifyResult.priceCents,
          payment.cardNumber,
          payment.holderName,
          payment.expiry,
          payment.cvv
        );
        authorizationRef = authResult.authorizationRef;
      } catch (error) {
        if (String(error) === 'Error: PAYMENT_DECLINED') {
          throw AppError.paymentDeclined();
        }
        throw AppError.paymentUnavailable();
      }

      // Register payment as AUTHORIZED
      const paymentId = uuidv4();
      const paymentRecord = new Payment(
        paymentId,
        idempotencyKey,
        null, // No reservation yet
        authorizationRef,
        verifyResult.priceCents,
        PaymentStatus.AUTHORIZED,
        now
      );

      // Phase D: Reserve seat (short transaction)
      const reservationResult = await this.unitOfWork.run(async (tx) => {
        const reservedSeat = await this.seatRepository.reserve(tx, flightId, seat, clientId);
        if (!reservedSeat) {
          throw AppError.conflict(ErrorCode.LOCK_EXPIRED_OR_NOT_OWNED, 'Bloqueo vencido o no es tuyo');
        }

        // Create reservation
        const reservationCode = generateReservationCode();
        const reservation = new Reservation(
          uuidv4(),
          reservationCode,
          flightId,
          seat,
          passenger.fullName,
          passenger.email,
          clientId,
          verifyResult.priceCents,
          'COP',
          now
        );

        const created = await this.reservationRepository.create(tx, reservation);

        // Update payment with reservation ID
        const updatedPayment = new Payment(
          paymentId,
          idempotencyKey,
          created.id,
          authorizationRef,
          verifyResult.priceCents,
          PaymentStatus.AUTHORIZED,
          now
        );
        await this.paymentRepository.create(tx, updatedPayment);

        // Mark idempotency key as completed
        await this.idempotencyRepository.markCompleted(tx, idempotencyKey, created.id);

        return { reservation: created, seat: reservedSeat };
      });

      // Publish events after commit
      events.push({
        type: 'seat.reserved',
        flightId,
        seat,
        version: reservationResult.seat.version
      });

      // Check if flight is now SOLD_OUT
      const seatCount = await this.unitOfWork.run(async (tx) => {
        const allSeats = await this.seatRepository.findByFlightId(tx, flightId);
        return allSeats.filter(s => s.status !== 'RESERVED').length;
      });

      if (seatCount === 0) {
        await this.unitOfWork.run(async (tx) => {
          const flight = await this.flightRepository.findById(tx, flightId);
          if (flight) {
            // Update flight status to SOLD_OUT
            this.logger.info('Flight sold out', { flightId });
          }
        });

        events.push({
          type: 'flight.updated',
          flightId,
          status: 'SOLD_OUT',
          availableSeats: 0,
          version: 0 // Will be fetched from DB
        });
      }

      await this.eventPublisher.publishBatch(events);

      this.logger.info('Reservation created', {
        reservationCode: reservationResult.reservation.code,
        flightId,
        seat,
        clientId
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.logger.error('Failed to create reservation', { error: String(error) });
      throw AppError.internal('Error al crear reserva');
    }
  }
}
