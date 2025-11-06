import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { Investor } from './investor.entity';
import { Staff } from './staff.entity';

/**
 * RefreshToken Entity
 * 
 * Stores refresh tokens for all user types (users, investors, staff)
 * Uses polymorphic relationship - token belongs to one of the three types
 */
@Entity({ name: 'refresh_tokens' })
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  tokenHash: string;

  @Column({ type: 'bigint' })
  expiresAt: number;

  // Polymorphic relationship: token can belong to User, Investor, or Staff
  @ManyToOne(() => User, (u) => u.refreshTokens, { onDelete: 'CASCADE', nullable: true })
  user?: User;

  @ManyToOne(() => Investor, (i) => i.refreshTokens, { onDelete: 'CASCADE', nullable: true })
  investor?: Investor;

  @ManyToOne(() => Staff, (s) => s.refreshTokens, { onDelete: 'CASCADE', nullable: true })
  staff?: Staff;

  // User type discriminator for easier queries
  @Column({ type: 'varchar' })
  userType: 'user' | 'investor' | 'staff';

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'boolean', default: false })
  revoked: boolean;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt?: Date;

  @Column({ type: 'varchar', nullable: true })
  replacedByTokenId?: string;
}
