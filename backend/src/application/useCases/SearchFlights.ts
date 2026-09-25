import { SearchFlightsInputPort } from '../inputPorts';
import { FlightRepository, UnitOfWork } from '../../infraestructure/outputPorts';
import { Logger } from '../../infraestructure/outputPorts';
import { AppError } from '../errorHandler';
import { ErrorCode } from '@flight-reservations/shared';

export class SearchFlightsUseCase implements SearchFlightsInputPort {
  constructor(
    private flightRepository: FlightRepository,
    private unitOfWork: UnitOfWork,
    private logger: Logger
  ) {}

  async execute(origin: string, destination: string, date: string): Promise<void> {
    try {
      // Validate inputs (basic validation, detailed validation done in controller)
      if (!origin || !destination || !date) {
        throw AppError.badRequest(ErrorCode.INVALID_REQUEST, 'origin, destination y date son requeridos');
      }

      if (origin === destination) {
        throw AppError.badRequest(ErrorCode.INVALID_REQUEST, 'origin y destination deben ser diferentes');
      }

      // Parse and validate date format YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        throw AppError.badRequest(ErrorCode.INVALID_REQUEST, 'date debe estar en formato YYYY-MM-DD');
      }

      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        throw AppError.badRequest(ErrorCode.INVALID_REQUEST, 'date inválida');
      }

      await this.unitOfWork.run(async (tx) => {
        const flights = await this.flightRepository.search(
          tx,
          origin.toUpperCase(),
          destination.toUpperCase(),
          parsedDate,
          new Date(parsedDate.getTime() + 86400000) // +1 day
        );

        this.logger.debug('Searched flights', {
          origin,
          destination,
          date,
          count: flights.length
        });

        return flights;
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.logger.error('Failed to search flights', { error: String(error) });
      throw AppError.internal('Error al buscar vuelos');
    }
  }
}
