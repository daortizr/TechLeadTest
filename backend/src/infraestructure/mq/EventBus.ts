import { FlightEvent } from '@flight-reservations/shared';
import { EventPublisher } from '../outputPorts';

type EventListener = (event: FlightEvent) => void;

export class EventBus implements EventPublisher {
  private listeners: Map<string, Set<EventListener>> = new Map();

  subscribe(eventType: string, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  async publish(event: FlightEvent): Promise<void> {
    if (event.type === 'heartbeat') return;

    const listeners = this.listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in event listener for ${event.type}:`, error);
        }
      }
    }
  }

  async publishBatch(events: FlightEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
