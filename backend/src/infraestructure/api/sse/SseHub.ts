import { Response } from 'express';
import { FlightEvent } from '@flight-reservations/shared';
import { logger } from '../../utilities';

export class SseHub {
  private clients: Set<Response> = new Set();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(private heartbeatIntervalMs: number) {}

  start(): void {
    if (this.heartbeatTimer) return;
    // SSE comments never reach JavaScript, so the heartbeat is a named event
    this.heartbeatTimer = setInterval(() => this.broadcast({ type: 'heartbeat' }), this.heartbeatIntervalMs);
  }

  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const client of this.clients) {
      client.end();
    }
    this.clients.clear();
  }

  // Returns the function that removes the client when the connection closes
  addClient(response: Response): () => void {
    this.clients.add(response);
    this.send(response, { type: 'heartbeat' });
    return () => {
      this.clients.delete(response);
    };
  }

  broadcast(event: FlightEvent): void {
    for (const client of this.clients) {
      this.send(client, event);
    }
  }

  clientCount(): number {
    return this.clients.size;
  }

  private send(client: Response, event: FlightEvent): void {
    try {
      const data = event.type === 'heartbeat' ? '{}' : JSON.stringify(event);
      client.write(`event: ${event.type}\ndata: ${data}\n\n`);
    } catch (error) {
      logger.warn('Error sending SSE event, dropping the client', { error: String(error) });
      this.clients.delete(client);
    }
  }
}
