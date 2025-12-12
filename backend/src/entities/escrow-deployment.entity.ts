import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { WishlistItem } from './wishlist-item.entity';

@Entity('escrow_deployments')
export class EscrowDeployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 42 })
  contractAddress: string;

  @Column({ type: 'varchar', length: 20 })
  chain: string; // 'ethereum' or 'avalanche'

  @Column({ type: 'varchar', length: 20 })
  network: string; // 'sepolia', 'fuji', 'mainnet', etc.

  @Column({ type: 'varchar', length: 66, nullable: true })
  deploymentTxHash?: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  targetAmountEth: number;

  @Column({ type: 'integer' })
  durationInDays: number;

  @Column({ type: 'timestamp' })
  deadline: Date;

  @Column({ type: 'varchar', nullable: true })
  deployedById?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'deployedById' })
  deployedBy: User;

  @Column({ type: 'varchar' })
  wishlistItemId: string;

  @ManyToOne(() => WishlistItem, (wishlistItem) => wishlistItem.escrowDeployments)
  @JoinColumn({ name: 'wishlistItemId' })
  wishlistItem: WishlistItem;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string; // 'active', 'funded', 'expired', 'failed'
}
