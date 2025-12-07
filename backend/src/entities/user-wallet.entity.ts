import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * UserWallet Entity
 * 
 * Stores the master HD wallet for a user
 * Each user can only have ONE master wallet
 * Company wallets are derived from this master wallet
 */
@Entity({ name: 'user_wallets' })
export class UserWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'varchar', length: 42, unique: true })
  ethAddress: string;

  @Column({ type: 'varchar', length: 42, unique: true })
  avaxAddress: string;

  // Encrypted mnemonic phrase (12 or 24 words) - CRITICAL: Must be encrypted at rest
  @Column({ type: 'text' })
  encryptedMnemonic: string;

  // Encrypted private key - redundancy for recovery
  @Column({ type: 'text' })
  encryptedPrivateKey: string;

  // Derivation path used (e.g., "m/44'/60'/0'/0/0" for Ethereum)
  @Column({ type: 'varchar' })
  derivationPath: string;

  // Track next child index for company wallet derivation
  @Column({ type: 'int', default: 0 })
  nextChildIndex: number;

  @OneToOne(() => User, (user) => user.userWallet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
