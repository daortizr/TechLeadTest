import { Request, Response } from 'express';
import { SseHub } from '../sse/SseHub';

export class EventsController {
  constructor(private hub: SseHub) {}

  stream = (req: Request, res: Response): void => {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const unsubscribe = this.hub.addClient(res);
    req.on('close', unsubscribe);
  };
}
