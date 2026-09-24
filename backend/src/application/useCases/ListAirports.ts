import { ListAirportsInputPort } from '../inputPorts';
import { AirportRepository, UnitOfWork } from '../../infraestructure/outputPorts';
import { Logger } from '../../infraestructure/outputPorts';

export class ListAirportsUseCase implements ListAirportsInputPort {
  constructor(
    private airportRepository: AirportRepository,
    private unitOfWork: UnitOfWork,
    private logger: Logger
  ) {}

  async execute(): Promise<void> {
    try {
      // This is typically called by the controller which handles the response
      await this.unitOfWork.run(async (tx) => {
        const airports = await this.airportRepository.findAll(tx);
        this.logger.debug('Listed airports', { count: airports.length });
        return airports;
      });
    } catch (error) {
      this.logger.error('Failed to list airports', { error: String(error) });
      throw error;
    }
  }
}
