import { ErrorCode, FlightEvent } from '@flight-reservations/shared';
import { UnlockSeatInputPort } from '../inputPorts';
import { SeatRepository, UnitOfWork, EventPublisher, Logger } from '../../infraestructure/outputPorts';
import { AppError } from '../errorHandler';
import { diagnoseSeat, publishAfterCommit } from '../helpers';

export class UnlockSeatUseCase implements UnlockSeatInputPort {
  constructor(
    private seatRepository: SeatRepository,
    private unitOfWork: UnitOfWork,
    private eventPublisher: EventPublisher,
    private logger: Logger
  ) {}

  async execute(flightId: string, seat: string, clientId: string): Promise<void> {
    const events: FlightEvent[] = [];

    await this.unitOfWork.run(async (tx) => {
      const released = await this.seatRepository.release(tx, flightId, seat, clientId);
      if (released) {
        events.push({
          type: 'seat.released',
          flightId,
          seat,
          version: released.version,
          reason: 'RELEASED'
        });
        return;
      }

      const diagnosis = await this.seatRepository.diagnose(tx, flightId, seat, clientId);
      const outcome = diagnoseSeat(diagnosis, 'RELEASE');
      if (outcome.kind === 'SEAT_NOT_FOUND') {
        throw AppError.notFound(ErrorCode.SEAT_NOT_FOUND, 'Asiento no encontrado');
      }
      if (outcome.kind === 'LOCK_NOT_OWNED') {
        throw AppError.forbidden(ErrorCode.LOCK_NOT_OWNED, 'El asiento no está bloqueado por ti');
      }
      // Already free, expired or released: idempotent, no event
    });

    await publishAfterCommit(this.eventPublisher, events, this.logger);
    this.logger.debug('Seat unlock handled', { flightId, seat });
  }
}
