import { Reservation } from '../../domain/entities';
import { ReservationRepository, TransactionContext } from '../outputPorts';
import { ReservationEntity } from '../database/entities';
import { ReservationMapper } from '../database/mappers';
import { UnitOfWorkImpl } from '../database/UnitOfWorkImpl';
import { returningRows } from '../utilities/pgResult';

export class ReservationRepositoryImpl implements ReservationRepository {
  async create(tx: TransactionContext, reservation: Reservation): Promise<Reservation | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    // ON CONFLICT (code) keeps a code collision from aborting the surrounding transaction
    const rows = returningRows<{ id: string }>(
      await manager.query(
        `
        INSERT INTO reservations (
          id, code, flight_id, seat_number, passenger_name, passenger_email,
          passenger_document_type, passenger_document_number, passenger_phone,
          client_id, price, currency
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (code) DO NOTHING
        RETURNING id
        `,
        [
          reservation.id,
          reservation.code,
          reservation.flightId,
          reservation.seatNumber,
          reservation.passengerName,
          reservation.passengerEmail,
          reservation.passengerDocumentType,
          reservation.passengerDocumentNumber,
          reservation.passengerPhone,
          reservation.clientId,
          reservation.price,
          reservation.currency
        ]
      )
    );
    if (rows.length === 0) return null;

    const stored = await this.findById(tx, reservation.id);
    return stored;
  }

  async findById(tx: TransactionContext, id: string): Promise<Reservation | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const record = await manager.findOne(ReservationEntity, { where: { id } });
    return record ? ReservationMapper.toDomain(record) : null;
  }

  async findByCode(tx: TransactionContext, code: string): Promise<Reservation | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const record = await manager.findOne(ReservationEntity, { where: { code } });
    return record ? ReservationMapper.toDomain(record) : null;
  }
}
