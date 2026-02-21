import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { User } from '../entities/user.entity';
import { Contribution } from '../entities/contribution.entity';
import { EscrowDeployment } from '../entities/escrow-deployment.entity';
import { EscrowContractService, ContributorInfo } from './escrow-contract.service';

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
  targetAmount: string;
  targetAmountEth: number | null;
  raisedAmount: string;
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
    owner?: { id: string; name?: string | null; profilePhotoUrl?: string | null };
  };
  isEscrowActive: boolean;
  ethereumEscrowAddress: string | null;
  avalancheEscrowAddress: string | null;
  deployments: BountyDeployment[];
  createdAt: string;
}

@Injectable()
export class BountiesService {
  private readonly logger = new Logger(BountiesService.name);

  constructor(
    @InjectRepository(WishlistItem)
    private readonly wishlistRepository: Repository<WishlistItem>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Contribution)
    private readonly contributionRepository: Repository<Contribution>,
    @InjectRepository(EscrowDeployment)
    private readonly escrowDeploymentRepository: Repository<EscrowDeployment>,
    private readonly escrowService: EscrowContractService,
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

      this.logger.log(`🏢 Found ${bounties.length} bounties for company ${companyId}`);

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
        throw new HttpException('Wishlist item not found', HttpStatus.NOT_FOUND);
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
          true
        );
        contributors = status.contributors || [];
      }
      // Fall back to Avalanche
      else if (wishlistItem.avalancheEscrowAddress) {
        const status = await this.escrowService.getCampaignStatus(
          wishlistItem.avalancheEscrowAddress,
          'avalanche',
          true
        );
        contributors = status.contributors || [];
      }

      this.logger.log(`📋 Found ${contributors.length} contributors for bounty ${id}`);

      // Sync contributors to database
      await this.syncContributorsToDatabase(id, contributors);

      return contributors;
    } catch (error) {
      this.logger.error(`❌ Failed to get contributors for bounty ${id}:`, error);
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
          escrowDeployment = escrowDeployments.find(d => d.chain === 'ethereum');
        } else if (wishlistItem.avalancheEscrowAddress) {
          chain = 'avalanche';
          contractAddress = wishlistItem.avalancheEscrowAddress;
          escrowDeployment = escrowDeployments.find(d => d.chain === 'avalanche');
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
          this.logger.log(`💾 Saved contribution from ${address}: ${contributor.amountEth} ETH`);
        } else {
          // Update existing contribution if amount changed
          if (existing.amountWei !== contributor.amount) {
            existing.amountWei = contributor.amount;
            existing.amountEth = parseFloat(contributor.amountEth);
            existing.updatedAt = new Date();
            await this.contributionRepository.save(existing);
            this.logger.log(`🔄 Updated contribution from ${address}: ${contributor.amountEth} ETH`);
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
        (sum, c) => sum + parseFloat(c.amountEth.toString()),
        0,
      );
      const uniqueContributors = new Set(contributions.map(c => c.contributorAddress)).size;

      return {
        wishlistItem: {
          id: wishlistItem.id,
          title: wishlistItem.title,
          company: {
            id: wishlistItem.company.id,
            name: wishlistItem.company.name,
          },
        },
        deployments: deployments.map(d => ({
          id: d.id,
          contractAddress: d.contractAddress,
          chain: d.chain,
          network: d.network,
          deploymentTxHash: d.deploymentTxHash,
          targetAmountEth: d.targetAmountEth,
          deadline: d.deadline,
          deployedBy: d.deployedBy ? {
            id: d.deployedBy.id,
            name: d.deployedBy.name,
            email: d.deployedBy.email,
          } : null,
          deployedAt: d.createdAt,
          status: d.status,
        })),
        contributions: contributions.map(c => ({
          id: c.id,
          contributorAddress: c.contributorAddress,
          user: c.user ? {
            id: c.user.id,
            name: c.user.name,
          } : null,
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
   * Enrich wishlist item with blockchain data
   */
  private async enrichWithBlockchainData(
    wishlistItem: WishlistItem,
  ): Promise<BountyResponse> {
    let raisedAmount = '0';
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
        chain: (deployment.chain.toLowerCase() === 'ethereum' ? 'ethereum' : 'avalanche') as 'ethereum' | 'avalanche',
        network: deployment.network,
        contractAddress: deployment.contractAddress,
        deploymentTxHash: deployment.deploymentTxHash,
        deployedAt: deployment.createdAt.toISOString(),
        campaignName: deployment.campaignName || null,
        campaignDescription: deployment.campaignDescription || null,
        targetAmountEth: deployment.targetAmountEth ?? null,
      }));
    } catch (error) {
      this.logger.warn(`⚠️  Failed to fetch deployments for ${wishlistItem.id}:`, error.message);
    }

    // Fetch blockchain data if contracts exist
    if (wishlistItem.ethereumEscrowAddress || wishlistItem.avalancheEscrowAddress) {
      try {
        // Try Ethereum first
        if (wishlistItem.ethereumEscrowAddress) {
          const ethStatus = await this.escrowService.getCampaignStatus(
            wishlistItem.ethereumEscrowAddress,
            'ethereum',
          );
          raisedAmount = ethStatus.totalRaised;
          contributorCount = ethStatus.contributorCount;
          blockchainStatus = this.mapBlockchainStatus(
            ethStatus.deadline,
            parseFloat(ethStatus.totalRaised),
            parseFloat(wishlistItem.value?.toString() || '0'),
          );
        }
        // Fall back to Avalanche
        else if (wishlistItem.avalancheEscrowAddress) {
          const avaxStatus = await this.escrowService.getCampaignStatus(
            wishlistItem.avalancheEscrowAddress,
            'avalanche',
          );
          raisedAmount = avaxStatus.totalRaised;
          contributorCount = avaxStatus.contributorCount;
          blockchainStatus = this.mapBlockchainStatus(
            avaxStatus.deadline,
            parseFloat(avaxStatus.totalRaised),
            parseFloat(wishlistItem.value?.toString() || '0'),
          );
        }
      } catch (error) {
        this.logger.warn(
          `⚠️  Failed to fetch blockchain data for ${wishlistItem.id}:`,
          error.message,
        );
      }
    }

    // Calculate progress percentage
    // Use ETH-denominated target from the deployment record when available
    // (avoids comparing ETH raised against EUR target which gives nonsensical %)
    const ethTargetFromDeployment = deployments.find(d => d.targetAmountEth != null)?.targetAmountEth ?? null;
    const targetAmountEur = parseFloat(wishlistItem.value?.toString() || '0');
    const raised = parseFloat(raisedAmount);
    const effectiveTarget = ethTargetFromDeployment ?? targetAmountEur;
    const progressPercentage = effectiveTarget > 0 ? Math.min((raised / effectiveTarget) * 100, 100) : 0;

    // Determine final status
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
      targetAmountEth: ethTargetFromDeployment,
      raisedAmount,
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
      deployments,
      createdAt: wishlistItem.createdAt.toISOString(),
    };
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
