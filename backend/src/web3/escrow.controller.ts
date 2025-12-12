import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { IsString, IsNumber, IsOptional, IsArray, IsNotEmpty, IsIn } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { EscrowContractService } from './escrow-contract.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { Company } from '../entities/company.entity';
import { EscrowDeployment } from '../entities/escrow-deployment.entity';
import { CurrentUser } from '../auth/current-user.decorator';
import { backfillEscrowAddresses } from './backfill-escrow-addresses';

class CreateEscrowDto {
  @IsString()
  @IsNotEmpty()
  wishlistItemId: string;

  @IsNumber()
  targetAmountEth: number;

  @IsNumber()
  durationInDays: number;

  @IsArray()
  @IsOptional()
  chains?: ('ethereum' | 'avalanche')[];
}

@Controller('escrow')
export class EscrowController {
  private readonly logger = new Logger(EscrowController.name);

  constructor(
    private readonly escrowService: EscrowContractService,
    private readonly dataSource: DataSource,
    @InjectRepository(WishlistItem)
    private wishlistRepo: Repository<WishlistItem>,
    @InjectRepository(Company)
    private companyRepo: Repository<Company>,
    @InjectRepository(EscrowDeployment)
    private escrowDeploymentRepo: Repository<EscrowDeployment>,
  ) {}

