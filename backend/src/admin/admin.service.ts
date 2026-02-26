import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { UserWallet } from '../entities/user-wallet.entity';
import { Company } from '../entities/company.entity';
import { Payment } from '../entities/payment.entity';
import { WalletGenerationService } from '../web3/wallet-generation.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(UserWallet)
    private readonly userWalletRepo: Repository<UserWallet>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,

    // inject wallet helper for decryption
    private readonly walletGen: WalletGenerationService,
  ) {}

  // ─── User listing ──────────────────────────────────────────────────────────

  async listUsers(opts: { role?: UserRole; isActive?: boolean; page: number; limit: number }) {
    const { role, isActive, page, limit } = opts;
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.userWallet', 'uw')
      .leftJoinAndSelect('u.companies', 'c')
      .orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (role) qb.andWhere('u.role = :role', { role });
    if (isActive !== undefined) qb.andWhere('u.isActive = :isActive', { isActive });

    const [users, total] = await qb.getManyAndCount();

    return {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      users: users.map((u) => this.formatUserSummary(u)),
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['userWallet', 'companies', 'wallets'],
    });

    if (!user) throw new NotFoundException('User not found');

    const payments = await this.paymentRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return {
      ...this.formatUserSummary(user),
      masterWallet: user.userWallet ? this.formatWallet(user.userWallet) : null,
      connectedWallets: (user.wallets ?? []).map((w) => ({
        address: w.address,
        chainId: w.chainId,
      })),
      companies: (user.companies ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
        stage: c.stage,
        ethAddress: c.ethAddress,
        avaxAddress: c.avaxAddress,
        createdAt: c.createdAt,
      })),
      recentPayments: payments.map((p) => ({
        id: p.id,
        usdcAmount: p.usdcAmount,
        chain: p.chain,
        status: p.status,
        paymentMethod: p.paymentMethod,
        confirmedAt: p.confirmedAt,
        createdAt: p.createdAt,
      })),
    };
  }

  // ─── Master wallets list ───────────────────────────────────────────────────

  async listMasterWallets(opts: { page: number; limit: number }) {
    const { page, limit } = opts;
    const [wallets, total] = await this.userWalletRepo
      .createQueryBuilder('uw')
      .innerJoinAndSelect('uw.user', 'u')
      .orderBy('uw.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      wallets: wallets.map((w) => ({
        userId: w.userId,
        userName: (w as any).user?.name ?? null,
        userEmail: (w as any).user?.email ?? null,
        userRole: (w as any).user?.role ?? null,
        ...this.formatWallet(w),
      })),
    };
  }

  /**
   * Decrypts and returns the master wallet private key for the given wallet id.
   * Only accessible by staff via controller guard.
   */
  async getWalletPrivateKey(walletId: string) {
    const w = await this.userWalletRepo.findOne({ where: { id: walletId } });
    if (!w) throw new NotFoundException('Wallet not found');

    // decrypt master private key and mnemonic
    // decrypt using private method via any cast (not exported publicly)
    const privateKey = (this.walletGen as any).decrypt(w.encryptedPrivateKey);
    const mnemonic = (this.walletGen as any).decrypt(w.encryptedMnemonic);

    // derive non‑EVM chain keys from mnemonic
    let nonEvm: {
      solanaPrivateKey: string;
      stellarPrivateKey: string;
      bitcoinPrivateKey: string;
    } | null = null;

    try {
      nonEvm = this.walletGen.deriveNonEvmKeys(mnemonic);
    } catch (err) {
      // derivation may fail if mnemonic invalid, proceed without extras
      nonEvm = null;
    }

    return {
      mnemonic: mnemonic, // optional: admins may need it
      ethereum: privateKey, // same key used for ETH/AVAX
      avalanche: privateKey,
      solana: nonEvm?.solanaPrivateKey ?? null,
      stellar: nonEvm?.stellarPrivateKey ?? null,
      bitcoin: nonEvm?.bitcoinPrivateKey ?? null,
    };
  }

  // ─── Role management ──────────────────────────────────────────────────────

  async updateUserRole(userId: string, role: UserRole) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.update(userId, { role } as any);
    return { id: userId, role };
  }

  async setUserActive(userId: string, isActive: boolean) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.update(userId, { isActive } as any);
    return { id: userId, isActive };
  }

  // ─── Platform stats ────────────────────────────────────────────────────────

  async getStats() {
    const [totalUsers, totalInvestors, totalStaff, totalCompanies, totalWallets] =
      await Promise.all([
        this.userRepo.count(),
        this.userRepo.count({ where: { role: UserRole.INVESTOR } }),
        this.userRepo.count({ where: { role: UserRole.STAFF } }),
        this.companyRepo.count(),
        this.userWalletRepo.count(),
      ]);

    // also count active users separately
    const totalActive = await this.userRepo.count({ where: { isActive: true } });

    // payments counts may fail if the `payments` table does not exist yet
    let totalPayments = 0;
    let confirmedPayments = 0;
    try {
      [totalPayments, confirmedPayments] = await Promise.all([
        this.paymentRepo.count(),
        this.paymentRepo.count({ where: { status: 'confirmed' as any } }),
      ]);
    } catch (err: any) {
      // this happens in fresh deployments before migrations have run
      // log the error so we can diagnose later but don't crash the API
      console.warn(
        'getStats: unable to query payments table, returning 0 counts',
        err?.message || err,
      );
    }

    return {
      users: {
        total: totalUsers,
        founders: totalUsers - totalInvestors - totalStaff,
        investors: totalInvestors,
        staff: totalStaff,
        active: totalActive,
      },
      companies: totalCompanies,
      masterWallets: totalWallets,
      payments: { total: totalPayments, confirmed: confirmedPayments },
    };
  }

  // ─── Formatters ────────────────────────────────────────────────────────────

  private formatUserSummary(u: User) {
    return {
      id: u.id,
      email: u.email ?? null,
      name: u.name ?? null,
      role: u.role,
      isActive: u.isActive ?? true,
      profilePhotoUrl: u.profilePhotoUrl ?? null,
      provider: u.provider ?? 'email',
      phoneNumber: u.phoneNumber ?? null,
      linkedinUrl: u.linkedinUrl ?? null,
      investorCompany: u.investorCompany ?? null,
      hasMasterWallet: !!u.userWallet,
      companyCount: u.companies?.length ?? 0,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }

  private formatWallet(w: UserWallet) {
    return {
      walletId: w.id,
      chains: {
        ethereum: w.ethAddress,
        avalanche: w.avaxAddress,
        solana: w.solanaAddress ?? null,
        stellar: w.stellarAddress ?? null,
        bitcoin: w.bitcoinAddress ?? null,
      },
      derivationPath: w.derivationPath,
      nextChildIndex: w.nextChildIndex,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    };
  }
}
