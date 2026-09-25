import { Request, Response } from 'express';
import { CreateReservationInputPort, GetReservationInputPort } from '../../../application/inputPorts';
import { asyncHandler } from '../../utilities';
import { createReservationSchema, reservationCodeSchema } from '../schemas';
import { parseInput, requireClientId, requireIdempotencyKey } from '../middlewares';

export class ReservationController {
  constructor(
    private createReservationUseCase: CreateReservationInputPort,
    private getReservationUseCase: GetReservationInputPort
  ) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = parseInput(createReservationSchema, req.body);
    const { reservation, created } = await this.createReservationUseCase.execute({
      flightId: body.flightId,
      seat: body.seat,
      clientId: requireClientId(res),
      idempotencyKey: requireIdempotencyKey(res),
      passenger: body.passenger,
      payment: body.payment
    });
    // 200 when an earlier request with the same idempotency key had already completed
    res.status(created ? 201 : 200).json(reservation);
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const { code } = parseInput(reservationCodeSchema, req.params);
    res.json(await this.getReservationUseCase.execute(code));
  });
}
