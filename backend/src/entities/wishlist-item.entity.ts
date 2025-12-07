import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Company } from './company.entity';

export enum WishlistCategory {
  FUNDING = 'funding',
  TALENT = 'talent',
  MENTORSHIP = 'mentorship',
  PARTNERSHIPS = 'partnerships',
  RESOURCES = 'resources',
  TECHNOLOGY = 'technology',
  MARKETING = 'marketing',
  OTHER = 'other'
}

export enum WishlistPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

@Entity({ name: 'wishlist_items' })
export class WishlistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  value?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amountRaised: number;

  @Column({ type: 'enum', enum: WishlistCategory, default: WishlistCategory.OTHER })
  category: WishlistCategory;

  @Column({ type: 'enum', enum: WishlistPriority, default: WishlistPriority.MEDIUM })
  priority: WishlistPriority;

  @Column({ type: 'boolean', default: false })
  isFulfilled: boolean;

  // Smart contract escrow fields
  @Column({ type: 'varchar', length: 42, nullable: true })
  ethereumEscrowAddress?: string;

  @Column({ type: 'varchar', length: 42, nullable: true })
  avalancheEscrowAddress?: string;

  @Column({ type: 'timestamp', nullable: true })
  campaignDeadline?: Date;

  @Column({ type: 'int', nullable: true })
  campaignDurationDays?: number;

  @Column({ type: 'boolean', default: false })
  isEscrowActive: boolean;

  @Column({ type: 'boolean', default: false })
  isEscrowFinalized: boolean;

  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.wishlistItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @CreateDateColumn()
  createdAt: Date;
}
