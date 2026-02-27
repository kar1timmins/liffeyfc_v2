import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { User } from '../entities/user.entity';
import { Company } from '../entities/company.entity';
import { CompanyWallet } from '../entities/company-wallet.entity';
import { Contribution } from '../entities/contribution.entity';
import { EscrowDeployment } from '../entities/escrow-deployment.entity';
import {
  EscrowContractService,
  ContributorInfo,
} from './escrow-contract.service';
import { CryptoPricesService } from './crypto-prices.service';
import { WalletGenerationService } from './wallet-generation.service';

export interface BountyFilters {
  status?: string;
  category?: string;
  companyId?: string;
}

export interface BountyDeployment {
  chain: 'ethereum' | 'avalanche';
  network: string;
  contractAddress: string;
  deploymentTxHash?: string;
  deployedAt: string;
  campaignName?: string | null;
  campaignDescription?: string | null;
  targetAmountEth?: number | null;
}

export interface BountyResponse {
  id: string;
  title: string;
  description: string;
  category: string;
  /** Target in EUR (wishlist item value) */
  targetAmount: string;
  targetAmountEur: number;
  targetAmountEth: number | null;
  /** Amount raised on Ethereum (native ETH) — may be "0" if no ETH contract */
  raisedEth: string;
  /** EVM raised amount in native token as string (ETH or AVAX) */
  raisedAmount: string;
  raisedAvax?: string; // populated when an Avalanche contract exists
  /** Total raised across ALL chains, converted to EUR */
  totalRaisedEur: number;
  progressPercentage: number;
  contributorCount: number;
  deadline: string;
  status: 'active' | 'funded' | 'expired' | 'failed';
  company: {
    id: string;
    name: string;
    industry: string;
    avatar?: string;
    ownerId: string;
    owner?: {
      id: string;
      name?: string | null;
      profilePhotoUrl?: string | null;
    };
  };
  isEscrowActive: boolean;
  ethereumEscrowAddress: string | null;
  avalancheEscrowAddress: string | null;
  /** Company child wallet addresses for non-EVM direct contributions */
  solanaWalletAddress: string | null;
  stellarWalletAddress: string | null;
  bitcoinWalletAddress: string | null;
  deployments: BountyDeployment[];
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  description?: string;
  industry?: string;
  logoUrl?: string;
  completedBounties: number;
  activeBounties: number;
  totalBounties: number;

  /** Native totals separated by chain */
  totalRaisedEth: number;
  totalRaisedAvax: number;

  /** Manual or non-EVM contributions (EUR) */
  totalRaisedManualEur: number;

  /** Combined eur value used for ranking and display */
  totalRaisedEur: number;
}

@Injectable()
export class BountiesService {
  private readonly logger = new Logger(BountiesService.name);

  constructor(
    @InjectRepository(WishlistItem)
    private readonly wishlistRepository: Repository<WishlistItem>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(CompanyWallet)
    private readonly companyWalletRepository: Repository<CompanyWallet>,
    @InjectRepository(Contribution)
    private readonly contributionRepository: Repository<Contribution>,
    @InjectRepository(EscrowDeployment)
    private readonly escrowDeploymentRepository: Repository<EscrowDeployment>,
    private readonly escrowService: EscrowContractService,
    private readonly pricesService: CryptoPricesService,
    private readonly walletService: WalletGenerationService,
  ) {}

