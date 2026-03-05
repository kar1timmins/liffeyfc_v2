import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { UserWallet } from '../entities/user-wallet.entity';
import { Company } from '../entities/company.entity';
import { Payment } from '../entities/payment.entity';
import { Contribution } from '../entities/contribution.entity';
import { WishlistItem } from '../entities/wishlist-item.entity';
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

    @InjectRepository(Contribution)
    private readonly contributionRepo: Repository<Contribution>,

    @InjectRepository(WishlistItem)
    private readonly wishlistRepo: Repository<WishlistItem>,

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

  // ─── Transaction graph ─────────────────────────────────────────────────────

  /**
   * Returns a unified view of all contributions (investor→bounty) and
   * payment/deployments (founder→escrow setup) suitable for graph rendering.
   * `graph` is always un-paginated (capped at 500 rows) for the SVG.
   * `rows` is the paginated flat list for the table.
   */
  async getTransactions(opts: {
    page: number;
    limit: number;
    type?: 'contribution' | 'deployment' | '';
  }) {
    const { page, limit, type } = opts;

    // ── Contributions ─────────────────────────────────────────────────────
    const contribRows: any[] = [];
    if (!type || type === 'contribution') {
      const contribs = await this.contributionRepo
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.user', 'u')
        .leftJoinAndSelect('c.wishlistItem', 'wi')
        .leftJoinAndSelect('wi.company', 'co')
        .leftJoinAndSelect('co.owner', 'owner')
        .orderBy('c.contributedAt', 'DESC')
        .take(500)
        .getMany();

      for (const c of contribs) {
        contribRows.push({
          type: 'contribution',
          id: c.id,
          date: c.contributedAt,
          chain: c.chain,
          txHash: c.transactionHash ?? null,
          amountEur: c.amountEur ? parseFloat(c.amountEur as any) : null,
          nativeAmount: c.nativeAmount ? parseFloat(c.nativeAmount as any) : null,
          currencySymbol: c.currencySymbol ?? null,
          amountEth: c.amountEth ? parseFloat(c.amountEth as any) : null,
          isRefunded: c.isRefunded,
          contributor: {
            id: c.user?.id ?? null,
            name: c.user?.name ?? null,
            email: c.user?.email ?? null,
            role: c.user?.role ?? 'user',
            address: c.contributorAddress,
          },
          wishlistItem: {
            id: c.wishlistItem?.id ?? c.wishlistItemId,
            title: c.wishlistItem?.title ?? 'Unknown',
          },
          company: {
            id: (c.wishlistItem as any)?.company?.id ?? null,
            name: (c.wishlistItem as any)?.company?.name ?? 'Unknown',
            ownerId: (c.wishlistItem as any)?.company?.ownerId ?? null,
            ownerName: (c.wishlistItem as any)?.company?.owner?.name ?? null,
          },
        });
      }
    }

    // ── Deployments (payments) ────────────────────────────────────────────
    const deployRows: any[] = [];
    if (!type || type === 'deployment') {
      let deployments: Payment[] = [];
      try {
        deployments = await this.paymentRepo
          .createQueryBuilder('p')
          .leftJoinAndSelect('p.user', 'u')
          .leftJoinAndSelect('p.wishlistItem', 'wi')
          .leftJoinAndSelect('wi.company', 'co')
          .orderBy('p.createdAt', 'DESC')
          .take(500)
          .getMany();
      } catch {
        // payments table may not exist in older deployments
      }

      for (const p of deployments) {
        deployRows.push({
          type: 'deployment',
          id: p.id,
          date: p.createdAt,
          chain: p.chain,
          status: p.status,
          amountUsdc: p.usdcAmount ? parseFloat(p.usdcAmount as any) : null,
          deploymentChains: p.deploymentChains ?? [],
          deployedContracts: p.deployedContracts ?? {},
          deployer: {
            id: p.user?.id ?? p.userId,
            name: p.user?.name ?? null,
            email: p.user?.email ?? null,
            role: p.user?.role ?? 'user',
          },
          wishlistItem: {
            id: p.wishlistItem?.id ?? p.wishlistItemId,
            title: p.wishlistItem?.title ?? 'Unknown',
          },
          company: {
            id: (p.wishlistItem as any)?.company?.id ?? null,
            name: (p.wishlistItem as any)?.company?.name ?? 'Unknown',
          },
        });
      }
    }

    // ── Merge, sort, paginate ─────────────────────────────────────────────
    const all = [...contribRows, ...deployRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const total = all.length;
    const rows = all.slice((page - 1) * limit, page * limit);

    // ── Build graph nodes + edges (capped at 150 rows for performance) ────
    const graphRows = all.slice(0, 150);
    const nodeMap = new Map<string, object>();
    const edges: object[] = [];

    for (const row of graphRows) {
      const actorId =
        row.type === 'contribution'
          ? `user:${row.contributor.id ?? row.contributor.address}`
          : `user:${row.deployer.id}`;
      const itemId = `item:${row.wishlistItem.id}`;
      const companyId = `company:${row.company.id}`;

      if (!nodeMap.has(actorId)) {
        nodeMap.set(actorId, {
          id: actorId,
          type: row.type === 'contribution' ? 'investor' : 'founder',
          label:
            row.type === 'contribution'
              ? (row.contributor.name ?? row.contributor.address?.slice(0, 8))
              : (row.deployer.name ?? 'Unknown'),
          email:
            row.type === 'contribution'
              ? row.contributor.email
              : row.deployer.email,
          role:
            row.type === 'contribution'
              ? row.contributor.role
              : row.deployer.role,
        });
      }
      if (!nodeMap.has(itemId)) {
        nodeMap.set(itemId, {
          id: itemId,
          type: 'wishlist',
          label: row.wishlistItem.title,
          companyName: row.company.name,
        });
      }
      if (row.company.id && !nodeMap.has(companyId)) {
        nodeMap.set(companyId, {
          id: companyId,
          type: 'company',
          label: row.company.name,
          ownerId: row.company.ownerId ?? null,
          ownerName: row.company.ownerName ?? null,
        });
      }

      if (row.company.id) {
        if (row.type === 'deployment') {
          // founder/deployer → company edge
          edges.push({
            from: actorId,
            to: companyId,
            type: 'deployment',
            label: `$${(row.amountUsdc ?? 0).toFixed(2)} USDC`,
            chain: row.chain,
            status: row.status ?? null,
            date: row.date,
          });

          // ownership: company → item
          const ownershipKey = `owns:${companyId}:${itemId}`;
          if (!edges.find((e: any) => e._key === ownershipKey)) {
            edges.push({
              _key: ownershipKey,
              from: companyId,
              to: itemId,
              type: 'ownership',
              label: '',
            });
          }
        } else {
          // contribution: actor → item directly
          edges.push({
            from: actorId,
            to: itemId,
            type: 'contribution',
            label:
              row.amountEur != null
                ? `€${row.amountEur.toFixed(0)}`
                : row.amountEth != null
                  ? `${row.amountEth.toFixed(4)} ${row.currencySymbol ?? ''}`
                  : '',
            chain: row.chain,
            status: row.status ?? null,
            date: row.date,
          });

          }
      } else {
        // no company; fallback actor → item
        edges.push({
          from: actorId,
          to: itemId,
          type: row.type,
          label:
            row.type === 'contribution'
              ? row.amountEur != null
                ? `€${row.amountEur.toFixed(0)}`
                : row.amountEth != null
                  ? `${row.amountEth.toFixed(4)} ${row.currencySymbol ?? ''}`
                  : ''
              : `$${(row.amountUsdc ?? 0).toFixed(2)} USDC`,
          chain: row.chain,
          status: row.status ?? null,
          date: row.date,
        });
      }
    }

    return {
      graph: { nodes: Array.from(nodeMap.values()), edges },
      rows,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
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
