import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('idempotency_keys')
@Index(['created_at'])
export class IdempotencyKeyEntity {
  @PrimaryColumn({ type: 'text' })
  key!: string;

  @Column({ type: 'text' })
  client_id!: string;

  @Column({ type: 'text' })
  request_hash!: string;

  @Column({ type: 'text' })
  status!: string;

  @Column({ type: 'uuid', nullable: true })
  reservation_id!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
