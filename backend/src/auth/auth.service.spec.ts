import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { NonceService } from '../web3/nonce.service';
import { Web3Service } from '../web3/web3.service';
import { Repository } from 'typeorm';

// Jest manual mocks / helpers
const makeRefreshRepo = () => ({
  create: jest.fn().mockImplementation((v) => v),
  save: jest.fn().mockResolvedValue(true),
  find: jest.fn().mockResolvedValue([]),
  delete: jest.fn().mockResolvedValue(true),
});

describe('AuthService (unit)', () => {
  let auth: AuthService;
  let usersService: Partial<UsersService>;
  let nonceService: Partial<NonceService>;
  let web3: Partial<Web3Service>;
  let refreshRepo: Partial<Repository<any>>;

  beforeAll(() => {
    // Set JWT_SECRET for tests
    process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-minimum-32-bytes-long';
  });

  beforeEach(() => {
    usersService = {
      findByWallet: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'new-user-id' }),
      attachWallet: jest.fn().mockResolvedValue({ id: 'new-user-id', wallets: [{ address: '0x1' }] }),
    };

    nonceService = {
      create: jest.fn(),
      get: jest.fn(),
      use: jest.fn(),
    };

    web3 = {
      generateSignInMessage: jest.fn((a) => `message-${a}`),
      verifySignature: jest.fn(async (dto) => ({ isValid: true, address: dto.address, message: dto.message })),
    };

    refreshRepo = makeRefreshRepo();

    auth = new AuthService(usersService as any, web3 as any, nonceService as any, refreshRepo as any);
  });

  it('generates and stores SIWE message', async () => {
    const res = await auth.getSiweMessage('0xabc');
    expect(res).toHaveProperty('message');
    expect(nonceService.create).toHaveBeenCalledWith('0xabc', expect.any(String));
  });

  it('verifies SIWE happy path - creates user when not exists', async () => {
    (nonceService.get as jest.Mock).mockReturnValue({ message: 'message-0xabc', expiresAt: Date.now() + 10000 });
    (web3.verifySignature as jest.Mock).mockResolvedValue({ isValid: true });

    const res = await auth.verifySiwe('0xabc', 'sig');
    expect(nonceService.use).toHaveBeenCalledWith('0xabc');
    expect(usersService.create).toHaveBeenCalled();
    expect(usersService.attachWallet).toHaveBeenCalled();
    expect(res).toHaveProperty('token');
    expect(res.user).toBeDefined();
  });

  it('verifies SIWE fails with missing nonce', async () => {
    (nonceService.get as jest.Mock).mockReturnValue(null);
    await expect(auth.verifySiwe('0xabc', 'sig')).rejects.toThrow('No active SIWE message found or message expired');
  });

  it('verifies SIWE fails with invalid signature', async () => {
    (nonceService.get as jest.Mock).mockReturnValue({ message: 'message-0xabc', expiresAt: Date.now() + 10000 });
    (web3.verifySignature as jest.Mock).mockResolvedValue({ isValid: false });
    await expect(auth.verifySiwe('0xabc', 'bad-sig')).rejects.toThrow('Invalid signature');
  });

  it('prevents replay: using nonce twice should fail on second use', async () => {
    // first call - good
    (nonceService.get as jest.Mock).mockReturnValue({ message: 'message-0xabc', expiresAt: Date.now() + 10000 });
    (web3.verifySignature as jest.Mock).mockResolvedValue({ isValid: true });
    const first = await auth.verifySiwe('0xabc', 'sig');
    expect(first).toHaveProperty('token');

    // simulate that nonce was consumed
    (nonceService.get as jest.Mock).mockReturnValue(null);
    await expect(auth.verifySiwe('0xabc', 'sig')).rejects.toThrow('No active SIWE message found or message expired');
  });
});
