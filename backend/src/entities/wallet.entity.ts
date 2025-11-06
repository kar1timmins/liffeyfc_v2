import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.entity';
import { Investor } from './investor.entity';

/**
 * Wallet Entity
 * 
 * Stores Web3 wallet addresses for users and investors
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

  // Polymorphic relationship: wallet can belong to either User or Investor
  @ManyToOne(() => User, (u) => u.wallets, { onDelete: 'CASCADE', nullable: true })
  user?: User;

  @ManyToOne(() => Investor, (i) => i.wallets, { onDelete: 'CASCADE', nullable: true })
  investor?: Investor;
}
