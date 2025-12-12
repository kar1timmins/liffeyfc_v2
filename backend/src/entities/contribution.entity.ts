import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { WishlistItem } from './wishlist-item.entity';
import { EscrowDeployment } from './escrow-deployment.entity';

@Entity('contributions')
export class Contribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 42 })
  contributorAddress: string;

  @Column({ type: 'varchar', nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar' })
  escrowDeploymentId: string;

  @ManyToOne(() => EscrowDeployment)
  @JoinColumn({ name: 'escrowDeploymentId' })
  escrowDeployment: EscrowDeployment;

  @Column({ type: 'varchar' })
  wishlistItemId: string;

  @ManyToOne(() => WishlistItem, (wishlistItem) => wishlistItem.contributions)
  @JoinColumn({ name: 'wishlistItemId' })
  wishlistItem: WishlistItem;

  @Column({ type: 'varchar', length: 42 })
  contractAddress: string;

  @Column({ type: 'varchar', length: 20 })
  chain: string; // 'ethereum' or 'avalanche'

  @Column({ type: 'varchar', length: 66, nullable: true })
  transactionHash: string;

  @Column({ type: 'varchar' })
  amountWei: string; // Store as string to preserve precision

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  amountEth: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amountUsd: number; // USD equivalent at time of contribution

  @CreateDateColumn()
  contributedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'boolean', default: false })
  isRefunded: boolean;

  @Column({ type: 'timestamp', nullable: true })
  refundedAt: Date;

  @Column({ type: 'varchar', length: 66, nullable: true })
  refundTxHash: string;
}
