import { LockSeatInputPort } from '../inputPorts';
import { SeatRepository, FlightRepository, UnitOfWork, EventPublisher } from '../../infraestructure/outputPorts';
import { Logger } from '../../infraestructure/outputPorts';
import { AppError } from '../errorHandler';
import { ErrorCode, SeatLockedEvent, SeatReleasedEvent } from '@flight-reservations/shared';
import { SeatMapper } from '../mappers';
import { isDeadlock, isUniqueViolation } from '../../infraestructure/utilities';

export class LockSeatUseCase implements LockSeatInputPort {
  constructor(
    private seatRepository: SeatRepository,
    private flightRepository: FlightRepository,
    private unitOfWork: UnitOfWork,
    private eventPublisher: EventPublisher,
    private logger: Logger
  ) {}

  async execute(flightId: string, seat: string, clientId: string, ttlSeconds: number, retry: number = 0): Promise<void> {
    try {
      const now = new Date();
      const events: (SeatLockedEvent | SeatReleasedEvent)[] = [];

      await this.unitOfWork.run(async (tx) => {
        // Lock the seat
        const lockedSeat = await this.seatRepository.lock(tx, flightId, seat, clientId, ttlSeconds);

        if (lockedSeat) {
          // Success: locked the new seat
          events.push({
            type: 'seat.locked',
            flightId,
            seat,
            version: lockedSeat.version,
            lockedUntil: lockedSeat.lockedUntil!.toISOString()
          });

          this.logger.debug('Seat locked', { flightId, seat, clientId });
          return;
        }

        // Failed: diagnose why
        // In a full implementation, call SeatRepository.diagnose() and throw appropriate errors
        throw AppError.conflict(ErrorCode.SEAT_LOCKED, 'Asiento no disponible');
      });

      // Publish events after commit
      await this.eventPublisher.publishBatch(events);
    } catch (error) {
      if (isDeadlock(error) || isUniqueViolation(error)) {
        if (retry < 1) {
          this.logger.warn('Lock conflict, retrying', { flightId, seat, retry });
          return this.execute(flightId, seat, clientId, ttlSeconds, retry + 1);
        }
      }

      if (error instanceof AppError) throw error;
      this.logger.error('Failed to lock seat', { error: String(error), flightId, seat });
      throw AppError.internal('Error al bloquear asiento');
    }
  }
}
