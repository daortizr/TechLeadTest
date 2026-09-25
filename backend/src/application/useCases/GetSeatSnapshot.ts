import { GetSeatSnapshotInputPort } from '../inputPorts';
import { FlightRepository, SeatRepository, UnitOfWork } from '../../infraestructure/outputPorts';
import { Logger } from '../../infraestructure/outputPorts';
import { AppError } from '../errorHandler';
import { ErrorCode } from '@flight-reservations/shared';
import { FlightMapper, SeatMapper, SeatSnapshotMapper } from '../mappers';

export class GetSeatSnapshotUseCase implements GetSeatSnapshotInputPort {
  constructor(
    private flightRepository: FlightRepository,
    private seatRepository: SeatRepository,
    private unitOfWork: UnitOfWork,
    private logger: Logger
  ) {}

  async execute(flightId: string, clientId?: string): Promise<void> {
    try {
      if (!flightId) {
        throw AppError.badRequest(ErrorCode.INVALID_REQUEST, 'flightId es requerido');
      }

      const now = new Date();

      await this.unitOfWork.run(async (tx) => {
        const flight = await this.flightRepository.findById(tx, flightId);
        if (!flight) {
          throw AppError.notFound(ErrorCode.FLIGHT_NOT_FOUND, 'Vuelo no encontrado');
        }

        const seats = await this.seatRepository.findByFlightId(tx, flightId);
        const flightDTO = FlightMapper.toDTO(flight, seats.filter(s => s.status === 'RESERVED').length);
        const seatsDTO = seats.map(s => SeatMapper.toDTO(s, clientId, now));
        const snapshot = SeatSnapshotMapper.toDTO(flightDTO, seatsDTO, now);

        this.logger.debug('Retrieved seat snapshot', { flightId, clientId });
        return snapshot;
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.logger.error('Failed to get seat snapshot', { error: String(error), flightId });
      throw AppError.internal('Error al obtener el mapa de asientos');
    }
  }
}
