import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../entities/user.entity';

/**
 * Records of Stripe onramp sessions initiated by a user.  The table is kept
 * intentionally small (no bulky session payload) because the real source of
 * truth is Stripe itself; this is merely a convenience for displaying a simple
 * purchase history in the UI.
 */
@Entity('crypto_purchases')
export class CryptoPurchase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (u: User) => u.cryptoPurchases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ length: 32 })
  currency!: string;

  @Column({ length: 32 })
  network!: string;

  // store as string for precision; the frontend treats it as a number
  @Column({ type: 'decimal', precision: 24, scale: 10 })
  amount!: string;

  @Column({ length: 32 })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
