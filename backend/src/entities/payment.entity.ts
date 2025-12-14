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

export enum PaymentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  DEPLOYED = 'deployed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentChain {
  ETHEREUM = 'ethereum',
  AVALANCHE = 'avalanche',
}

/**
 * Entity to track USDC payments for contract deployments
 * Users pay in testnet USDC to cover gas costs for escrow contract deployments
 */
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  wishlistItemId: string;

  @ManyToOne(() => WishlistItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wishlistItemId' })
  wishlistItem: WishlistItem;

  /**
   * USDC payment transaction hash from user
   */
  @Column({ type: 'varchar', length: 66, nullable: true })
  usdcTxHash: string | null;

  /**
   * Amount paid in USDC (6 decimals)
   */
  @Column({ type: 'decimal', precision: 18, scale: 6 })
  usdcAmount: number;

  /**
   * Chain where USDC payment was made
   */
  @Column({
    type: 'enum',
    enum: PaymentChain,
  })
  chain: PaymentChain;

  /**
   * User's wallet address that sent USDC
   */
  @Column({ type: 'varchar', length: 42, nullable: true })
  fromAddress: string | null;

  /**
   * Platform's wallet address that received USDC
   */
  @Column({ type: 'varchar', length: 42, nullable: true })
  toAddress: string | null;

  /**
   * Payment method used
   */
  @Column({
    type: 'varchar',
    length: 32,
    default: 'usdc',
  })
  paymentMethod: 'usdc' | 'master-wallet' | 'traditional';

  /**
   * Payment and deployment status
   */
  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  /**
   * When payment was confirmed on-chain
   */
  @Column({ type: 'timestamp', nullable: true })
  confirmedAt?: Date;

  /**
   * When contracts were successfully deployed
   */
  @Column({ type: 'timestamp', nullable: true })
  deployedAt?: Date;

  /**
   * Error message if deployment failed
   */
  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  /**
   * Chains to deploy contracts on (stored as JSON array)
   */
  @Column({ type: 'simple-json', nullable: true })
  deploymentChains?: string[];

  /**
   * Deployed contract addresses (stored as JSON)
   */
  @Column({ type: 'simple-json', nullable: true })
  deployedContracts?: {
    ethereum?: string;
    avalanche?: string;
  };

  /**
   * Deployment transaction hashes (stored as JSON)
   */
  @Column({ type: 'simple-json', nullable: true })
  deploymentTxHashes?: {
    ethereum?: string;
    avalanche?: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}