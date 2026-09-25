import { CheckoutDTO, ErrorCode, FlightEvent } from '@flight-reservations/shared';
import { StartCheckoutInputPort } from '../inputPorts';
import { SeatLockSettings } from '../dtos';
import { SeatRepository, UnitOfWork, EventPublisher, Logger } from '../../infraestructure/outputPorts';
import { AppError } from '../errorHandler';
import { diagnoseSeat, publishAfterCommit } from '../helpers';

export class StartCheckoutUseCase implements StartCheckoutInputPort {
  constructor(
    private seatRepository: SeatRepository,
    private unitOfWork: UnitOfWork,
    private eventPublisher: EventPublisher,
    private settings: SeatLockSettings,
    private logger: Logger
  ) {}

  // Restarts the lock once: CHECKOUT_TTL plus the payment margin, so the user gets
  // exactly CHECKOUT_TTL seconds to pay (payableUntil = lockedUntil - margin)
  async execute(flightId: string, seat: string, clientId: string): Promise<CheckoutDTO> {
    const { checkoutTtlSeconds, paymentMarginSeconds } = this.settings;
    const events: FlightEvent[] = [];

    const result = await this.unitOfWork.run(async (tx): Promise<CheckoutDTO> => {
      const extended = await this.seatRepository.extend(
        tx,
        flightId,
        seat,
        clientId,
        checkoutTtlSeconds + paymentMarginSeconds
      );

      if (extended) {
        events.push({
          type: 'seat.locked',
          flightId,
          seat,
          version: extended.version,
          lockedUntil: extended.lockedUntil.toISOString()
        });
        return this.toDTO(extended.lockedUntil, extended.version);
      }

      const diagnosis = await this.seatRepository.diagnose(tx, flightId, seat, clientId);
      const outcome = diagnoseSeat(diagnosis, 'CHECKOUT');

      switch (outcome.kind) {
        case 'SEAT_NOT_FOUND':
          throw AppError.notFound(ErrorCode.SEAT_NOT_FOUND, 'Asiento no encontrado');
        case 'FLIGHT_NOT_BOOKABLE':
          throw AppError.conflict(ErrorCode.FLIGHT_NOT_BOOKABLE, 'El vuelo no está disponible para la venta');
        case 'ALREADY_MINE':
          // Already in checkout: idempotent, neither extends nor emits an event
          return this.toDTO(outcome.lockedUntil, diagnosis?.seatVersion ?? 0);
        default:
          throw AppError.conflict(ErrorCode.LOCK_EXPIRED_OR_NOT_OWNED, 'Bloqueo vencido o no es tuyo');
      }
    });

    await publishAfterCommit(this.eventPublisher, events, this.logger);
    this.logger.debug('Checkout started', { flightId, seat });
    return result;
  }

  private toDTO(lockedUntil: Date, version: number): CheckoutDTO {
    return {
      lockedUntil: lockedUntil.toISOString(),
      payableUntil: new Date(lockedUntil.getTime() - this.settings.paymentMarginSeconds * 1000).toISOString(),
      version
    };
  }
}
