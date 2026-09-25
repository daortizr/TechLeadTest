import { Entity, PrimaryColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

@Entity('reservations')
@Index(['flight_id', 'seat_number'], { unique: true })
@Unique('UQ_reservations_code', ['code'])
export class ReservationEntity {
  @PrimaryColumn({ type: 'uuid', generated: 'uuid' })
  id!: string;

  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'uuid' })
  flight_id!: string;

  @Column({ type: 'text' })
  seat_number!: string;

  @Column({ type: 'text' })
  passenger_name!: string;

  @Column({ type: 'text' })
  passenger_email!: string;

  @Column({ type: 'text' })
  passenger_document_type!: string;

  @Column({ type: 'text' })
  passenger_document_number!: string;

  @Column({ type: 'text' })
  passenger_phone!: string;

  @Column({ type: 'text' })
  client_id!: string;

  @Column({ type: 'integer' })
  price!: number;

  @Column({ type: 'char', length: 3 })
  currency!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
