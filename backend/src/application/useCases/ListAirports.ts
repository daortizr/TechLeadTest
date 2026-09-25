import { AirportDTO } from '@flight-reservations/shared';
import { ListAirportsInputPort } from '../inputPorts';
import { AirportRepository, UnitOfWork, Logger } from '../../infraestructure/outputPorts';
import { AirportMapper } from '../mappers';

export class ListAirportsUseCase implements ListAirportsInputPort {
  constructor(
    private airportRepository: AirportRepository,
    private unitOfWork: UnitOfWork,
    private logger: Logger
  ) {}

  async execute(): Promise<AirportDTO[]> {
    const airports = await this.unitOfWork.run((tx) => this.airportRepository.findAll(tx));
    this.logger.debug('Listed airports', { count: airports.length });
    return airports.map((airport) => AirportMapper.toDTO(airport));
  }
}
