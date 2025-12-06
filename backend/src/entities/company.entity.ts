import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { WishlistItem } from './wishlist-item.entity';
import { CompanyWallet } from './company-wallet.entity';

export enum CompanyStage {
  IDEA = 'idea',
  MVP = 'mvp',
  EARLY_STAGE = 'early_stage',
  GROWTH = 'growth',
  SCALE = 'scale',
  ESTABLISHED = 'established'
}

export enum FundingStage {
  BOOTSTRAPPED = 'bootstrapped',
  PRE_SEED = 'pre_seed',
  SEED = 'seed',
  SERIES_A = 'series_a',
  SERIES_B = 'series_b',
  SERIES_C_PLUS = 'series_c_plus'
}

@Entity({ name: 'companies' })
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  industry?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website?: string;

  @Column({ type: 'int', default: 1 })
  employeeCount: number;

  @Column({ type: 'enum', enum: CompanyStage, default: CompanyStage.IDEA })
  stage: CompanyStage;

  @Column({ type: 'enum', enum: FundingStage, default: FundingStage.BOOTSTRAPPED })
  fundingStage: FundingStage;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location?: string;

  @Column({ type: 'date', nullable: true })
  foundedDate?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  logoUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  linkedinUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  twitterUrl?: string;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ type: 'varchar', length: 42, nullable: true })
  ethAddress?: string;

  @Column({ type: 'varchar', length: 42, nullable: true })
  avaxAddress?: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: true })
  isPublic: boolean;

  @Column({ type: 'uuid' })
  ownerId: string;

  @ManyToOne(() => User, (user) => user.companies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @OneToMany(() => WishlistItem, (item) => item.company)
  wishlistItems: WishlistItem[];

  @OneToOne(() => CompanyWallet, (w: CompanyWallet) => w.company, { cascade: true })
  companyWallet?: CompanyWallet;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
