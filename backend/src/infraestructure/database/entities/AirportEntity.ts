import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('airports')
export class AirportEntity {
  @PrimaryColumn({ type: 'char', length: 3 })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  city!: string;

  @Column({ type: 'text', default: 'America/Bogota' })
  timezone!: string;
}
