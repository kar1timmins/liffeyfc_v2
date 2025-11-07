import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * RefreshToken Entity
 * 
 * Stores refresh tokens for all users (regardless of role)
 * Simple one-to-many relationship with User entity
 */
@Entity({ name: 'refresh_tokens' })
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  tokenHash: string;

  @Column({ type: 'bigint' })
  expiresAt: number;

  // Simple relationship: token belongs to a user (any role)
  @ManyToOne(() => User, (u) => u.refreshTokens, { onDelete: 'CASCADE' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'boolean', default: false })
  revoked: boolean;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt?: Date;

  @Column({ type: 'varchar', nullable: true })
  replacedByTokenId?: string;
}
