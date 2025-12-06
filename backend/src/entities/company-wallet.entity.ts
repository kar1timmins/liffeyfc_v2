import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Company } from './company.entity';
import { UserWallet } from './user-wallet.entity';

/**
 * CompanyWallet Entity
 * 
 * Stores derived child wallets for companies
 * Each company wallet is derived from the user's master wallet
 * Maintains the hierarchical relationship
 */
@Entity({ name: 'company_wallets' })
export class CompanyWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  companyId: string;

  @Column({ type: 'uuid' })
  parentWalletId: string;

  @Column({ type: 'varchar', length: 42, unique: true })
  ethAddress: string;

  @Column({ type: 'varchar', length: 42, unique: true })
  avaxAddress: string;

  // Encrypted private key for this child wallet
  @Column({ type: 'text' })
  encryptedPrivateKey: string;

  // Derivation path from parent (e.g., "m/44'/60'/0'/0/1" for first company)
  @Column({ type: 'varchar' })
  derivationPath: string;

  // Index in the derivation path
  @Column({ type: 'int' })
  childIndex: number;

  @OneToOne(() => Company, (c) => c.companyWallet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @ManyToOne(() => UserWallet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentWalletId' })
  parentWallet: UserWallet;

  @CreateDateColumn()
  createdAt: Date;
}
