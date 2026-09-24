import { GetReservationInputPort } from '../inputPorts';
import { ReservationRepository, FlightRepository, UnitOfWork } from '../../infraestructure/outputPorts';
import { Logger } from '../../infraestructure/outputPorts';
import { AppError } from '../errorHandler';
import { ErrorCode } from '@flight-reservations/shared';
import { ReservationMapper, FlightMapper } from '../mappers';

export class GetReservationUseCase implements GetReservationInputPort {
  constructor(
    private reservationRepository: ReservationRepository,
    private flightRepository: FlightRepository,
    private unitOfWork: UnitOfWork,
    private logger: Logger
  ) {}

  async execute(code: string): Promise<void> {
    try {
      if (!code) {
        throw AppError.badRequest(ErrorCode.INVALID_REQUEST, 'code es requerido');
      }

      await this.unitOfWork.run(async (tx) => {
        const reservation = await this.reservationRepository.findByCode(tx, code);
        if (!reservation) {
          throw AppError.notFound(ErrorCode.RESERVATION_NOT_FOUND, 'Reserva no encontrada');
        }

        const flight = await this.flightRepository.findById(tx, reservation.flightId);
        if (!flight) {
          throw AppError.internal('Vuelo de la reserva no encontrado');
        }

        const reservationDTO = ReservationMapper.toDTO(reservation);
        const flightDTO = FlightMapper.toDTO(flight);

        this.logger.debug('Retrieved reservation', { code });
        return { ...reservationDTO, flight: flightDTO };
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.logger.error('Failed to get reservation', { error: String(error), code });
      throw AppError.internal('Error al obtener reserva');
    }
  }
}
