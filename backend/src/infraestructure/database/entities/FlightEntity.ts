import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, OneToMany, CreateDateColumn, Index } from 'typeorm';
import { AirportEntity } from './AirportEntity';
import { SeatEntity } from './SeatEntity';

@Entity('flights')
@Index(['origin', 'destination', 'departure_at'])
export class FlightEntity {
  @PrimaryColumn({ type: 'uuid', generated: 'uuid' })
  id!: string;

  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'char', length: 3 })
  origin!: string;

  @Column({ type: 'char', length: 3 })
  destination!: string;

  @Column({ type: 'timestamptz' })
  departure_at!: Date;

  @Column({ type: 'timestamptz' })
  arrival_at!: Date;

  @Column({ type: 'integer' })
  price_cents!: number;

  @Column({ type: 'char', length: 3, default: 'COP' })
  currency!: string;

  @Column({ type: 'text', default: 'ON_SALE' })
  status!: string;

  @Column({ type: 'integer', default: 0 })
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => AirportEntity)
  @JoinColumn({ name: 'origin', referencedColumnName: 'code' })
  originAirport?: AirportEntity;

  @ManyToOne(() => AirportEntity)
  @JoinColumn({ name: 'destination', referencedColumnName: 'code' })
  destinationAirport?: AirportEntity;

  @OneToMany(() => SeatEntity, seat => seat.flight)
  seats?: SeatEntity[];
}
