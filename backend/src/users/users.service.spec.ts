import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Wallet } from '../entities/wallet.entity';

describe('UsersService (unit, mocked repos)', () => {
  let service: UsersService;
  let usersRepo: Partial<Repository<User>>;
  let walletsRepo: Partial<Repository<Wallet>>;

  beforeEach(async () => {
    // simple in-memory store for users and wallets
    const usersStore: Record<string, any> = {};
    const walletsStore: Record<string, any> = {};

    usersRepo = {
      create: jest.fn().mockImplementation((payload) => ({ id: `u-${Object.keys(usersStore).length + 1}`, ...payload })),
      save: jest.fn().mockImplementation(async (user: any) => {
        usersStore[user.id] = user;
        return user;
      }),
      findOne: jest.fn().mockImplementation(async (opts: any) => {
        if (opts.where?.email) return Object.values(usersStore).find((u: any) => u.email === opts.where.email) || null;
        if (opts.where?.id) return usersStore[opts.where.id] || null;
        return null;
      }),
    };

    walletsRepo = {
      findOne: jest.fn().mockImplementation(async (opts: any) => {
        if (opts.where?.address) return walletsStore[opts.where.address] || null;
        return null;
      }),
      create: jest.fn().mockImplementation((payload) => ({ id: `w-${Object.keys(walletsStore).length + 1}`, ...payload })),
      save: jest.fn().mockImplementation(async (w: any) => {
        walletsStore[w.address] = w;
        return w;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(Wallet), useValue: walletsRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('creates a user and can find by id/email', async () => {
    const created = await service.create({ email: 'a@b.com', name: 'A' });
    expect(created).toHaveProperty('id');
    const byEmail = await service.findByEmail('a@b.com');
    expect(byEmail).toBeDefined();
    expect((byEmail as any).email).toBe('a@b.com');
  });

  it('attaches a wallet and finds by wallet address', async () => {
    const created = await service.create({ email: 'c@d.com' });
    const updated = await service.attachWallet(created.id, '0xabc', '1');
    expect(updated).toBeDefined();
    const byWallet = await service.findByWallet('0xabc');
    expect(byWallet).toBeDefined();
  });
});