  /**
   * Create escrow contracts for a wishlist item
   */
  @Post('create')
  @UseGuards(AuthGuard('jwt'))
  async createEscrow(
    @Body() dto: CreateEscrowDto,
    @CurrentUser() user: any
  ) {
    try {
      // Verify wishlist item exists
      const wishlistItem = await this.wishlistRepo.findOne({
        where: { id: dto.wishlistItemId },
        relations: ['company'],
      });

      if (!wishlistItem) {
        throw new HttpException('Wishlist item not found', HttpStatus.NOT_FOUND);
      }

      // Verify user owns the company
      const company = await this.companyRepo.findOne({
        where: { id: wishlistItem.companyId },
      });

      if (!company || company.ownerId !== user.sub) {
        throw new HttpException(
          'You do not have permission to create escrow for this company',
          HttpStatus.FORBIDDEN
        );
      }

      // Check if company has wallet addresses
      if (!company.ethAddress && !company.avaxAddress) {
        throw new HttpException(
          'Company must have at least one wallet address configured',
          HttpStatus.BAD_REQUEST
        );
      }

      // Use company's primary wallet address (prefer ETH, fallback to AVAX)
      const walletAddress = company.ethAddress || company.avaxAddress!;

      // Deploy escrow contracts
      const result = await this.escrowService.deployEscrowContracts(
        dto.wishlistItemId,
        walletAddress,
        dto.targetAmountEth,
        dto.durationInDays,
        dto.chains
      );

      // Save deployment records to database
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + dto.durationInDays);

      const deploymentRecords: EscrowDeployment[] = [];

      if (result.ethereumAddress) {
        const ethDeployment = this.escrowDeploymentRepo.create({
          contractAddress: result.ethereumAddress,
          chain: 'ethereum',
          network: 'sepolia',
          deploymentTxHash: result.transactionHashes.ethereum || undefined,
          targetAmountEth: dto.targetAmountEth,
          durationInDays: dto.durationInDays,
          deadline,
          deployedById: user.sub,
          wishlistItemId: dto.wishlistItemId,
          status: 'active',
        });
        const savedDeployment = await this.escrowDeploymentRepo.save(ethDeployment);
        deploymentRecords.push(savedDeployment);
      }

      if (result.avalancheAddress) {
        const avaxDeployment = this.escrowDeploymentRepo.create({
          contractAddress: result.avalancheAddress,
          chain: 'avalanche',
          network: 'fuji',
          deploymentTxHash: result.transactionHashes.avalanche || undefined,
          targetAmountEth: dto.targetAmountEth,
          durationInDays: dto.durationInDays,
          deadline,
          deployedById: user.sub,
          wishlistItemId: dto.wishlistItemId,
          status: 'active',
        });
        const savedDeployment = await this.escrowDeploymentRepo.save(avaxDeployment);
        deploymentRecords.push(savedDeployment);
      }

      // Update wishlist item with contract addresses
      wishlistItem.ethereumEscrowAddress = result.ethereumAddress || wishlistItem.ethereumEscrowAddress;
      wishlistItem.avalancheEscrowAddress = result.avalancheAddress || wishlistItem.avalancheEscrowAddress;
      wishlistItem.campaignDeadline = deadline;
      wishlistItem.campaignDurationDays = dto.durationInDays;
      wishlistItem.isEscrowActive = true;
      await this.wishlistRepo.save(wishlistItem);

      this.logger.log(`✅ Escrow contracts deployed and tracked for wishlist item: ${dto.wishlistItemId}`);

      return {
        success: true,
        message: 'Escrow contracts deployed successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error('❌ Failed to create escrow:', error);
      throw new HttpException(
        error.message || 'Failed to create escrow contracts',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Backfill wishlist items with escrow addresses from deployment records
   * One-time migration endpoint to fix existing data
   */
  @Post('backfill-addresses')
  async backfillAddresses() {
    try {
      this.logger.log('🔄 Starting escrow address backfill...');
      await backfillEscrowAddresses(this.dataSource);
      return {
        success: true,
        message: 'Escrow addresses backfilled successfully',
      };
    } catch (error) {
      this.logger.error('❌ Failed to backfill addresses:', error);
      throw new HttpException(
        error.message || 'Failed to backfill escrow addresses',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get campaign status for a wishlist item
   */
  @Get('status/:wishlistItemId')
  async getCampaignStatus(@Param('wishlistItemId') wishlistItemId: string) {
    try {
      const wishlistItem = await this.wishlistRepo.findOne({
        where: { id: wishlistItemId },
      });

      if (!wishlistItem) {
        throw new HttpException('Wishlist item not found', HttpStatus.NOT_FOUND);
      }

      const result: any = {
        wishlistItemId,
        ethereum: null,
        avalanche: null,
      };

      // Get Ethereum status
      if (wishlistItem.ethereumEscrowAddress) {
        try {
          result.ethereum = await this.escrowService.getCampaignStatus(
            wishlistItem.ethereumEscrowAddress,
            'ethereum'
          );
        } catch (error) {
          this.logger.error('Failed to get Ethereum status:', error);
        }
      }

      // Get Avalanche status
      if (wishlistItem.avalancheEscrowAddress) {
        try {
          result.avalanche = await this.escrowService.getCampaignStatus(
            wishlistItem.avalancheEscrowAddress,
            'avalanche'
          );
        } catch (error) {
          this.logger.error('Failed to get Avalanche status:', error);
        }
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('❌ Failed to get campaign status:', error);
      throw new HttpException(
        error.message || 'Failed to get campaign status',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Sync wishlist item with blockchain state
   */
  @Post('sync/:wishlistItemId')
  async syncWishlist(@Param('wishlistItemId') wishlistItemId: string) {
    try {
      await this.escrowService.syncWishlistWithBlockchain(wishlistItemId);

      const updated = await this.wishlistRepo.findOne({
        where: { id: wishlistItemId },
      });

      return {
        success: true,
        message: 'Wishlist synced with blockchain',
        data: updated,
      };
    } catch (error) {
      this.logger.error('❌ Failed to sync wishlist:', error);
      throw new HttpException(
        error.message || 'Failed to sync wishlist',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get all escrows for a company
   */
  @Get('company/:companyId')
  async getCompanyEscrows(@Param('companyId') companyId: string) {
    try {
      const company = await this.companyRepo.findOne({
        where: { id: companyId },
      });

      if (!company) {
        throw new HttpException('Company not found', HttpStatus.NOT_FOUND);
      }

      const result: any = {
        companyId,
        ethereum: [],
        avalanche: [],
      };

      // Get Ethereum escrows
      if (company.ethAddress) {
        try {
          result.ethereum = await this.escrowService.getCompanyEscrows(
            company.ethAddress,
            'ethereum'
          );
        } catch (error) {
          this.logger.error('Failed to get Ethereum escrows:', error);
        }
      }

      // Get Avalanche escrows
      if (company.avaxAddress) {
        try {
          result.avalanche = await this.escrowService.getCompanyEscrows(
            company.avaxAddress,
            'avalanche'
          );
        } catch (error) {
          this.logger.error('Failed to get Avalanche escrows:', error);
        }
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('❌ Failed to get company escrows:', error);
      throw new HttpException(
        error.message || 'Failed to get company escrows',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Check if escrow system is configured
   */
  @Get('health')
  async checkHealth() {
    const isConfigured = this.escrowService.isConfigured();

    return {
      success: true,
      configured: isConfigured,
      message: isConfigured
        ? 'Escrow system is configured and ready'
        : 'Escrow system is not fully configured. Check environment variables.',
    };
  }
}
