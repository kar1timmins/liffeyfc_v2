import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Wallet } from './wallet.entity';
import { RefreshToken } from './refresh-token.entity';
import { Company } from './company.entity';

/**
 * User Role Enum
 */
export enum UserRole {
  USER = 'user',           // Regular users/founders
  INVESTOR = 'investor',   // Investors/VCs
  STAFF = 'staff',        // LFC staff/admin
}

/**
 * Unified User Entity
 * 
 * Represents all types of users in the system:
 * - Regular users/founders (role: 'user')
 * - Investors/VCs (role: 'investor')
 * - Staff/admins (role: 'staff')
 */
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true, unique: true })
  email?: string;

  @Column({ type: 'varchar', nullable: true })
  passwordHash?: string;

  @Column({ type: 'varchar', nullable: true })
  name?: string;

  @Column({ type: 'varchar', nullable: true })
  profilePhotoUrl?: string;

  // Role determines user type and permissions
  @Column({ 
    type: 'enum', 
    enum: UserRole, 
    default: UserRole.USER 
  })
  role: UserRole;

  // Fields for regular users/founders
  @Column({ type: 'varchar', nullable: true })
  companyName?: string;

  @Column({ type: 'varchar', nullable: true })
  companyWebsite?: string;

  @Column({ type: 'varchar', nullable: true })
  industry?: string;

  // Fields for investors
  @Column({ type: 'varchar', nullable: true })
  investorCompany?: string;

  @Column({ type: 'varchar', nullable: true })
  investmentFocus?: string;

  @Column({ type: 'varchar', nullable: true })
  linkedinUrl?: string;

  @Column({ type: 'boolean', default: false })
  isAccredited?: boolean;

  // Fields for staff
  @Column({ type: 'varchar', nullable: true })
  department?: string;

  @Column({ type: 'varchar', nullable: true })
  phoneNumber?: string;

  @Column({ type: 'boolean', default: true })
  isActive?: boolean;

  // OAuth fields
  @Column({ type: 'varchar', nullable: true })
  provider?: string; // 'google' | 'siwe' | null (for email/password)

  @Column({ type: 'varchar', nullable: true })
  providerId?: string; // OAuth provider ID

  @OneToMany(() => Wallet, (w: Wallet) => w.user, { cascade: true })
  wallets?: Wallet[];

  @OneToMany(() => RefreshToken, (r: RefreshToken) => r.user, { cascade: true })
  refreshTokens?: RefreshToken[];

  @OneToMany(() => Company, (c: Company) => c.owner, { cascade: true })
  companies?: Company[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

