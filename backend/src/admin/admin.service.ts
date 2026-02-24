import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { UserWallet } from '../entities/user-wallet.entity';
import { Company } from '../entities/company.entity';
import { Payment } from '../entities/payment.entity';

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

    const [totalPayments, confirmedPayments] = await Promise.all([
      this.paymentRepo.count(),
      this.paymentRepo.count({ where: { status: 'confirmed' as any } }),
    ]);

    return {
      users: {
        total: totalUsers,
        founders: totalUsers - totalInvestors - totalStaff,
        investors: totalInvestors,
        staff: totalStaff,
      },
      companies: { total: totalCompanies },
      wallets: { masterWalletsGenerated: totalWallets },
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
