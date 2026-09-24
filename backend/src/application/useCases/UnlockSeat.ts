import { UnlockSeatInputPort } from '../inputPorts';
import { SeatRepository, UnitOfWork, EventPublisher } from '../../infraestructure/outputPorts';
import { Logger } from '../../infraestructure/outputPorts';
import { AppError } from '../errorHandler';
import { ErrorCode, SeatReleasedEvent } from '@flight-reservations/shared';

export class UnlockSeatUseCase implements UnlockSeatInputPort {
  constructor(
    private seatRepository: SeatRepository,
    private unitOfWork: UnitOfWork,
    private eventPublisher: EventPublisher,
    private logger: Logger
  ) {}

  async execute(flightId: string, seat: string, clientId: string): Promise<void> {
    try {
      const events: SeatReleasedEvent[] = [];

      await this.unitOfWork.run(async (tx) => {
        const unlockedSeat = await this.seatRepository.unlock(tx, flightId, seat, clientId);

        if (unlockedSeat) {
          events.push({
            type: 'seat.released',
            flightId,
            seat,
            version: unlockedSeat.version,
            reason: 'RELEASED'
          });

          this.logger.debug('Seat unlocked', { flightId, seat, clientId });
          return;
        }

        // Diagnose: not locked by this client, or already free
        throw AppError.forbidden(ErrorCode.LOCK_NOT_OWNED, 'El asiento no está bloqueado por ti');
      });

      // Publish events after commit
      await this.eventPublisher.publishBatch(events);
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.logger.error('Failed to unlock seat', { error: String(error), flightId, seat });
      throw AppError.internal('Error al liberar asiento');
    }
  }
}