  /**
   * Find all bounties with optional filters
   */
  async findAll(filters: BountyFilters = {}): Promise<BountyResponse[]> {
    try {
      const queryBuilder = this.wishlistRepository
        .createQueryBuilder('wishlist')
        .leftJoinAndSelect('wishlist.company', 'company')
        .where('wishlist.isEscrowActive = :isActive', { isActive: true });

      // Apply filters
      if (filters.category) {
        queryBuilder.andWhere('wishlist.category = :category', {
          category: filters.category,
        });
      }

      if (filters.companyId) {
        queryBuilder.andWhere('company.id = :companyId', {
          companyId: filters.companyId,
        });
      }

      const wishlistItems = await queryBuilder.getMany();

      // Enrich with blockchain data
      const bounties = await Promise.all(
        wishlistItems.map((item) => this.enrichWithBlockchainData(item)),
      );

      // Apply status filter after blockchain enrichment
      let filteredBounties = bounties;
      if (filters.status && filters.status !== 'all') {
        filteredBounties = bounties.filter(
          (bounty) => bounty.status === filters.status,
        );
      }

      this.logger.log(
        `📋 Found ${filteredBounties.length} bounties (filtered: ${JSON.stringify(filters)})`,
      );

      return filteredBounties;
    } catch (error) {
      this.logger.error('❌ Failed to fetch bounties:', error);
      throw error;
    }
  }

  /**
   * Find a specific bounty by ID
   */
  async findById(id: string): Promise<BountyResponse | null> {
    try {
      const wishlistItem = await this.wishlistRepository.findOne({
        where: { id, isEscrowActive: true },
        relations: ['company'],
      });

      if (!wishlistItem) {
        return null;
      }

      const bounty = await this.enrichWithBlockchainData(wishlistItem);

      this.logger.log(`🎯 Found bounty: ${bounty.title}`);

      return bounty;
    } catch (error) {
      this.logger.error(`❌ Failed to fetch bounty ${id}:`, error);
      throw error;
    }
  }

  /**
   * Find bounties for a specific company
   */
  async findByCompany(companyId: string): Promise<BountyResponse[]> {
    try {
      const wishlistItems = await this.wishlistRepository.find({
        where: {
          company: { id: companyId },
          isEscrowActive: true,
        },
        relations: ['company'],
      });

      const bounties = await Promise.all(
        wishlistItems.map((item) => this.enrichWithBlockchainData(item)),
      );

      this.logger.log(
        `🏢 Found ${bounties.length} bounties for company ${companyId}`,
      );

      return bounties;
    } catch (error) {
      this.logger.error(`❌ Failed to fetch company bounties:`, error);
      throw error;
    }
  }

