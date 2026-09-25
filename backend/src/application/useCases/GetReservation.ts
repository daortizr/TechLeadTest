import { ErrorCode, ReservationDTO } from '@flight-reservations/shared';
import { GetReservationInputPort } from '../inputPorts';
import { ReservationRepository, FlightRepository, UnitOfWork } from '../../infraestructure/outputPorts';
import { AppError } from '../errorHandler';
import { ReservationMapper, FlightMapper } from '../mappers';

export class GetReservationUseCase implements GetReservationInputPort {
  constructor(
    private reservationRepository: ReservationRepository,
    private flightRepository: FlightRepository,
    private unitOfWork: UnitOfWork
  ) {}

  async execute(code: string): Promise<ReservationDTO> {
    return this.unitOfWork.run(async (tx) => {
      const reservation = await this.reservationRepository.findByCode(tx, code);
      if (!reservation) {
        throw AppError.notFound(ErrorCode.RESERVATION_NOT_FOUND, 'Reserva no encontrada');
      }

      const flight = await this.flightRepository.findById(tx, reservation.flightId);
      if (!flight) {
        throw AppError.internal('Vuelo de la reserva no encontrado');
      }

      return ReservationMapper.toDTO(reservation, FlightMapper.toDTO(flight));
    });
  }
}
