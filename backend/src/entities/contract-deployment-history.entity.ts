import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Company } from './company.entity';
import { WishlistItem } from './wishlist-item.entity';

export enum ContractAction {
  DEPLOYED = 'deployed',
  FUNDED = 'funded',
  EXPIRED = 'expired',
  FINALIZED = 'finalized',
  REFUND_INITIATED = 'refund_initiated',
  CONTRIBUTED = 'contributed',
  REFUNDED = 'refunded',
}

@Entity('contract_deployment_history')
export class ContractDeploymentHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ type: 'uuid' })
  wishlistItemId: string;

  @ManyToOne(() => WishlistItem)
  @JoinColumn({ name: 'wishlistItemId' })
  wishlistItem: WishlistItem;

  @Column({ type: 'uuid', nullable: true })
  escrowDeploymentId?: string;

  @Column({ type: 'varchar', length: 42, nullable: true })
  contractAddress?: string;

  @Column({ type: 'varchar', length: 42 })
  fromAddress: string; // Address that initiated the action

  @Column({ type: 'varchar', length: 20 })
  chain: string; // 'ethereum' or 'avalanche'

  @Column({ type: 'varchar', length: 20 })
  network: string; // 'sepolia', 'fuji', 'mainnet', etc.

  @Column({ type: 'enum', enum: ContractAction })
  action: ContractAction;

  @Column({ type: 'varchar', length: 66, nullable: true })
  transactionHash?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>; // Additional action-specific data

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;
}
