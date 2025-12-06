import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * Wallet Entity
 * 
 * Stores Web3 wallet addresses for users
 * Users with role 'user' or 'investor' can connect wallets
 * Staff members typically don't need wallet connections
 */
@Entity({ name: 'wallets' })
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  address: string;

  @Column({ type: 'varchar', nullable: true })
  chainId?: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  // Simple relationship: wallet belongs to a user (any role)
  @ManyToOne(() => User, (u) => u.wallets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
