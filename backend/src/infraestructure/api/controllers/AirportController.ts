import { Request, Response } from 'express';
import { ListAirportsUseCase } from '../../../application/useCases';
import { AirportRepository, UnitOfWork } from '../../outputPorts';
import { Logger } from '../../outputPorts';
import { asyncHandler } from '../../utilities';

export class AirportController {
  constructor(
    private airportRepository: AirportRepository,
    private unitOfWork: UnitOfWork,
    private logger: Logger
  ) {}

  listAirports = asyncHandler(async (req: Request, res: Response) => {
    const useCase = new ListAirportsUseCase(
      this.airportRepository,
      this.unitOfWork,
      this.logger
    );

    const airports = await this.unitOfWork.run(async (tx) => {
      return await this.airportRepository.findAll(tx);
    });

    res.json(
      airports.map(a => ({
        code: a.code,
        name: a.name,
        city: a.city,
        timezone: a.timezone
      }))
    );
  });
}
