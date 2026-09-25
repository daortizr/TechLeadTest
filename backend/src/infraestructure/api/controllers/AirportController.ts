import { Request, Response } from 'express';
import { ListAirportsInputPort } from '../../../application/inputPorts';
import { asyncHandler } from '../../utilities';

export class AirportController {
  constructor(private listAirportsUseCase: ListAirportsInputPort) {}

  list = asyncHandler(async (_req: Request, res: Response) => {
    res.json(await this.listAirportsUseCase.execute());
  });
}
