import { Response } from 'express';
import { FlightEvent } from '@flight-reservations/shared';
import { config } from '../../config/env';

interface SseClient {
  response: Response;
  clientId: string;
}

export class SseHub {
  private clients: Set<SseClient> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  start(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      this.broadcast({ type: 'heartbeat' });
    }, config.HEARTBEAT_INTERVAL_MS);
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  addClient(response: Response, clientId: string): () => void {
    const client: SseClient = { response, clientId };
    this.clients.add(client);

    // Send initial heartbeat
    this.sendToClient(client, { type: 'heartbeat' });

    // Return unsubscribe function
    return () => {
      this.clients.delete(client);
    };
  }

  broadcast(event: FlightEvent): void {
    for (const client of this.clients) {
      this.sendToClient(client, event);
    }
  }

  private sendToClient(client: SseClient, event: FlightEvent): void {
    try {
      if (event.type === 'heartbeat') {
        client.response.write(`: heartbeat\n\n`);
      } else {
        client.response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      console.error('Error sending SSE to client:', error);
      this.clients.delete(client);
    }
  }
}

export const sseHub = new SseHub();
