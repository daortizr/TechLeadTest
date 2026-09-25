import { GetLockStagesInputPort } from '../inputPorts';
import { SeatRepository, FlightRepository, UnitOfWork } from '../../infraestructure/outputPorts';
import { Logger } from '../../infraestructure/outputPorts';
import { AppError } from '../errorHandler';
import { ErrorCode, SeatStatus } from '@flight-reservations/shared';

export class GetLockStagesUseCase implements GetLockStagesInputPort {
  constructor(
    private seatRepository: SeatRepository,
    private flightRepository: FlightRepository,
    private unitOfWork: UnitOfWork,
    private logger: Logger
  ) {}

  async execute(flightId: string): Promise<void> {
    try {
      if (!flightId) {
        throw AppError.badRequest(ErrorCode.INVALID_REQUEST, 'flightId es requerido');
      }

      await this.unitOfWork.run(async (tx) => {
        const flight = await this.flightRepository.findById(tx, flightId);
        if (!flight) {
          throw AppError.notFound(ErrorCode.FLIGHT_NOT_FOUND, 'Vuelo no encontrado');
        }

        const seats = await this.seatRepository.findByFlightId(tx, flightId);
        const now = new Date();

        // Count active locks by stage
        const selecting = seats.filter(
          s => s.status === SeatStatus.BLOCKED &&
            s.lockedUntil &&
            s.lockedUntil > now &&
            !s.checkoutStartedAt
        ).length;

        const checkout = seats.filter(
          s => s.status === SeatStatus.BLOCKED &&
            s.lockedUntil &&
            s.lockedUntil > now &&
            s.checkoutStartedAt
        ).length;

        this.logger.debug('Retrieved lock stages', { flightId, selecting, checkout });

        return { flightId, selecting, checkout };
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.logger.error('Failed to get lock stages', { error: String(error), flightId });
      throw AppError.internal('Error al obtener etapas de bloqueo');
    }
  }
}
