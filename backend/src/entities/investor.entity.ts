import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Wallet } from './wallet.entity';
import { RefreshToken } from './refresh-token.entity';

/**
 * Investor Entity
 * 
 * Represents investors who can:
 * - View pitch decks
 * - Access investment opportunities
 * - Connect wallets for Web3 features
 * - Manage investment portfolio
 */
@Entity({ name: 'investors' })
export class Investor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  passwordHash?: string;

  @Column({ type: 'varchar', nullable: true })
  name?: string;

  @Column({ type: 'varchar', nullable: true })
  company?: string;

  @Column({ type: 'varchar', nullable: true })
  investmentFocus?: string;

  @Column({ type: 'varchar', nullable: true })
  linkedinUrl?: string;

  @Column({ type: 'boolean', default: false })
  isAccredited: boolean;

  @Column({ type: 'varchar', nullable: true })
  provider?: string; // 'google' | 'siwe' | null (for email/password)

  @Column({ type: 'varchar', nullable: true })
  providerId?: string; // OAuth provider ID

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Wallet, (wallet) => wallet.investor, { cascade: true })
  wallets: Wallet[];

  @OneToMany(() => RefreshToken, (token) => token.investor, { cascade: true })
  refreshTokens: RefreshToken[];
}
