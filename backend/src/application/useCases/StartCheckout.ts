import { StartCheckoutInputPort } from '../inputPorts';
import { SeatRepository, UnitOfWork, EventPublisher } from '../../infraestructure/outputPorts';
import { Logger } from '../../infraestructure/outputPorts';
import { AppError } from '../errorHandler';
import { ErrorCode, SeatLockedEvent } from '@flight-reservations/shared';

export class StartCheckoutUseCase implements StartCheckoutInputPort {
  constructor(
    private seatRepository: SeatRepository,
    private unitOfWork: UnitOfWork,
    private eventPublisher: EventPublisher,
    private logger: Logger
  ) {}

  async execute(flightId: string, seat: string, clientId: string, ttlSeconds: number): Promise<void> {
    try {
      const events: SeatLockedEvent[] = [];

      await this.unitOfWork.run(async (tx) => {
        const extendedSeat = await this.seatRepository.lock(tx, flightId, seat, clientId, ttlSeconds);

        if (extendedSeat) {
          events.push({
            type: 'seat.locked',
            flightId,
            seat,
            version: extendedSeat.version,
            lockedUntil: extendedSeat.lockedUntil!.toISOString()
          });

          this.logger.debug('Checkout started', { flightId, seat, clientId });
          return;
        }

        throw AppError.conflict(ErrorCode.LOCK_EXPIRED_OR_NOT_OWNED, 'Bloqueo vencido o no es tuyo');
      });

      // Publish events after commit
      await this.eventPublisher.publishBatch(events);
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.logger.error('Failed to start checkout', { error: String(error), flightId, seat });
      throw AppError.internal('Error al iniciar compra');
    }
  }
}
