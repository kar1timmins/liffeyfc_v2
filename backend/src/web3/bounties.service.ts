import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { User } from '../entities/user.entity';
import { EscrowContractService } from './escrow-contract.service';

export interface BountyFilters {
  status?: string;
  category?: string;
  companyId?: string;
}

export interface BountyResponse {
  id: string;
  title: string;
  description: string;
  category: string;
  targetAmount: string;
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
  };
  isEscrowActive: boolean;
  ethereumEscrowAddress: string | null;
  avalancheEscrowAddress: string | null;
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
   * Enrich wishlist item with blockchain data
   */
  private async enrichWithBlockchainData(
    wishlistItem: WishlistItem,
  ): Promise<BountyResponse> {
    let raisedAmount = '0';
    let contributorCount = 0;
    let blockchainStatus: 'active' | 'funded' | 'failed' | 'expired' = 'active';

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
    const targetAmount = parseFloat(wishlistItem.value?.toString() || '0');
    const raised = parseFloat(raisedAmount);
    const progressPercentage = targetAmount > 0 ? Math.min((raised / targetAmount) * 100, 100) : 0;

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
      },
      isEscrowActive: wishlistItem.isEscrowActive,
      ethereumEscrowAddress: wishlistItem.ethereumEscrowAddress || null,
      avalancheEscrowAddress: wishlistItem.avalancheEscrowAddress || null,
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
