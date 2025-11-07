import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { Web3Service } from '../web3/web3.service';
import { NonceService } from '../web3/nonce.service';
import { SecurityMonitoringService, SecurityEventType } from './security-monitoring.service';
import { signJwt } from './jwt.util';
import { UserRole } from '../entities/user.entity';
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
    private securityMonitoring: SecurityMonitoringService,
    @InjectRepository(RefreshToken)
    private refreshRepo: Repository<RefreshToken>,
  ) {}

  async register(email: string, password: string, name?: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new Error('Email exists');
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({ email, passwordHash, name });
    const accessToken = signJwt(user.id, user.role);
    // create refresh token
    const refresh = await this.createRefreshTokenForUser(user);
    return { user, accessToken, refreshToken: refresh };
  }

  async login(email: string, password: string) {
    // Find user by email (single table with roles)
    const user = await this.usersService.findByEmail(email);
    
    if (!user) throw new Error('Invalid credentials');
    
    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) throw new Error('Invalid credentials');
    
    const accessToken = signJwt(user.id, user.role);
    const refresh = await this.createRefreshTokenForUser(user);
    return { user, accessToken, refreshToken: refresh };
  }

  async refresh(refreshToken: string) {
    // Expect token format: <id>.<secret>
    const parts = (refreshToken || '').split('.');
    if (parts.length !== 2) throw new Error('Invalid refresh token format');
    const id = parts[0];
    const secret = parts[1];

    const t = await this.refreshRepo.findOne({ 
      where: { id }, 
      relations: ['user'] 
    });
    if (!t) throw new Error('Invalid refresh token');
    
    // REUSE DETECTION: If token is already revoked, check if it was replaced
    if (t.revoked) {
      // If this token was replaced (part of token rotation), this is token reuse
      // This indicates potential token theft - revoke entire token family
      if (t.replacedByTokenId) {
        await this.revokeTokenFamily(t);
        throw new Error('SECURITY_ALERT: Refresh token reuse detected. All tokens revoked. Please login again.');
      }
      throw new Error('Refresh token revoked');
    }
    
    if (t.expiresAt <= Date.now()) {
      // expired - revoke
      await this.refreshRepo.update(t.id, { revoked: true, revokedAt: new Date() } as any);
      throw new Error('Refresh token expired');
    }

    const match = await bcrypt.compare(secret, t.tokenHash);
    if (!match) throw new Error('Invalid refresh token');

    // Get the user entity
    const userEntity = t.user;
    
    if (!userEntity) throw new Error('Invalid token: no user associated');

    // Transactional rotate: create new token and mark old as revoked/replaced
    const newRaw = uuidv4();
    const newHash = await bcrypt.hash(newRaw, 10);
    const expiresAt = Date.now() + 2 * 60 * 60 * 1000; // 2 hours (more secure than days)
    let newSavedId: string | null = null;

    await this.refreshRepo.manager.transaction(async (manager) => {
      const newRt = manager.create(RefreshToken as any, { 
        tokenHash: newHash, 
        expiresAt,
        user: t.user,
      } as any);
      const saved: any = await manager.save(newRt as any);
      newSavedId = saved.id;
      await manager.update(RefreshToken as any, t.id, { revoked: true, revokedAt: new Date(), replacedByTokenId: saved.id } as any);
    });

    const accessToken = signJwt(userEntity.id, userEntity.role);
    return { user: userEntity, accessToken, refreshToken: `${newSavedId}.${newRaw}` };
  }

  /**
   * Revoke Token Family (Reuse Detection)
   * 
   * When a refresh token that was already used (and replaced) is submitted again,
   * this indicates potential token theft. We revoke the entire token family:
   * 1. The reused token (already revoked)
   * 2. All descendant tokens (tokens created from the reused token)
   * 
   * This forces the user to re-authenticate, invalidating both the attacker's
   * and the legitimate user's tokens.
   * 
   * Token Family Chain:
   * TokenA (revoked, replacedBy: TokenB)
   *   └─> TokenB (revoked, replacedBy: TokenC)
   *         └─> TokenC (active)
   * 
   * If TokenA is reused → revoke TokenB, TokenC, and all descendants
   */
  private async revokeTokenFamily(reusedToken: RefreshToken): Promise<void> {
    const tokensToRevoke: string[] = [];
    
    // Start with the token that replaced the reused token
    let currentTokenId = reusedToken.replacedByTokenId;
    
    // Traverse the token family chain
    while (currentTokenId) {
      tokensToRevoke.push(currentTokenId);
      
      // Find the next token in the chain
      const nextToken = await this.refreshRepo.findOne({
        where: { id: currentTokenId },
        select: ['id', 'replacedByTokenId', 'revoked']
      });
      
      if (!nextToken) break;
      
      // Move to the next token in the chain
      currentTokenId = nextToken.replacedByTokenId;
      
      // Safety check: prevent infinite loops (shouldn't happen, but be safe)
      if (tokensToRevoke.length > 100) {
        console.error('Token family chain too long (>100). Possible circular reference.');
        break;
      }
    }
    
    // Revoke all tokens in the family
    if (tokensToRevoke.length > 0) {
      await this.refreshRepo.update(
        tokensToRevoke,
        { revoked: true, revokedAt: new Date() } as any
      );
      
      // Log security event
      this.securityMonitoring.logEvent({
        type: SecurityEventType.REFRESH_TOKEN_REUSE,
        userId: reusedToken.user?.id || 'unknown',
        email: reusedToken.user?.email || 'unknown',
        ip: 'N/A', // IP not available in service layer
        timestamp: new Date(),
        details: {
          reusedTokenId: reusedToken.id,
          revokedTokenCount: tokensToRevoke.length,
          revokedTokenIds: tokensToRevoke,
          message: `Token reuse detected - revoked ${tokensToRevoke.length} token(s) in family`,
        }
      });
    }
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
    const accessToken = signJwt(user.id, user.role);
    const refreshToken = await this.createRefreshTokenForUser(user);
    return { user, accessToken, refreshToken };
  }

  private async createRefreshTokenForUser(user: any) {
    const secret = uuidv4();
    const hash = await bcrypt.hash(secret, 10);
    const expiresAt = Date.now() + 2 * 60 * 60 * 1000; // 2 hours (more secure than days)
    
    // Create token with user relationship (simplified from polymorphic)
    const tokenData: any = { 
      tokenHash: hash, 
      expiresAt,
      user,
    };
    
    const rt = this.refreshRepo.create(tokenData);
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
    const token = signJwt(user.id, user.role);
    return { user, token };
  }
}