import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Wallet } from '../entities/wallet.entity';

/**
 * Sanitized user data for public/limited access
 * Only includes safe, non-sensitive fields
 */
export interface SanitizedUser {
  id: string;
  name: string | null;
  profilePhotoUrl?: string;
  role: UserRole;
  linkedinUrl?: string;
  createdAt: Date;
  usdcWalletAddress?: string | null; // including wallet is harmless for sanitized view
}

/**
 * Full user profile data (only for authenticated user accessing their own profile)
 */
export interface FullUserProfile extends SanitizedUser {
  email: string | null;
  investorCompany?: string;
  investmentFocus?: string;
  isAccredited: boolean | null;
  phoneNumber?: string;
  wallets: any[];
  usdcWalletAddress?: string | null; // added so frontend knows about USDC wallet
  updatedAt: Date;
  userType: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Wallet)
    private walletsRepo: Repository<Wallet>,
  ) {}

  /**
   * Sanitize user data for public consumption
   * Removes sensitive fields like email, provider info, phone, etc.
   */
  sanitizeUser(user: User): SanitizedUser {
    return {
      id: user.id,
      name: user.name ?? null,
      profilePhotoUrl: user.profilePhotoUrl,
      role: user.role,
      linkedinUrl: user.linkedinUrl,
      createdAt: user.createdAt,
    };
  }

  /**
   * Get full user profile (for authenticated user accessing their own data)
   * Includes email, wallets, and other private information
   */
  getFullProfile(user: User): FullUserProfile {
    return {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      profilePhotoUrl: user.profilePhotoUrl,
      role: user.role,
      investorCompany: user.investorCompany,
      investmentFocus: user.investmentFocus,
      linkedinUrl: user.linkedinUrl,
      isAccredited: user.isAccredited ?? null,
      phoneNumber: user.phoneNumber,
      wallets: user.wallets || [],
      usdcWalletAddress: user.usdcWalletAddress || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      userType:
        user.role === UserRole.INVESTOR
          ? 'investor'
          : user.role === UserRole.STAFF
            ? 'staff'
            : 'user',
    };
  }

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
    const wallet = await this.walletsRepo.findOne({
      where: { address },
      relations: ['user'],
    });
    return wallet ? (wallet.user ?? null) : null;
  }

  async update(id: string, payload: Partial<User>): Promise<User | null> {
    await this.usersRepo.update(id, payload as any);
    return this.findById(id);
  }

  async updateProfilePhoto(
    userId: string,
    photoUrl: string,
  ): Promise<User | null> {
    await this.usersRepo.update(userId, { profilePhotoUrl: photoUrl } as any);
    return this.findById(userId);
  }

  async attachWallet(
    userId: string,
    address: string,
    chainId?: string,
  ): Promise<User | null> {
    const user = await this.findById(userId);
    if (!user) return null;
    const existing = await this.walletsRepo.findOne({ where: { address } });
    if (!existing) {
      const newWallet = this.walletsRepo.create({
        address,
        chainId,
        user,
      } as any);
      await this.walletsRepo.save(newWallet);
    } else if (!existing.user) {
      existing.user = user as any;
      await this.walletsRepo.save(existing);
    }
    return this.findById(userId);
  }

  /**
   * Upgrade user to investor role
   * Updates role and investor-specific fields
   */
  async upgradeToInvestor(
    userId: string,
    investorData: {
      investorCompany: string;
      investmentFocus: string;
      linkedinUrl?: string;
      isAccredited?: boolean;
    },
  ): Promise<User | null> {
    const user = await this.findById(userId);
    if (!user) throw new Error('User not found');

    // Update role and investor-specific fields
    await this.usersRepo.update(userId, {
      role: UserRole.INVESTOR,
      investorCompany: investorData.investorCompany,
      investmentFocus: investorData.investmentFocus,
      linkedinUrl: investorData.linkedinUrl,
      isAccredited: investorData.isAccredited ?? false,
    } as any);

    return this.findById(userId);
  }

  /**
   * Create staff user
   * Creates user with staff role and staff-specific fields
   */
  async createStaff(staffData: {
    email: string;
    passwordHash: string;
    name: string;
    department: string;
    phoneNumber?: string;
  }): Promise<User> {
    const user = this.usersRepo.create({
      ...staffData,
      role: UserRole.STAFF,
      isActive: true,
    } as any);

    const saved = await this.usersRepo.save(user as any);
    return Array.isArray(saved) ? (saved[0] as User) : (saved as User);
  }

  /**
   * Find users by role
   */
  async findByRole(role: UserRole): Promise<User[]> {
    return this.usersRepo.find({ where: { role } });
  }

  /**
   * Find all investors
   */
  async findInvestors(): Promise<User[]> {
    return this.findByRole(UserRole.INVESTOR);
  }

  /**
   * Find all staff
   */
  async findStaff(): Promise<User[]> {
    return this.findByRole(UserRole.STAFF);
  }

  /**
   * Find users with local profile photos (for migration)
   */
  async findUsersWithLocalPhotos(): Promise<User[]> {
    return this.usersRepo
      .createQueryBuilder('user')
      .where('user.profilePhotoUrl IS NOT NULL')
      .andWhere('user.profilePhotoUrl LIKE :prefix', {
        prefix: '/uploads/avatars/%',
      })
      .getMany();
  }

  /**
   * Get user with fresh signed URL for profile photo
   */
  async findByIdWithFreshSignedUrl(id: string): Promise<User | null> {
    const user = await this.findById(id);
    if (
      user &&
      user.profilePhotoUrl &&
      !user.profilePhotoUrl.startsWith('http')
    ) {
      // This is a file path, not a signed URL - we need to generate one
      // But we can't access GcpStorageService from here
      // This method should be called from the controller where GcpStorageService is available
    }
    return user;
  }

  /**
   * Update password reset token
   */
  async updateResetToken(
    userId: string,
    hashedToken: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.usersRepo.update(userId, {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: expiresAt,
    } as any);
  }

  /**
   * Update password and clear reset token
   */
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.usersRepo.update(userId, {
      passwordHash,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    } as any);
  }

  /**
   * Find all users (for token validation)
   */
  async findAll(): Promise<User[]> {
    return this.usersRepo.find();
  }

  /**
   * Set or update USDC wallet address for a user
   */
  async setUsdcWallet(userId: string, walletAddress: string): Promise<User> {
    // Validate wallet address format (basic check for Ethereum/Avalanche addresses)
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      throw new Error(
        'Invalid wallet address. Must be a valid Ethereum/Avalanche address.',
      );
    }

    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    user.usdcWalletAddress = walletAddress.toLowerCase();
    return this.usersRepo.save(user);
  }

  /**
   * Get USDC wallet address for a user
   */
  async getUsdcWallet(userId: string): Promise<string | null> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    return user.usdcWalletAddress || null;
  }

  /**
   * Remove USDC wallet address for a user
   */
  async removeUsdcWallet(userId: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    user.usdcWalletAddress = undefined;
    await this.usersRepo.save(user);
  }
}
