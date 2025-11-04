import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { Web3Service } from '../web3/web3.service';
import { NonceService } from '../web3/nonce.service';
import { signJwt } from './jwt.util';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private web3Service: Web3Service,
    private nonceService: NonceService,
    @InjectRepository(RefreshToken)
    private refreshRepo: Repository<RefreshToken>,
  ) {}

  async register(email: string, password: string, name?: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new Error('Email exists');
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({ email, passwordHash, name });
    const accessToken = signJwt({ sub: user.id });
    // create refresh token
    const refresh = await this.createRefreshTokenForUser(user as any);
    return { user, accessToken, refreshToken: refresh };
  }

  async login(email: string, password: string) {
    const user: any = await this.usersService.findByEmail(email);
    if (!user) throw new Error('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) throw new Error('Invalid credentials');
    const accessToken = signJwt({ sub: user.id });
    const refresh = await this.createRefreshTokenForUser(user as any);
    return { user, accessToken, refreshToken: refresh };
  }

  async refresh(refreshToken: string) {
    // Expect token format: <id>.<secret>
    const parts = (refreshToken || '').split('.');
    if (parts.length !== 2) throw new Error('Invalid refresh token format');
    const id = parts[0];
    const secret = parts[1];

    const t = await this.refreshRepo.findOne({ where: { id }, relations: ['user'] });
    if (!t) throw new Error('Invalid refresh token');
    if (t.revoked) throw new Error('Refresh token revoked');
    if (t.expiresAt <= Date.now()) {
      // expired - revoke
      await this.refreshRepo.update(t.id, { revoked: true, revokedAt: new Date() } as any);
      throw new Error('Refresh token expired');
    }

    const match = await bcrypt.compare(secret, t.tokenHash);
    if (!match) throw new Error('Invalid refresh token');

    // Transactional rotate: create new token and mark old as revoked/replaced
    const newRaw = uuidv4();
    const newHash = await bcrypt.hash(newRaw, 10);
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    let newSavedId: string | null = null;

    await this.refreshRepo.manager.transaction(async (manager) => {
      const newRt = manager.create(RefreshToken as any, { tokenHash: newHash, expiresAt, user: t.user } as any);
      const saved: any = await manager.save(newRt as any);
      newSavedId = saved.id;
      await manager.update(RefreshToken as any, t.id, { revoked: true, revokedAt: new Date(), replacedByTokenId: saved.id } as any);
    });

    const accessToken = signJwt({ sub: t.user.id });
    return { user: t.user, accessToken, refreshToken: `${newSavedId}.${newRaw}` };
  }

  async logout(refreshToken: string) {
    // Revoke by id.secret format
    const parts = (refreshToken || '').split('.');
    if (parts.length !== 2) return { success: false };
    const id = parts[0];
    const secret = parts[1];
    const t = await this.refreshRepo.findOne({ where: { id } });
    if (!t) return { success: false };
    const match = await bcrypt.compare(secret, t.tokenHash);
    if (!match) return { success: false };
    await this.refreshRepo.update(t.id, { revoked: true, revokedAt: new Date() } as any);
    return { success: true };
  }

  async validateOAuthLogin(email: string, provider: string, providerId: string) {
    let user = await this.usersService.findByEmail(email);
    if (!user) {
      // If user does not exist, create a new one
      const newUserDto = {
        email,
        // You might want to add more details from the provider profile
        name: email.split('@')[0],
        provider,
        providerId,
      };
      user = await this.usersService.create(newUserDto);
    } else {
      // If user exists, you might want to link the provider account
      // For simplicity, we'll just ensure the provider info is up-to-date
      if (!user.provider || user.providerId !== providerId) {
        await this.usersService.update(user.id, { provider, providerId });
      }
    }
    const accessToken = signJwt({ sub: user.id });
    const refreshToken = await this.createRefreshTokenForUser(user);
    return { user, accessToken, refreshToken };
  }

  private async createRefreshTokenForUser(user: any) {
    const secret = uuidv4();
    const hash = await bcrypt.hash(secret, 10);
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    const rt = this.refreshRepo.create({ tokenHash: hash, expiresAt, user } as any);
    const saved = await this.refreshRepo.save(rt as any);
    return `${saved.id}.${secret}`;
  }

  async getSiweMessage(address: string) {
    const message = this.web3Service.generateSignInMessage(address);
    // store message in nonce cache for later verification
    this.nonceService.create(address, message);
    return { message };
  }

  async verifySiwe(address: string, signature: string) {
    const stored = await (this.nonceService as any).consume?.(address) || await this.nonceService.get(address);
    if (!stored) throw new Error('No active SIWE message found or message expired');
    const dto = { address, message: stored.message, signature };
    const result = await this.web3Service.verifySignature(dto as any);
    const valid = result?.isValid;
    if (!valid) throw new Error('Invalid signature');
    // If we used get earlier (fallback), ensure we remove it to prevent replay
    if ((this.nonceService as any).consume) {
      // consume already removed it atomically
    } else {
      await this.nonceService.use(address);
    }
    // find or create user and attach wallet
    let user = await this.usersService.findByWallet(address);
    if (!user) {
      // create a new user record then attach wallet
      const created = await this.usersService.create({} as any);
      user = await this.usersService.attachWallet(created.id, address);
    } else {
      user = await this.usersService.attachWallet(user.id, address);
    }
    if (!user) throw new Error('Failed to create or attach wallet to user');
    const token = signJwt({ sub: user.id });
    return { user, token };
  }
}
