import { ExpireLocksInputPort } from '../inputPorts';
import { SeatRepository, UnitOfWork, EventPublisher, Logger } from '../../infraestructure/outputPorts';
import { publishAfterCommit } from '../helpers';

// Notification mechanism of 7.4: an expired lock is already treated as free by every
// acquire; this only releases the rows and tells the clients.
export class ExpireLocksUseCase implements ExpireLocksInputPort {
  constructor(
    private seatRepository: SeatRepository,
    private unitOfWork: UnitOfWork,
    private eventPublisher: EventPublisher,
    private logger: Logger
  ) {}

  async execute(): Promise<number> {
    const expired = await this.unitOfWork.run((tx) => this.seatRepository.expireLocks(tx));
    if (expired.length === 0) return 0;

    await publishAfterCommit(
      this.eventPublisher,
      expired.map((seat) => ({
        type: 'seat.released' as const,
        flightId: seat.flightId,
        seat: seat.seatNumber,
        version: seat.version,
        reason: 'EXPIRED' as const
      })),
      this.logger
    );
    this.logger.info('Locks expired', { count: expired.length });
    return expired.length;
  }
}
