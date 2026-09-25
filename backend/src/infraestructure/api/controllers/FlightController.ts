import { Request, Response } from 'express';
import { GetSeatSnapshotInputPort, SearchFlightsInputPort } from '../../../application/inputPorts';
import { asyncHandler } from '../../utilities';
import { flightParamsSchema, searchFlightsSchema } from '../schemas';
import { getClientId, parseInput } from '../middlewares';

export class FlightController {
  constructor(
    private searchFlightsUseCase: SearchFlightsInputPort,
    private getSeatSnapshotUseCase: GetSeatSnapshotInputPort
  ) {}

  search = asyncHandler(async (req: Request, res: Response) => {
    const query = parseInput(searchFlightsSchema, req.query);
    res.json(await this.searchFlightsUseCase.execute(query));
  });

  seatSnapshot = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseInput(flightParamsSchema, req.params);
    res.json(await this.getSeatSnapshotUseCase.execute(id, getClientId(res)));
  });
}
