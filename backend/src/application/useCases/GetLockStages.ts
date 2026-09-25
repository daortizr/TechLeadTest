import { ErrorCode, LockStagesDTO } from '@flight-reservations/shared';
import { GetLockStagesInputPort } from '../inputPorts';
import { SeatRepository, FlightRepository, UnitOfWork } from '../../infraestructure/outputPorts';
import { AppError } from '../errorHandler';

export class GetLockStagesUseCase implements GetLockStagesInputPort {
  constructor(
    private seatRepository: SeatRepository,
    private flightRepository: FlightRepository,
    private unitOfWork: UnitOfWork
  ) {}

  async execute(flightId: string): Promise<LockStagesDTO> {
    return this.unitOfWork.run(async (tx) => {
      const flight = await this.flightRepository.findById(tx, flightId);
      if (!flight) {
        throw AppError.notFound(ErrorCode.FLIGHT_NOT_FOUND, 'Vuelo no encontrado');
      }

      const { selecting, checkout } = await this.seatRepository.countLockStages(tx, flightId);
      return { flightId, selecting, checkout };
    });
  }
}
