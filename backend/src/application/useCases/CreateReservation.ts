import { ErrorCode, FlightEvent, ReservationDTO } from '@flight-reservations/shared';
import { CreateReservationInputPort, CreateReservationResult } from '../inputPorts';
import { CreateReservationCommand, SeatLockSettings } from '../dtos';
import {
  SeatRepository,
  FlightRepository,
  ReservationRepository,
  PaymentRepository,
  IdempotencyRepository,
  UnitOfWork,
  TransactionContext,
  EventPublisher,
  PaymentGateway,
  PaymentDeclinedError,
  TransientDatabaseError,
  Logger
} from '../../infraestructure/outputPorts';
import { Reservation } from '../../domain/entities';
import { PayableLock } from '../../domain/interfaces';
import { FlightStatus } from '../../domain/enums';
import { AppError } from '../errorHandler';
import { diagnoseSeat, generateReservationCode, hashRequest, publishAfterCommit } from '../helpers';
import { FlightMapper, ReservationMapper } from '../mappers';
import { randomUUID } from 'crypto';

const MAX_CODE_ATTEMPTS = 5;
const MAX_T2_ATTEMPTS = 2;

interface Authorization {
  ref: string;
}

interface Purchase {
  reservation: ReservationDTO;
  seatVersion: number;
  soldOutVersion: number | null;
}

type Outcome = { kind: 'COMMITTED'; reservationId: string } | { kind: 'NOT_COMMITTED' } | { kind: 'UNKNOWN' };