  /**
   * Create a bounty from a wishlist item
   */
  async createFromWishlistItem(
    wishlistItemId: string,
    targetAmountEur: number,
    durationInDays: number,
    userId: string,
  ): Promise<BountyResponse> {
    try {
      // Verify user owns the wishlist item
      const wishlistItem = await this.wishlistRepository.findOne({
        where: { id: wishlistItemId },
        relations: ['company'],
      });

      if (!wishlistItem) {
        throw new HttpException(
          'Wishlist item not found',
          HttpStatus.NOT_FOUND,
        );
      }

      // Check if bounty already exists
      if (wishlistItem.isEscrowActive) {
        throw new HttpException(
          'Bounty already exists for this wishlist item',
          HttpStatus.CONFLICT,
        );
      }

      // Update wishlist item with escrow data
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + durationInDays);

      wishlistItem.value = targetAmountEur;
      wishlistItem.campaignDeadline = deadline;
      wishlistItem.campaignDurationDays = durationInDays;
      wishlistItem.isEscrowActive = true;

      // Generate unique non-EVM wallets for this wishlist item (solana/stellar/bitcoin)
      try {
        const addresses = await this.walletService.generateWishlistItemAddresses(
          userId,
        );
        wishlistItem.solanaEscrowAddress =
          addresses.solanaAddress || wishlistItem.solanaEscrowAddress;
        wishlistItem.stellarEscrowAddress =
          addresses.stellarAddress || wishlistItem.stellarEscrowAddress;
        wishlistItem.bitcoinEscrowAddress =
          addresses.bitcoinAddress || wishlistItem.bitcoinEscrowAddress;
        this.logger.log(
          `🔑 Generated non-EVM escrow addresses for wishlist item ${wishlistItem.id}: solana=${addresses.solanaAddress}, stellar=${addresses.stellarAddress}, bitcoin=${addresses.bitcoinAddress}`,
        );
      } catch (addrErr) {
        // not fatal, just log
        this.logger.warn(
          `⚠️  Could not generate non-EVM addresses for wishlist item ${wishlistItem.id}: ${
            addrErr instanceof Error ? addrErr.message : String(addrErr)
          }`,
        );
      }

      await this.wishlistRepository.save(wishlistItem);

      this.logger.log(`✅ Created bounty for wishlist item: ${wishlistItemId}`);

      return this.enrichWithBlockchainData(wishlistItem);
    } catch (error) {
      this.logger.error('❌ Failed to create bounty:', error);
      throw error;
    }
  }

  /**
   * Sync bounty status with blockchain
   */
  async syncWithBlockchain(id: string): Promise<BountyResponse> {
    try {
      const wishlistItem = await this.wishlistRepository.findOne({
        where: { id, isEscrowActive: true },
        relations: ['company'],
      });

      if (!wishlistItem) {
        throw new HttpException('Bounty not found', HttpStatus.NOT_FOUND);
      }

      // Get fresh blockchain data
      const bounty = await this.enrichWithBlockchainData(wishlistItem);

      this.logger.log(`🔄 Synced bounty ${id} with blockchain`);

      return bounty;
    } catch (error) {
      this.logger.error(`❌ Failed to sync bounty ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get contributors for a bounty
   */
  async getContributors(id: string) {
    try {
      const wishlistItem = await this.wishlistRepository.findOne({
        where: { id, isEscrowActive: true },
      });

      if (!wishlistItem) {
        throw new HttpException('Bounty not found', HttpStatus.NOT_FOUND);
      }

      let contributors: ContributorInfo[] = [];

      // Get contributors from Ethereum if available
      if (wishlistItem.ethereumEscrowAddress) {
        const status = await this.escrowService.getCampaignStatus(
          wishlistItem.ethereumEscrowAddress,
          'ethereum',
          true,
        );
        contributors = status.contributors || [];
      }
      // Fall back to Avalanche
      else if (wishlistItem.avalancheEscrowAddress) {
        const status = await this.escrowService.getCampaignStatus(
          wishlistItem.avalancheEscrowAddress,
          'avalanche',
          true,
        );
        contributors = status.contributors || [];
      }

      this.logger.log(
        `📋 Found ${contributors.length} contributors for bounty ${id}`,
      );

      // Sync contributors to database
      await this.syncContributorsToDatabase(id, contributors);

      return contributors;
    } catch (error) {
      this.logger.error(
        `❌ Failed to get contributors for bounty ${id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Sync contributors from blockchain to database
   */
  private async syncContributorsToDatabase(
    wishlistItemId: string,
    contributors: ContributorInfo[],
  ): Promise<void> {
    try {
      const wishlistItem = await this.wishlistRepository.findOne({
        where: { id: wishlistItemId },
      });

      if (!wishlistItem) return;

      // Get escrow deployment records
      const escrowDeployments = await this.escrowDeploymentRepository.find({
        where: { wishlistItemId },
      });

      for (const contributor of contributors) {
        const address = contributor.address.toLowerCase();

        // Determine which chain this contribution is from
        let chain: string;
        let contractAddress: string;
        let escrowDeployment: EscrowDeployment | undefined;

        if (wishlistItem.ethereumEscrowAddress) {
          chain = 'ethereum';
          contractAddress = wishlistItem.ethereumEscrowAddress;
          escrowDeployment = escrowDeployments.find(
            (d) => d.chain === 'ethereum',
          );
        } else if (wishlistItem.avalancheEscrowAddress) {
          chain = 'avalanche';
          contractAddress = wishlistItem.avalancheEscrowAddress;
          escrowDeployment = escrowDeployments.find(
            (d) => d.chain === 'avalanche',
          );
        } else {
          continue;
        }

        if (!escrowDeployment) continue;

        // Check if contribution already exists
        const existing = await this.contributionRepository.findOne({
          where: {
            contributorAddress: address,
            contractAddress,
            wishlistItemId,
          },
        });

        if (!existing) {
          // Create new contribution record
          const contribution = this.contributionRepository.create({
            contributorAddress: address,
            escrowDeploymentId: escrowDeployment.id,
            wishlistItemId,
            contractAddress,
            chain,
            amountWei: contributor.amount,
            amountEth: parseFloat(contributor.amountEth),
            contributedAt: new Date(),
          });

          await this.contributionRepository.save(contribution);
          this.logger.log(
            `💾 Saved contribution from ${address}: ${contributor.amountEth} ETH`,
          );
        } else {
          // Update existing contribution if amount changed
          if (existing.amountWei !== contributor.amount) {
            existing.amountWei = contributor.amount;
            existing.amountEth = parseFloat(contributor.amountEth);
            existing.updatedAt = new Date();
            await this.contributionRepository.save(existing);
            this.logger.log(
              `🔄 Updated contribution from ${address}: ${contributor.amountEth} ETH`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`❌ Failed to sync contributors to database:`, error);
    }
  }

  /**
   * Get full bounty history including deployments and contributions
   */
  async getBountyHistory(id: string) {
    try {
      const wishlistItem = await this.wishlistRepository.findOne({
        where: { id, isEscrowActive: true },
        relations: ['company'],
      });

      if (!wishlistItem) {
        throw new HttpException('Bounty not found', HttpStatus.NOT_FOUND);
      }

      // Get deployment records
      const deployments = await this.escrowDeploymentRepository.find({
        where: { wishlistItemId: id },
        relations: ['deployedBy'],
        order: { createdAt: 'ASC' },
      });

      // Get contribution records
      const contributions = await this.contributionRepository.find({
        where: { wishlistItemId: id },
        relations: ['user'],
        order: { contributedAt: 'DESC' },
      });

      // Calculate statistics
      const totalContributions = contributions.reduce(
        (sum, c) => sum + parseFloat((c.amountEth ?? 0).toString()),
        0,
      );
      const uniqueContributors = new Set(
        contributions.map((c) => c.contributorAddress),
      ).size;

      return {
        wishlistItem: {
          id: wishlistItem.id,
          title: wishlistItem.title,
          company: {
            id: wishlistItem.company.id,
            name: wishlistItem.company.name,
          },
        },
        deployments: deployments.map((d) => ({
          id: d.id,
          contractAddress: d.contractAddress,
          chain: d.chain,
          network: d.network,
          deploymentTxHash: d.deploymentTxHash,
          targetAmountEth: d.targetAmountEth,
          deadline: d.deadline,
          deployedBy: d.deployedBy
            ? {
                id: d.deployedBy.id,
                name: d.deployedBy.name,
                email: d.deployedBy.email,
              }
            : null,
          deployedAt: d.createdAt,
          status: d.status,
        })),
        contributions: contributions.map((c) => ({
          id: c.id,
          contributorAddress: c.contributorAddress,
          user: c.user
            ? {
                id: c.user.id,
                name: c.user.name,
              }
            : null,
          contractAddress: c.contractAddress,
          chain: c.chain,
          transactionHash: c.transactionHash,
          amountEth: c.amountEth,
          amountUsd: c.amountUsd,
          contributedAt: c.contributedAt,
          isRefunded: c.isRefunded,
          refundedAt: c.refundedAt,
        })),
        statistics: {
          totalContributions,
          uniqueContributors,
          contributionsCount: contributions.length,
          deploymentsCount: deployments.length,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Failed to get bounty history:`, error);
      throw error;
    }
  }

  /**
   * Enrich wishlist item with blockchain data.
   * Returns EVM on-chain data plus EUR totals that aggregate all chains
   * (ETH escrow + AVAX escrow + manual SOL/XLM/BTC contributions).
   */
  private async enrichWithBlockchainData(
    wishlistItem: WishlistItem,
  ): Promise<BountyResponse> {
    let raisedAmount = '0';
    let evmRaisedEth = 0;
    let contributorCount = 0;
    let blockchainStatus: 'active' | 'funded' | 'failed' | 'expired' = 'active';
    let deployments: BountyDeployment[] = [];

    // Fetch deployment details from database
    try {
      const escrowDeployments = await this.escrowDeploymentRepository.find({
        where: { wishlistItemId: wishlistItem.id },
        order: { createdAt: 'DESC' },
      });

      deployments = escrowDeployments.map((deployment) => ({
        chain:
          deployment.chain.toLowerCase() === 'ethereum'
            ? 'ethereum'
            : 'avalanche',
        network: deployment.network,
        contractAddress: deployment.contractAddress,
        deploymentTxHash: deployment.deploymentTxHash,
        deployedAt: deployment.createdAt.toISOString(),
        campaignName: deployment.campaignName || null,
        campaignDescription: deployment.campaignDescription || null,
        targetAmountEth: deployment.targetAmountEth ?? null,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `⚠️  Failed to fetch deployments for ${wishlistItem.id}:`,
        errorMessage,
      );
    }

    // Fetch blockchain data for ALL deployed EVM contracts independently
    let ethRaisedNative = 0;
    let avaxRaisedNative = 0;

    if (
      wishlistItem.ethereumEscrowAddress ||
      wishlistItem.avalancheEscrowAddress
    ) {
      // Fetch both contracts in parallel; failures are non-fatal
      const [ethResult, avaxResult] = await Promise.allSettled([
        wishlistItem.ethereumEscrowAddress
          ? this.escrowService.getCampaignStatus(
              wishlistItem.ethereumEscrowAddress,
              'ethereum',
            )
          : Promise.resolve(null),
        wishlistItem.avalancheEscrowAddress
          ? this.escrowService.getCampaignStatus(
              wishlistItem.avalancheEscrowAddress,
              'avalanche',
            )
          : Promise.resolve(null),
      ]);

      if (ethResult.status === 'fulfilled' && ethResult.value) {
        const ethStatus = ethResult.value;
        ethRaisedNative = parseFloat(ethStatus.totalRaised);
        evmRaisedEth += ethRaisedNative;
        contributorCount += ethStatus.contributorCount;
        // Use ETH deadline/status as the primary campaign status
        blockchainStatus = this.mapBlockchainStatus(
          ethStatus.deadline,
          ethRaisedNative,
          parseFloat(wishlistItem.value?.toString() || '0'),
        );
        raisedAmount = ethStatus.totalRaised; // kept for backward compat display
      } else if (ethResult.status === 'rejected') {
        this.logger.warn(
          `⚠️  Failed to fetch ETH blockchain data for ${wishlistItem.id}:`,
          ethResult.reason,
        );
      }

      if (avaxResult.status === 'fulfilled' && avaxResult.value) {
        const avaxStatus = avaxResult.value;
        avaxRaisedNative = parseFloat(avaxStatus.totalRaised);
        contributorCount += avaxStatus.contributorCount;
        // Only use AVAX for campaign status if ETH contract was not present
        if (!wishlistItem.ethereumEscrowAddress) {
          evmRaisedEth += avaxRaisedNative;
          blockchainStatus = this.mapBlockchainStatus(
            avaxStatus.deadline,
            avaxRaisedNative,
            parseFloat(wishlistItem.value?.toString() || '0'),
          );
          raisedAmount = avaxStatus.totalRaised;
        } else {
          // Both contracts deployed — add AVAX on top of ETH already counted
          evmRaisedEth += avaxRaisedNative;
        }
      } else if (avaxResult.status === 'rejected') {
        this.logger.warn(
          `⚠️  Failed to fetch AVAX blockchain data for ${wishlistItem.id}:`,
          avaxResult.reason,
        );
      }
    }

    // ---- Cross-chain EUR aggregation ------------------------------------
    const targetAmountEur = parseFloat(wishlistItem.value?.toString() || '0');

    // Convert each EVM chain's native amount to EUR independently
    let evmRaisedEur = 0;
    try {
      const [ethEur, avaxEur] = await Promise.all([
        ethRaisedNative > 0
          ? this.pricesService.toEur('ETH', ethRaisedNative)
          : Promise.resolve(0),
        avaxRaisedNative > 0
          ? this.pricesService.toEur('AVAX', avaxRaisedNative)
          : Promise.resolve(0),
      ]);
      evmRaisedEur = ethEur + avaxEur;
    } catch {
      // price fetch failed — evmRaisedEur stays 0
    }

    // Sum manual (non-EVM) contributions stored in DB
    let manualRaisedEur = 0;
    try {
      const manualContribs = await this.contributionRepository
        .createQueryBuilder('c')
        .where('c.wishlistItemId = :id', { id: wishlistItem.id })
        .andWhere("c.chain NOT IN ('ethereum', 'avalanche')")
        .andWhere('c.isRefunded = false')
        .andWhere('c.amountEur IS NOT NULL')
        .getMany();

      manualRaisedEur = manualContribs.reduce(
        (sum, c) => sum + parseFloat(c.amountEur?.toString() ?? '0'),
        0,
      );
      if (manualContribs.length > 0) {
        contributorCount += new Set(
          manualContribs.map((c) => c.userId ?? c.contractAddress),
        ).size;
      }
    } catch {
      /* ignore */
    }

    const totalRaisedEur = evmRaisedEur + manualRaisedEur;

    // Progress percentage: EUR-based when we have a EUR target, otherwise fall back to on-chain
    const ethTargetFromDeployment =
      deployments.find((d) => d.targetAmountEth != null)?.targetAmountEth ??
      null;
    let progressPercentage: number;
    if (targetAmountEur > 0) {
      progressPercentage = Math.min(
        (totalRaisedEur / targetAmountEur) * 100,
        100,
      );
    } else if (ethTargetFromDeployment && ethTargetFromDeployment > 0) {
      progressPercentage = Math.min(
        (evmRaisedEth / ethTargetFromDeployment) * 100,
        100,
      );
    } else {
      progressPercentage = 0;
    }

    // ---- Non-EVM deposit addresses for this bounty (per-item preferred) -------
    let solanaWalletAddress: string | null = null;
    let stellarWalletAddress: string | null = null;
    let bitcoinWalletAddress: string | null = null;

    // prefer the unique addresses stored on the wishlist item itself
    if (wishlistItem.solanaEscrowAddress) {
      solanaWalletAddress = wishlistItem.solanaEscrowAddress;
    }
    if (wishlistItem.stellarEscrowAddress) {
      stellarWalletAddress = wishlistItem.stellarEscrowAddress;
    }
    if (wishlistItem.bitcoinEscrowAddress) {
      bitcoinWalletAddress = wishlistItem.bitcoinEscrowAddress;
    }

    // fallback to the company-level child wallet if item-specific not set
    if (!solanaWalletAddress || !stellarWalletAddress || !bitcoinWalletAddress) {
      try {
        const cw = await this.companyWalletRepository.findOne({
          where: { companyId: wishlistItem.company.id },
          select: ['solanaAddress', 'stellarAddress', 'bitcoinAddress'],
        });
        if (cw) {
          if (!solanaWalletAddress) solanaWalletAddress = cw.solanaAddress ?? null;
          if (!stellarWalletAddress) stellarWalletAddress = cw.stellarAddress ?? null;
          if (!bitcoinWalletAddress) bitcoinWalletAddress = cw.bitcoinAddress ?? null;
        }
      } catch {
        /* missing wallet is not fatal */
      }
    }

    // ---- Determine final status -----------------------------------------
    const now = new Date();
    const deadline = wishlistItem.campaignDeadline || now;
    let status: 'active' | 'funded' | 'expired' | 'failed' = blockchainStatus;

    if (deadline < now && progressPercentage < 100) {
      status = 'expired';
    } else if (progressPercentage >= 100) {
      status = 'funded';
    }

    return {
      id: wishlistItem.id,
      title: wishlistItem.title,
      description: wishlistItem.description || '',
      category: wishlistItem.category,
      targetAmount: wishlistItem.value?.toString() || '0',
      targetAmountEur,
      targetAmountEth: ethTargetFromDeployment,
      raisedEth: ethRaisedNative.toString(),
      raisedAvax: avaxRaisedNative.toString(),
      raisedAmount,
      totalRaisedEur: Math.round(totalRaisedEur * 100) / 100,
      progressPercentage: Math.round(progressPercentage),
      contributorCount,
      deadline: (wishlistItem.campaignDeadline || now).toISOString(),
      status,
      company: {
        id: wishlistItem.company.id,
        name: wishlistItem.company.name,
        industry: wishlistItem.company.industry || 'Not specified',
        avatar: wishlistItem.company.logoUrl,
        ownerId: wishlistItem.company.ownerId,
      },
      isEscrowActive: wishlistItem.isEscrowActive,
      ethereumEscrowAddress: wishlistItem.ethereumEscrowAddress || null,
      avalancheEscrowAddress: wishlistItem.avalancheEscrowAddress || null,
      solanaWalletAddress,
      stellarWalletAddress,
      bitcoinWalletAddress,
      deployments,
      createdAt: wishlistItem.createdAt.toISOString(),
    };
  }

  /**
   * Record a manual (off-chain) contribution from a non-EVM wallet.
   * The contributor sends SOL/XLM/BTC directly to the company's child wallet
   * and then records it here with the transaction hash.
   */
  async recordManualContribution(
    wishlistItemId: string,
    chain: 'solana' | 'stellar' | 'bitcoin',
    nativeAmount: number,
    transactionHash: string,
    userId?: string,
  ): Promise<void> {
    const wishlistItem = await this.wishlistRepository.findOne({
      where: { id: wishlistItemId, isEscrowActive: true },
      relations: ['company'],
    });
    if (!wishlistItem) {
      throw new HttpException('Bounty not found', HttpStatus.NOT_FOUND);
    }

    const symbolMap: Record<string, string> = {
      solana: 'SOL',
      stellar: 'XLM',
      bitcoin: 'BTC',
    };
    const currencySymbol = symbolMap[chain];
    const amountEur = await this.pricesService.toEur(
      currencySymbol,
      nativeAmount,
    );

    // Get receiving wallet address
    let receivingAddress: string | null = null;
    try {
      const cw = await this.companyWalletRepository.findOne({
        where: { companyId: wishlistItem.company.id },
      });
      if (cw) {
        if (chain === 'solana') receivingAddress = cw.solanaAddress;
        else if (chain === 'stellar') receivingAddress = cw.stellarAddress;
        else if (chain === 'bitcoin') receivingAddress = cw.bitcoinAddress;
      }
    } catch {
      /* not fatal if wallet lookup fails */
    }

    const contribution = this.contributionRepository.create({
      contributorAddress: 'manual',
      userId: userId ?? undefined,
      escrowDeploymentId: undefined,
      wishlistItemId,
      contractAddress: receivingAddress ?? undefined,
      chain,
      transactionHash,
      currencySymbol,
      nativeAmount,
      amountEur,
      amountWei: undefined,
      amountEth: undefined,
      isRefunded: false,
    });

    await this.contributionRepository.save(contribution);
    this.logger.log(
      `✅ Manual contribution recorded: ${nativeAmount} ${currencySymbol} = €${amountEur.toFixed(2)} for bounty ${wishlistItemId}`,
    );
  }

  /**
   * Get the leaderboard: all public companies ranked by total raised ETH,
   * then by number of completed (funded) bounties.
   */
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const raw = await this.companyRepository
      .createQueryBuilder('company')
      .leftJoin('company.wishlistItems', 'wi')
      .leftJoin('wi.escrowDeployments', 'ed')
      .leftJoin('wi.contributions', 'con', 'con."isRefunded" = false')
      .where('company.isPublic = :isPublic', { isPublic: true })
      .select('company.id', 'id')
      .addSelect('company.name', 'name')
      .addSelect('company.description', 'description')
      .addSelect('company.industry', 'industry')
      .addSelect('company.logoUrl', 'logoUrl')
      .addSelect(
        `COUNT(DISTINCT CASE WHEN ed.status = 'funded' THEN ed.id END)`,
        'completedBounties',
      )
      .addSelect(
        `COUNT(DISTINCT CASE WHEN ed.status = 'active' THEN ed.id END)`,
        'activeBounties',
      )
      .addSelect('COUNT(DISTINCT ed.id)', 'totalBounties')
      .addSelect(
        `COALESCE(SUM(CASE WHEN con.chain = 'ethereum' THEN con."amountEth" ELSE 0 END), 0)`,
        'totalRaisedEth',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN con.chain = 'avalanche' THEN con."amountEth" ELSE 0 END), 0)`,
        'totalRaisedAvax',
      )
      // manual eur contributions (solana, stellar, bitcoin, etc.)
      .addSelect('COALESCE(SUM(con."amountEur"), 0)', 'totalRaisedManualEur')
      .groupBy('company.id')
      .getRawMany();

    // convert strings and compute eur totals
    const entries = await Promise.all(
      raw.map(async (r) => {
        const eth = parseFloat(r.totalRaisedEth) || 0;
        const avax = parseFloat(r.totalRaisedAvax) || 0;
        const manualEur = parseFloat(r.totalRaisedManualEur) || 0;

        // convert eth/avax to eur for ranking
        const ethEur = await this.pricesService.toEur('ETH', eth);
        const avaxEur = await this.pricesService.toEur('AVAX', avax);

        return {
          rank: 0,
          id: r.id,
          name: r.name,
          description: r.description ?? undefined,
          industry: r.industry ?? undefined,
          logoUrl: r.logoUrl ?? undefined,
          completedBounties: parseInt(r.completedBounties, 10) || 0,
          activeBounties: parseInt(r.activeBounties, 10) || 0,
          totalBounties: parseInt(r.totalBounties, 10) || 0,
          totalRaisedEth: eth,
          totalRaisedAvax: avax,
          totalRaisedManualEur: manualEur,
          totalRaisedEur: ethEur + avaxEur + manualEur,
        };
      }),
    );

    entries.sort((a, b) => {
      if (b.totalRaisedEur !== a.totalRaisedEur) return b.totalRaisedEur - a.totalRaisedEur;
      if (b.completedBounties !== a.completedBounties) return b.completedBounties - a.completedBounties;
      if (b.totalBounties !== a.totalBounties) return b.totalBounties - a.totalBounties;
      return a.name.localeCompare(b.name);
    });

    return entries.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }

  /**
   * Map blockchain status to bounty status
   */
  private mapBlockchainStatus(
    deadline: Date,
    raisedAmount: number,
    targetAmount: number,
  ): 'active' | 'funded' | 'failed' | 'expired' {
    const now = new Date();
    const isExpired = new Date(deadline) < now;
    const isFunded = raisedAmount >= targetAmount;

    if (isFunded) return 'funded';
    if (isExpired) return 'expired';
    return 'active';
  }
}
