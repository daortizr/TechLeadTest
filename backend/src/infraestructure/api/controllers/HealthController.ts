import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { ErrorCode } from '@flight-reservations/shared';
import { logger } from '../../utilities';

export class HealthController {
  constructor(private dataSource: DataSource) {}

  check = async (_req: Request, res: Response): Promise<void> => {
    try {
      await this.dataSource.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch (error) {
      logger.error('Health check failed', { error: String(error) });
      res.status(503).json({ error: { code: ErrorCode.INTERNAL_ERROR, message: 'Base de datos no disponible' } });
    }
  };
}
