import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('payments')
@Index(['idempotency_key'])
@Index(['reservation_id'])
export class PaymentEntity {
  @PrimaryColumn({ type: 'uuid', generated: 'uuid' })
  id!: string;

  @Column({ type: 'text' })
  idempotency_key!: string;

  @Column({ type: 'uuid', nullable: true })
  reservation_id!: string | null;

  @Column({ type: 'text', nullable: true })
  authorization_ref!: string | null;

  @Column({ type: 'integer' })
  amount!: number;

  @Column({ type: 'text' })
  status!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
