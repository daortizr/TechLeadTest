import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { FlightEntity } from './FlightEntity';

@Entity('seats')
@Index(['locked_until'], { where: 'status = \'BLOCKED\'' })
@Index(['flight_id', 'locked_by'], { unique: true, where: 'status = \'BLOCKED\'' })
export class SeatEntity {
  @PrimaryColumn({ type: 'uuid' })
  flight_id!: string;

  @PrimaryColumn({ type: 'text' })
  seat_number!: string;

  @Column({ type: 'integer' })
  row_number!: number;

  @Column({ type: 'char', length: 1 })
  column_letter!: string;

  @Column({ type: 'text', default: 'AVAILABLE' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  locked_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  locked_until!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  checkout_started_at!: Date | null;

  @Column({ type: 'integer', default: 0 })
  version!: number;

  @ManyToOne(() => FlightEntity, flight => flight.seats)
  @JoinColumn({ name: 'flight_id', referencedColumnName: 'id' })
  flight?: FlightEntity;
}
