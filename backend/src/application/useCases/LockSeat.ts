import { ErrorCode, FlightEvent, LockDTO } from '@flight-reservations/shared';
import { LockSeatInputPort } from '../inputPorts';
import { SeatLockSettings } from '../dtos';
import {
  SeatRepository,
  UnitOfWork,
  EventPublisher,
  Logger,
  TransientDatabaseError,
  UniqueViolationError
} from '../../infraestructure/outputPorts';
import { AppError } from '../errorHandler';
import { diagnoseSeat, publishAfterCommit } from '../helpers';

// Raised inside the transaction when the acquire UPDATE affected no rows, so the
// rollback restores the client's previous seat before the diagnosis runs.
class SeatNotAcquired extends Error {}

const MAX_RETRIES = 1;

export class LockSeatUseCase implements LockSeatInputPort {
  constructor(
    private seatRepository: SeatRepository,
    private unitOfWork: UnitOfWork,
    private eventPublisher: EventPublisher,
    private settings: SeatLockSettings,
    private logger: Logger
  ) {}

  async execute(flightId: string, seat: string, clientId: string): Promise<LockDTO> {
    return this.attempt(flightId, seat, clientId, 0);
  }

  private async attempt(flightId: string, seat: string, clientId: string, retry: number): Promise<LockDTO> {
    const events: FlightEvent[] = [];

    try {
      const acquired = await this.unitOfWork.run(async (tx) => {
        // Release the previous seat first: the partial unique index allows one lock per client and flight
        const released = await this.seatRepository.releaseOtherLocks(tx, flightId, seat, clientId);
        const locked = await this.seatRepository.acquire(tx, flightId, seat, clientId, this.settings.lockTtlSeconds);
        if (!locked) throw new SeatNotAcquired();

        for (const previous of released) {
          events.push({
            type: 'seat.released',
            flightId,
            seat: previous.seatNumber,
            version: previous.version,
            reason: 'RELEASED'
          });
        }
        events.push({
          type: 'seat.locked',
          flightId,
          seat,
          version: locked.version,
          lockedUntil: locked.lockedUntil.toISOString()
        });
        return locked;
      });

      await publishAfterCommit(this.eventPublisher, events, this.logger);
      this.logger.debug('Seat locked', { flightId, seat });
      return { seat, lockedUntil: acquired.lockedUntil.toISOString(), version: acquired.version };
    } catch (error) {
      if (error instanceof SeatNotAcquired) {
        return this.explainFailure(flightId, seat, clientId, retry);
      }
      if (error instanceof TransientDatabaseError || error instanceof UniqueViolationError) {
        if (retry < MAX_RETRIES) {
          this.logger.warn('Lock conflict, retrying', { flightId, seat });
          return this.attempt(flightId, seat, clientId, retry + 1);
        }
        if (error instanceof UniqueViolationError) {
          throw AppError.conflict(ErrorCode.SEAT_LOCKED, 'Asiento no disponible');
        }
      }
      throw error;
    }
  }

  // The diagnosis runs outside the rolled-back transaction and only explains the result
  private async explainFailure(flightId: string, seat: string, clientId: string, retry: number): Promise<LockDTO> {
    const diagnosis = await this.unitOfWork.run((tx) => this.seatRepository.diagnose(tx, flightId, seat, clientId));
    const outcome = diagnoseSeat(diagnosis, 'LOCK');

    switch (outcome.kind) {
      case 'SEAT_NOT_FOUND':
        throw AppError.notFound(ErrorCode.SEAT_NOT_FOUND, 'Asiento no encontrado');
      case 'FLIGHT_NOT_BOOKABLE':
        throw AppError.conflict(ErrorCode.FLIGHT_NOT_BOOKABLE, 'El vuelo no está disponible para la venta');
      case 'SEAT_RESERVED':
        throw AppError.conflict(ErrorCode.SEAT_RESERVED, 'Asiento ya vendido');
      case 'ALREADY_MINE':
        return { seat, lockedUntil: outcome.lockedUntil.toISOString(), version: diagnosis?.seatVersion ?? 0 };
      case 'SEAT_LOCKED':
        throw AppError.conflict(
          ErrorCode.SEAT_LOCKED,
          'Asiento bloqueado por otro usuario',
          outcome.lockedUntil ? { lockedUntil: outcome.lockedUntil.toISOString() } : undefined
        );
      default:
        // The state changed between both statements: repeat once, then give up without details
        if (retry < MAX_RETRIES) {
          return this.attempt(flightId, seat, clientId, retry + 1);
        }
        throw AppError.conflict(ErrorCode.SEAT_LOCKED, 'Asiento no disponible');
    }
  }
}
