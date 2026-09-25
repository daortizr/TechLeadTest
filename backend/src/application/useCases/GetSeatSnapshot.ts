import { ErrorCode, SeatSnapshotDTO } from '@flight-reservations/shared';
import { GetSeatSnapshotInputPort } from '../inputPorts';
import { SeatLockSettings } from '../dtos';
import { FlightRepository, SeatRepository, UnitOfWork, Logger } from '../../infraestructure/outputPorts';
import { AppError } from '../errorHandler';
import { FlightMapper, SeatMapper, SeatSnapshotMapper } from '../mappers';
import { SeatStatus } from '../../domain/enums';

export class GetSeatSnapshotUseCase implements GetSeatSnapshotInputPort {
  constructor(
    private flightRepository: FlightRepository,
    private seatRepository: SeatRepository,
    private unitOfWork: UnitOfWork,
    private settings: SeatLockSettings,
    private logger: Logger
  ) {}

  async execute(flightId: string, clientId?: string): Promise<SeatSnapshotDTO> {
    const snapshot = await this.unitOfWork.run(async (tx) => {
      const flight = await this.flightRepository.findById(tx, flightId);
      if (!flight) {
        throw AppError.notFound(ErrorCode.FLIGHT_NOT_FOUND, 'Vuelo no encontrado');
      }

      const now = await this.seatRepository.databaseNow(tx);
      const seats = await this.seatRepository.findByFlightId(tx, flightId);
      const seatDTOs = seats.map((seat) => SeatMapper.toDTO(seat, clientId, now, this.settings.paymentMarginSeconds));
      const availableSeats = seatDTOs.filter((seat) => seat.status === SeatStatus.AVAILABLE).length;

      return SeatSnapshotMapper.toDTO(FlightMapper.toDTO(flight, availableSeats, seatDTOs.length), seatDTOs, now);
    });

    this.logger.debug('Retrieved seat snapshot', { flightId });
    return snapshot;
  }
}
