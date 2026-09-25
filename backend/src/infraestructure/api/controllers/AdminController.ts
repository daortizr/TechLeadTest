import { Request, Response } from 'express';
import { ChangeFlightStatusInputPort, GetLockStagesInputPort } from '../../../application/inputPorts';
import { asyncHandler } from '../../utilities';
import { flightParamsSchema } from '../schemas';
import { parseInput } from '../middlewares';

export class AdminController {
  constructor(
    private changeFlightStatusUseCase: ChangeFlightStatusInputPort,
    private getLockStagesUseCase: GetLockStagesInputPort
  ) {}

  cancelFlight = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseInput(flightParamsSchema, req.params);
    res.json(await this.changeFlightStatusUseCase.execute(id, 'cancel'));
  });

  lockStages = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseInput(flightParamsSchema, req.params);
    res.json(await this.getLockStagesUseCase.execute(id));
  });
}
