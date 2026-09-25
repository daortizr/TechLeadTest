import { ErrorCode, FlightDTO, FlightEvent } from '@flight-reservations/shared';
import { ChangeFlightStatusInputPort } from '../inputPorts';
import { FlightRepository, UnitOfWork, EventPublisher, Logger } from '../../infraestructure/outputPorts';
import { AppError } from '../errorHandler';
import { FlightMapper } from '../mappers';
import { FlightStatus } from '../../domain/enums';
import { publishAfterCommit } from '../helpers';

export class ChangeFlightStatusUseCase implements ChangeFlightStatusInputPort {
  constructor(
    private flightRepository: FlightRepository,
    private unitOfWork: UnitOfWork,
    private eventPublisher: EventPublisher,
    private logger: Logger
  ) {}

  // Only ON_SALE flights can be cancelled
  async execute(flightId: string, action: 'cancel'): Promise<FlightDTO> {
    const events: FlightEvent[] = [];

    const flightDTO = await this.unitOfWork.run(async (tx) => {
      const version = await this.flightRepository.cancel(tx, flightId);

      if (version === null) {
        const flight = await this.flightRepository.findById(tx, flightId);
        if (!flight) {
          throw AppError.notFound(ErrorCode.FLIGHT_NOT_FOUND, 'Vuelo no encontrado');
        }
        throw AppError.conflict(ErrorCode.INVALID_TRANSITION, 'Solo se pueden cancelar vuelos en venta');
      }

      const flight = await this.flightRepository.findById(tx, flightId);
      if (!flight) {
        throw AppError.internal('Vuelo cancelado no encontrado');
      }

      events.push({
        type: 'flight.updated',
        flightId,
        status: FlightStatus.CANCELLED,
        availableSeats: 0,
        version
      });
      return FlightMapper.toDTO(flight, 0);
    });

    await publishAfterCommit(this.eventPublisher, events, this.logger);
    this.logger.info('Flight status changed', { flightId, action });
    return flightDTO;
  }
}
