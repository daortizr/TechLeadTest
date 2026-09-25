import { Request, Response } from 'express';
import { LockSeatInputPort, StartCheckoutInputPort, UnlockSeatInputPort } from '../../../application/inputPorts';
import { asyncHandler } from '../../utilities';
import { seatParamsSchema } from '../schemas';
import { parseInput, requireClientId } from '../middlewares';

export class SeatController {
  constructor(
    private lockSeatUseCase: LockSeatInputPort,
    private unlockSeatUseCase: UnlockSeatInputPort,
    private startCheckoutUseCase: StartCheckoutInputPort
  ) {}

  lock = asyncHandler(async (req: Request, res: Response) => {
    const { id, seat } = parseInput(seatParamsSchema, req.params);
    res.json(await this.lockSeatUseCase.execute(id, seat, requireClientId(res)));
  });

  unlock = asyncHandler(async (req: Request, res: Response) => {
    const { id, seat } = parseInput(seatParamsSchema, req.params);
    await this.unlockSeatUseCase.execute(id, seat, requireClientId(res));
    res.status(204).send();
  });

  checkout = asyncHandler(async (req: Request, res: Response) => {
    const { id, seat } = parseInput(seatParamsSchema, req.params);
    res.json(await this.startCheckoutUseCase.execute(id, seat, requireClientId(res)));
  });
}