// Purchase in five phases (7.3). Card data is only passed to the gateway: it is never
// stored and never logged.
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
    private settings: SeatLockSettings,
    private logger: Logger
  ) {}

  async execute(command: CreateReservationCommand): Promise<CreateReservationResult> {
    const { idempotencyKey, clientId, flightId, seat, passenger } = command;
    const requestHash = hashRequest({
      flightId,
      seat,
      fullName: passenger.fullName,
      email: passenger.email,
      documentType: passenger.documentType,
      documentNumber: passenger.documentNumber,
      phone: passenger.phone
    });

    // Phase A: claim the idempotency key
    const claim = await this.unitOfWork.run((tx) =>
      this.idempotencyRepository.claim(tx, idempotencyKey, clientId, requestHash)
    );
    switch (claim.outcome) {
      case 'MISMATCH':
        throw AppError.unprocessableEntity(
          ErrorCode.IDEMPOTENCY_KEY_MISMATCH,
          'La clave de idempotencia ya se usó con otro contenido'
        );
      case 'IN_PROGRESS':
        throw AppError.conflict(ErrorCode.REQUEST_IN_PROGRESS, 'La solicitud sigue en curso');
      case 'COMPLETED':
        return { reservation: await this.loadTicket(claim.reservationId), created: false };
      case 'CLAIMED':
        break;
    }

    // Recovery after a crash: an authorization may already exist for this key
    let authorization = await this.findPendingAuthorization(idempotencyKey);

    try {
      // Phase B: the seat must be mine with time left to pay, on a bookable flight
      const payable = await this.verifyPayable(command);

      // Phase C: charge (idempotent by key) and record the authorization before T2
      if (!authorization) {
        authorization = await this.authorize(command, payable.priceCents);
      }

      // Phase D and E
      const purchase = await this.reserve(command, payable);
      await this.publishPurchase(flightId, seat, purchase);
      this.logger.info('Reservation created', { code: purchase.reservation.code, flightId, seat });
      return { reservation: purchase.reservation, created: true };
    } catch (error) {
      if (authorization) {
        const outcome = await this.confirmOutcome(idempotencyKey);
        if (outcome.kind === 'COMMITTED') {
          // The reservation exists (e.g. the connection dropped while committing)
          this.logger.warn('Purchase committed despite an error', { idempotencyKey });
          return { reservation: await this.loadTicket(outcome.reservationId), created: true };
        }
        if (outcome.kind === 'UNKNOWN') {
          // Not voided blindly: the authorization stays recorded for reconciliation and recovery
          this.logger.error('Purchase outcome unknown', { idempotencyKey });
          throw AppError.internal();
        }
        await this.compensate(idempotencyKey, authorization);
      }
      await this.markKeyFailed(idempotencyKey);
      throw error;
    }
  }

  private async findPendingAuthorization(idempotencyKey: string): Promise<Authorization | null> {
    const pending = await this.unitOfWork.run((tx) =>
      this.paymentRepository.findAuthorizedWithoutReservation(tx, idempotencyKey)
    );
    return pending?.authorizationRef ? { ref: pending.authorizationRef } : null;
  }

  private async verifyPayable(command: CreateReservationCommand): Promise<PayableLock> {
    const { flightId, seat, clientId } = command;
    const payable = await this.unitOfWork.run((tx) =>
      this.seatRepository.verifyPayable(tx, flightId, seat, clientId, this.settings.paymentMarginSeconds)
    );
    if (payable) return payable;

    const diagnosis = await this.unitOfWork.run((tx) => this.seatRepository.diagnose(tx, flightId, seat, clientId));
    const outcome = diagnoseSeat(diagnosis, 'PURCHASE');
    if (outcome.kind === 'SEAT_NOT_FOUND') {
      throw AppError.notFound(ErrorCode.SEAT_NOT_FOUND, 'Asiento no encontrado');
    }
    if (outcome.kind === 'FLIGHT_NOT_BOOKABLE') {
      throw AppError.conflict(ErrorCode.FLIGHT_NOT_BOOKABLE, 'El vuelo no está disponible para la venta');
    }
    throw AppError.conflict(ErrorCode.LOCK_EXPIRED_OR_NOT_OWNED, 'Bloqueo vencido o no es tuyo');
  }

  private async authorize(command: CreateReservationCommand, amountCents: number): Promise<Authorization> {
    const { idempotencyKey } = command;

    let authorizationRef: string;
    try {
      authorizationRef = await this.authorizeWithRetry(command, amountCents);
    } catch (error) {
      if (error instanceof PaymentDeclinedError) {
        await this.recordDeclined(idempotencyKey, amountCents);
        throw AppError.paymentDeclined();
      }
      this.logger.error('Payment gateway unavailable', { idempotencyKey });
      throw AppError.paymentUnavailable();
    }

    try {
      await this.unitOfWork.run((tx) =>
        this.paymentRepository.insertAuthorized(tx, idempotencyKey, authorizationRef, amountCents)
      );
    } catch (error) {
      // The authorization could not be recorded, so nothing else would ever void it
      this.logger.error('Could not record the authorization, voiding it', { idempotencyKey });
      await this.voidQuietly(authorizationRef, idempotencyKey);
      throw error;
    }

    return { ref: authorizationRef };
  }

  // The gateway is idempotent by key, so repeating an authorize that got no answer is safe
  private async authorizeWithRetry(command: CreateReservationCommand, amountCents: number): Promise<string> {
    const attempt = () => this.paymentGateway.authorize(command.idempotencyKey, amountCents, command.payment);
    try {
      return (await attempt()).authorizationRef;
    } catch (error) {
      if (error instanceof PaymentDeclinedError) throw error;
      this.logger.warn('Payment gateway failed, retrying once', { idempotencyKey: command.idempotencyKey });
      return (await attempt()).authorizationRef;
    }
  }

  private async recordDeclined(idempotencyKey: string, amountCents: number): Promise<void> {
    try {
      await this.unitOfWork.run((tx) => this.paymentRepository.insertDeclined(tx, idempotencyKey, amountCents));
    } catch (error) {
      this.logger.error('Could not record the declined payment', { idempotencyKey, error: String(error) });
    }
  }

  // Phase D: the only multi-statement transaction. Retried once on deadlock.
  private async reserve(command: CreateReservationCommand, payable: PayableLock): Promise<Purchase> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.unitOfWork.run((tx) => this.runReservationTransaction(tx, command, payable));
      } catch (error) {
        if (error instanceof TransientDatabaseError && attempt < MAX_T2_ATTEMPTS) {
          this.logger.warn('Reservation transaction conflict, retrying', { flightId: command.flightId });
          continue;
        }
        throw error;
      }
    }
  }

  private async runReservationTransaction(
    tx: TransactionContext,
    command: CreateReservationCommand,
    payable: PayableLock
  ): Promise<Purchase> {
    const { flightId, seat, clientId, idempotencyKey, passenger } = command;

    // 1. Serialize the reservations of this flight
    if (!(await this.flightRepository.lockForReservation(tx, flightId))) {
      throw AppError.conflict(ErrorCode.FLIGHT_NOT_BOOKABLE, 'El vuelo no está disponible para la venta');
    }

    // 2. Reserve the seat
    const seatVersion = await this.seatRepository.reserve(tx, flightId, seat, clientId);
    if (seatVersion === null) {
      throw AppError.conflict(ErrorCode.LOCK_EXPIRED_OR_NOT_OWNED, 'Bloqueo vencido o no es tuyo');
    }

    // 3. Create the reservation, retrying the code on collision
    let reservation: Reservation | null = null;
    for (let i = 0; i < MAX_CODE_ATTEMPTS && !reservation; i++) {
      reservation = await this.reservationRepository.create(
        tx,
        new Reservation(
          randomUUID(),
          generateReservationCode(),
          flightId,
          seat,
          passenger.fullName,
          passenger.email,
          passenger.documentType,
          passenger.documentNumber,
          passenger.phone,
          clientId,
          payable.priceCents,
          payable.currency,
          new Date()
        )
      );
    }
    if (!reservation) {
      throw AppError.internal('No se pudo generar un código de reserva único');
    }

    // 4 and 5. Link the payment and complete the key: exactly one row each
    const linked = await this.paymentRepository.linkReservation(tx, idempotencyKey, reservation.id);
    const completed = await this.idempotencyRepository.complete(tx, idempotencyKey, reservation.id);
    if (linked !== 1 || completed !== 1) {
      this.logger.error('Purchase invariant broken', { idempotencyKey, linked, completed });
      throw AppError.internal();
    }

    // 6. SOLD_OUT when it was the last seat
    const soldOutVersion = await this.flightRepository.markSoldOutIfFull(tx, flightId);

    const flight = await this.flightRepository.findById(tx, flightId);
    if (!flight) {
      throw AppError.internal('Vuelo de la reserva no encontrado');
    }

    return {
      reservation: ReservationMapper.toDTO(reservation, FlightMapper.toDTO(flight)),
      seatVersion,
      soldOutVersion
    };
  }

  // Phase E: events go out only after the commit
  private async publishPurchase(flightId: string, seat: string, purchase: Purchase): Promise<void> {
    const events: FlightEvent[] = [{ type: 'seat.reserved', flightId, seat, version: purchase.seatVersion }];
    if (purchase.soldOutVersion !== null) {
      events.push({
        type: 'flight.updated',
        flightId,
        status: FlightStatus.SOLD_OUT,
        availableSeats: 0,
        version: purchase.soldOutVersion
      });
    }
    await publishAfterCommit(this.eventPublisher, events, this.logger);
  }

  // T2 completes the key inside its transaction, so a COMPLETED key proves the commit
  private async confirmOutcome(idempotencyKey: string): Promise<Outcome> {
    try {
      const reservationId = await this.unitOfWork.run((tx) =>
        this.idempotencyRepository.findCompletedReservationId(tx, idempotencyKey)
      );
      return reservationId ? { kind: 'COMMITTED', reservationId } : { kind: 'NOT_COMMITTED' };
    } catch (error) {
      this.logger.error('Could not verify the purchase outcome', { idempotencyKey, error: String(error) });
      return { kind: 'UNKNOWN' };
    }
  }

  private async compensate(idempotencyKey: string, authorization: Authorization): Promise<void> {
    try {
      await this.paymentGateway.void(authorization.ref);
      await this.unitOfWork.run((tx) => this.paymentRepository.markVoided(tx, idempotencyKey));
    } catch (error) {
      this.logger.error('Could not void the authorization', { idempotencyKey, error: String(error) });
      await this.markVoidFailed(idempotencyKey);
    }
  }

  private async voidQuietly(authorizationRef: string, idempotencyKey: string): Promise<void> {
    try {
      await this.paymentGateway.void(authorizationRef);
    } catch (error) {
      this.logger.error('Could not void an unrecorded authorization', { idempotencyKey, error: String(error) });
    }
  }

  private async markVoidFailed(idempotencyKey: string): Promise<void> {
    try {
      await this.unitOfWork.run((tx) => this.paymentRepository.markVoidFailed(tx, idempotencyKey));
    } catch (error) {
      this.logger.error('Could not mark the payment as VOID_FAILED', { idempotencyKey, error: String(error) });
    }
  }

  private async markKeyFailed(idempotencyKey: string): Promise<void> {
    try {
      await this.unitOfWork.run((tx) => this.idempotencyRepository.fail(tx, idempotencyKey));
    } catch (error) {
      this.logger.error('Could not mark the idempotency key as FAILED', { idempotencyKey, error: String(error) });
    }
  }

  private async loadTicket(reservationId: string): Promise<ReservationDTO> {
    return this.unitOfWork.run(async (tx) => {
      const reservation = await this.reservationRepository.findById(tx, reservationId);
      if (!reservation) {
        throw AppError.internal('Reserva no encontrada');
      }
      const flight = await this.flightRepository.findById(tx, reservation.flightId);
      if (!flight) {
        throw AppError.internal('Vuelo de la reserva no encontrado');
      }
      return ReservationMapper.toDTO(reservation, FlightMapper.toDTO(flight));
    });
  }
}
