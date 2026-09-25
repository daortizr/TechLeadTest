import { DataSource } from 'typeorm';
import { SeatEntity } from '../database/entities';
import { SeatStatus } from '../../domain/enums';
import { Logger } from '../outputPorts';
import { config } from '../config/env';

export class LockExpirationJob {
  private running = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private dataSource: DataSource,
    private logger: Logger,
    private onExpired?: (events: any[]) => Promise<void>
  ) {}

  start(): void {
    if (this.intervalId) {
      this.logger.warn('Lock expiration job already running');
      return;
    }

    this.intervalId = setInterval(() => {
      this.execute();
    }, config.EXPIRATION_JOB_INTERVAL_MS);

    this.logger.info('Lock expiration job started', {
      intervalMs: config.EXPIRATION_JOB_INTERVAL_MS
    });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('Lock expiration job stopped');
    }
  }

  private async execute(): Promise<void> {
    // Prevent overlapping executions
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();

      const result = await queryRunner.manager.query(
        `
        UPDATE seats
        SET status = 'AVAILABLE', locked_by = NULL, locked_until = NULL,
            checkout_started_at = NULL, version = version + 1
        WHERE status = 'BLOCKED' AND locked_until <= now()
        RETURNING flight_id, seat_number, version
        `
      );

      if (result.length > 0) {
        this.logger.info('Locks expired', { count: result.length });

        // Generate events
        const events = result.map((row: any) => ({
          type: 'seat.released',
          flightId: row.flight_id,
          seat: row.seat_number,
          version: row.version,
          reason: 'EXPIRED'
        }));

        // Publish events if handler provided
        if (this.onExpired) {
          await this.onExpired(events);
        }
      }

      await queryRunner.release();
    } catch (error) {
      this.logger.error('Lock expiration job failed', { error: String(error) });
    } finally {
      this.running = false;
    }
  }
}
