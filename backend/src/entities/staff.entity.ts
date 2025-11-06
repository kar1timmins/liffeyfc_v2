import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';

/**
 * Staff Entity
 * 
 * Represents Liffey Founders Club staff members who can:
 * - Manage events
 * - Review applications
 * - Access admin dashboard
 * - Manage content
 */
@Entity({ name: 'staff' })
export class Staff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar' })
  passwordHash: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', default: 'staff' })
  role: string; // 'admin' | 'staff' | 'moderator'

  @Column({ type: 'varchar', nullable: true })
  department?: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', nullable: true })
  phoneNumber?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => RefreshToken, (token) => token.staff, { cascade: true })
  refreshTokens: RefreshToken[];
}
