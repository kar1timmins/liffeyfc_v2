import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Wallet } from '../entities/wallet.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Wallet)
    private walletsRepo: Repository<Wallet>,
  ) {}

  async create(payload: Partial<User>): Promise<User> {
    const user = this.usersRepo.create(payload as any);
    const saved = await this.usersRepo.save(user as any);
    return Array.isArray(saved) ? (saved[0] as User) : (saved as User);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id }, relations: ['wallets'] });
  }

  async findByWallet(address: string): Promise<User | null> {
    const wallet = await this.walletsRepo.findOne({ where: { address } , relations: ['user']});
    return wallet ? wallet.user : null;
  }

  async update(id: string, payload: Partial<User>): Promise<User | null> {
    await this.usersRepo.update(id, payload as any);
    return this.findById(id);
  }

  async attachWallet(userId: string, address: string, chainId?: string): Promise<User | null> {
    const user = await this.findById(userId);
    if (!user) return null;
    const existing = await this.walletsRepo.findOne({ where: { address } });
    if (!existing) {
      const newWallet = this.walletsRepo.create({ address, chainId, user } as any);
      await this.walletsRepo.save(newWallet);
    } else if (!existing.user) {
      existing.user = user as any;
      await this.walletsRepo.save(existing);
    }
    return this.findById(userId);
  }
}
