import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.entity';

@Entity({ name: 'wallets' })
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  address: string;

  @Column({ type: 'varchar', nullable: true })
  chainId?: string;

  @ManyToOne(() => User, (u) => u.wallets, { onDelete: 'CASCADE' })
  user: User;
}
