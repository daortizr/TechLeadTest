import { ChangeFlightStatusInputPort } from '../inputPorts';
import { FlightRepository, UnitOfWork, EventPublisher } from '../../infraestructure/outputPorts';
import { Logger } from '../../infraestructure/outputPorts';
import { AppError } from '../errorHandler';
import { ErrorCode, FlightUpdatedEvent } from '@flight-reservations/shared';
import { Flight } from '../../domain/entities';
import { FlightStatus } from '../../domain/enums';

export class ChangeFlightStatusUseCase implements ChangeFlightStatusInputPort {
  constructor(
    private flightRepository: FlightRepository,
    private unitOfWork: UnitOfWork,
    private eventPublisher: EventPublisher,
    private logger: Logger
  ) {}

  async execute(flightId: string, action: 'cancel'): Promise<void> {
    try {
      if (!flightId || !action) {
        throw AppError.badRequest(ErrorCode.INVALID_REQUEST, 'flightId y action son requeridos');
      }

      const events: FlightUpdatedEvent[] = [];

      await this.unitOfWork.run(async (tx) => {
        const flight = await this.flightRepository.findById(tx, flightId);
        if (!flight) {
          throw AppError.notFound(ErrorCode.FLIGHT_NOT_FOUND, 'Vuelo no encontrado');
        }

        if (action === 'cancel') {
          // Can only cancel ON_SALE flights
          if (flight.status !== FlightStatus.ON_SALE && flight.status !== 'DELAYED') {
            throw AppError.conflict(ErrorCode.INVALID_TRANSITION, 'No se puede cancelar este vuelo');
          }

          const cancelledFlight = new Flight(
            flight.id,
            flight.code,
            flight.origin,
            flight.destination,
            flight.departureAt,
            flight.arrivalAt,
            flight.priceCents,
            flight.currency,
            FlightStatus.CANCELLED,
            flight.version + 1,
            flight.createdAt
          );

          await this.flightRepository.update(tx, cancelledFlight);

          events.push({
            type: 'flight.updated',
            flightId,
            status: FlightStatus.CANCELLED,
            availableSeats: 0,
            version: flight.version + 1
          });

          this.logger.info('Flight cancelled', { flightId });
        }
      });

      // Publish events after commit
      await this.eventPublisher.publishBatch(events);
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.logger.error('Failed to change flight status', { error: String(error), flightId });
      throw AppError.internal('Error al cambiar estado del vuelo');
    }
  }
}
