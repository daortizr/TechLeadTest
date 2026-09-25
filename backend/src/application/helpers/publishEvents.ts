import { FlightEvent } from '@flight-reservations/shared';
import { EventPublisher, Logger } from '../../infraestructure/outputPorts';

// Events go out after the commit. A publishing failure never undoes a committed change:
// it is logged and clients resynchronize with the snapshot.
export async function publishAfterCommit(
  publisher: EventPublisher,
  events: FlightEvent[],
  logger: Logger
): Promise<void> {
  if (events.length === 0) return;
  try {
    await publisher.publishBatch(events);
  } catch (error) {
    logger.error('Failed to publish events', { error: String(error), count: events.length });
  }
}
