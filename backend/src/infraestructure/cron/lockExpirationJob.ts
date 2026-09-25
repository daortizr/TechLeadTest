import { ExpireLocksInputPort } from '../../application/inputPorts';
import { Logger } from '../outputPorts';

// Calls the ExpireLocks use case on an interval, never overlapping with itself
export class LockExpirationJob {
  private running = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private expireLocks: ExpireLocksInputPort,
    private logger: Logger,
    private intervalMs: number
  ) {}

  start(): void {
    if (this.intervalId) {
      this.logger.warn('Lock expiration job already running');
      return;
    }

    this.intervalId = setInterval(() => {
      void this.tick();
    }, this.intervalMs);

    this.logger.info('Lock expiration job started', { intervalMs: this.intervalMs });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('Lock expiration job stopped');
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;

    this.running = true;
    try {
      await this.expireLocks.execute();
    } catch (error) {
      this.logger.error('Lock expiration job failed', { error: String(error) });
    } finally {
      this.running = false;
    }
  }
}
