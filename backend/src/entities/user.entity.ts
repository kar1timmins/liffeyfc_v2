import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Wallet } from './wallet.entity';
import { RefreshToken } from './refresh-token.entity';

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

  @OneToMany(() => Wallet, (w: Wallet) => w.user, { cascade: true })
  wallets?: Wallet[];

  @OneToMany(() => RefreshToken, (r: RefreshToken) => r.user, { cascade: true })
  refreshTokens?: RefreshToken[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
