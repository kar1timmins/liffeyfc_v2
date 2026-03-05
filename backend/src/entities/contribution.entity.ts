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
  id!: string;

  @Column({ type: 'varchar', length: 42 })
  contributorAddress!: string;

  @Column({ type: 'varchar', nullable: true })
  userId!: string; // nullable in DB, will be set by TypeORM

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | undefined;

  @Column({ type: 'varchar', nullable: true })
  escrowDeploymentId!: string | null;

  @ManyToOne(() => EscrowDeployment, { nullable: true })
  @JoinColumn({ name: 'escrowDeploymentId' })
  escrowDeployment!: EscrowDeployment | null;

  @Column({ type: 'varchar' })
  wishlistItemId!: string;

  @ManyToOne(() => WishlistItem, (wishlistItem) => wishlistItem.contributions)
  @JoinColumn({ name: 'wishlistItemId' })
  wishlistItem!: WishlistItem;

  /** For EVM chains: the escrow contract address.
   *  For non-EVM chains: the company child wallet address that received funds. */
  @Column({ type: 'varchar', length: 66, nullable: true })
  contractAddress!: string | null;

  /** 'ethereum', 'avalanche', 'solana', 'stellar', 'bitcoin' */
  @Column({ type: 'varchar', length: 20 })
  chain!: string;

  @Column({ type: 'varchar', length: 66, nullable: true })
  transactionHash!: string | null;

  /** EVM-only: amount in Wei as string (null for non-EVM chains). */
  @Column({ type: 'varchar', nullable: true })
  amountWei!: string | null;

  /** EVM-only: amount in ETH/AVAX (null for non-EVM chains). */
  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  amountEth!: number | null;

  /** Native currency symbol: ETH, AVAX, SOL, XLM, BTC */
  @Column({ type: 'varchar', length: 10, nullable: true })
  currencySymbol!: string | null;

  /** Amount in the native currency of the chain (e.g. 1.5 SOL). */
  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  nativeAmount!: number | null;

  /** EUR equivalent at time of contribution (used for cross-chain totals). */
  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  amountEur!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amountUsd!: number | null; // USD equivalent at time of contribution

  @CreateDateColumn()
  contributedAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'boolean', default: false })
  isRefunded!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  refundedAt!: Date;

  @Column({ type: 'varchar', length: 66, nullable: true })
  refundTxHash!: string;
}
