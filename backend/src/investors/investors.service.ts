import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Investor } from '../entities/investor.entity';
import { User } from '../entities/user.entity';
import { Wallet } from '../entities/wallet.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { CreateInvestorDto } from './dto/create-investor.dto';
import { UpgradeToInvestorDto } from './dto/upgrade-to-investor.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class InvestorsService {
  constructor(
    @InjectRepository(Investor)
    private investorRepository: Repository<Investor>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  /**
   * Create a new investor
   */
  async create(createInvestorDto: CreateInvestorDto): Promise<Investor> {
    const { email, password, ...rest } = createInvestorDto;

    // Check if investor already exists
    const existing = await this.investorRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Investor with this email already exists');
    }

    // Hash password if provided
    let passwordHash: string | undefined;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const investor = this.investorRepository.create({
      email,
      passwordHash,
      ...rest,
    });

    return this.investorRepository.save(investor);
  }

  /**
   * Find investor by ID
   */
  async findById(id: string): Promise<Investor | null> {
    return this.investorRepository.findOne({
      where: { id },
      relations: ['wallets'],
    });
  }

  /**
   * Find investor by email
   */
  async findByEmail(email: string): Promise<Investor | null> {
    return this.investorRepository.findOne({
      where: { email },
      relations: ['wallets'],
    });
  }

  /**
   * Find investor by OAuth provider
   */
  async findByProvider(provider: string, providerId: string): Promise<Investor | null> {
    return this.investorRepository.findOne({
      where: { provider, providerId },
      relations: ['wallets'],
    });
  }

  /**
   * Create or update investor from OAuth
   */
  async createOrUpdateFromOAuth(
    provider: string,
    providerId: string,
    email: string,
    name?: string,
  ): Promise<Investor> {
    let investor = await this.findByProvider(provider, providerId);

    if (investor) {
      // Update existing investor
      investor.email = email;
      if (name) investor.name = name;
      return this.investorRepository.save(investor);
    }

    // Check if investor exists with this email
    investor = await this.findByEmail(email);
    if (investor) {
      // Link OAuth to existing investor
      investor.provider = provider;
      investor.providerId = providerId;
      return this.investorRepository.save(investor);
    }

    // Create new investor
    investor = this.investorRepository.create({
      email,
      name,
      provider,
      providerId,
    });

    return this.investorRepository.save(investor);
  }

  /**
   * Update investor profile
   */
  async update(id: string, updateData: Partial<Investor>): Promise<Investor> {
    const investor = await this.findById(id);
    if (!investor) {
      throw new NotFoundException('Investor not found');
    }

    Object.assign(investor, updateData);
    return this.investorRepository.save(investor);
  }

  /**
   * Delete investor
   */
  async remove(id: string): Promise<void> {
    await this.investorRepository.delete(id);
  }

  /**
   * Upgrade a user to investor status
   * This migrates user data to the investor table and transfers wallets and refresh tokens
   */
  async upgradeUserToInvestor(
    userId: string,
    upgradeData: UpgradeToInvestorDto,
  ): Promise<Investor> {
    // Find the user
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['wallets'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.email) {
      throw new ConflictException('User must have an email address to upgrade to investor');
    }

    // Check if investor already exists with this email
    const existingInvestor = await this.findByEmail(user.email);
    if (existingInvestor) {
      throw new ConflictException('An investor account already exists with this email');
    }

    // Create new investor with user's data
    const investor = this.investorRepository.create({
      email: user.email,
      passwordHash: user.passwordHash,
      name: user.name,
      provider: user.provider,
      providerId: user.providerId,
      company: upgradeData.company,
      investmentFocus: upgradeData.investmentFocus,
      linkedinUrl: upgradeData.linkedinUrl,
      isAccredited: upgradeData.isAccredited,
    });

    const savedInvestor = await this.investorRepository.save(investor);

    // Transfer wallets from user to investor
    if (user.wallets && user.wallets.length > 0) {
      for (const wallet of user.wallets) {
        wallet.user = null as any;
        wallet.investor = savedInvestor as any;
        await this.walletRepository.save(wallet);
      }
    }

    // Transfer refresh tokens from user to investor
    const userTokens = await this.refreshTokenRepository.find({
      where: { user: { id: userId } },
    });

    for (const token of userTokens) {
      token.user = null as any;
      token.investor = savedInvestor as any;
      token.userType = 'investor';
      await this.refreshTokenRepository.save(token);
    }

    // Delete the old user account
    await this.userRepository.delete(userId);

    return savedInvestor;
  }
}
