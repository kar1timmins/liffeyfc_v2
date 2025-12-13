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
import { WalletGenerationService } from './wallet-generation.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { Company } from '../entities/company.entity';
import { User } from '../entities/user.entity';
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

  @IsString()
  @IsOptional()
  campaignName?: string;

  @IsString()
  @IsOptional()
  campaignDescription?: string;
}

@Controller('escrow')
export class EscrowController {
  private readonly logger = new Logger(EscrowController.name);

  constructor(
    private readonly escrowService: EscrowContractService,
    private readonly walletService: WalletGenerationService,
    private readonly dataSource: DataSource,
    @InjectRepository(WishlistItem)
    private wishlistRepo: Repository<WishlistItem>,
    @InjectRepository(Company)
    private companyRepo: Repository<Company>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
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
        this.logger.warn(`⚠️  Company ${company.id} has no wallet addresses. Attempting to generate...`);
        
        // Try to auto-generate company wallet
        try {
          const walletResult = await this.walletService.generateCompanyWallet(user.sub, company.id);
          this.logger.log(`✅ Auto-generated company wallet: ETH=${walletResult.ethAddress}, AVAX=${walletResult.avaxAddress}`);
          
          // Refresh company data
          company.ethAddress = walletResult.ethAddress;
          company.avaxAddress = walletResult.avaxAddress;
        } catch (walletError) {
          this.logger.error(`❌ Failed to auto-generate company wallet: ${walletError.message}`);
          throw new HttpException(
            'Company wallet generation failed. Please ensure you have a master wallet and try generating the company wallet manually.',
            HttpStatus.BAD_REQUEST
          );
        }
      }

      this.logger.log(`📋 Company wallet addresses - ETH: ${company.ethAddress || 'none'}, AVAX: ${company.avaxAddress || 'none'}`);

      // Get user's master wallet for fund forwarding
      const user_ = await this.userRepo.findOne({
        where: { id: user.sub },
        relations: ['userWallet'],
      });

      if (!user_ || !user_.userWallet) {
        throw new HttpException(
          'User does not have a master wallet configured',
          HttpStatus.BAD_REQUEST
        );
      }

      this.logger.log(`👤 Master wallet addresses - ETH: ${user_.userWallet.ethAddress || 'none'}, AVAX: ${user_.userWallet.avaxAddress || 'none'}`);

      // Use user's master wallet (prefer ETH, fallback to AVAX) for fund forwarding
      const masterWalletAddress = user_.userWallet.ethAddress || user_.userWallet.avaxAddress!;

      // Use company's primary wallet address (prefer ETH, fallback to AVAX)
      let walletAddress = company.ethAddress || company.avaxAddress!;

      this.logger.log(`🔍 Initial addresses - Company: ${walletAddress}, Master: ${masterWalletAddress}, Same: ${walletAddress.toLowerCase() === masterWalletAddress.toLowerCase()}`);
      
      // Check if company wallet is mistakenly set to master wallet
      if (walletAddress.toLowerCase() === masterWalletAddress.toLowerCase()) {
        this.logger.error(`❌ Company ${company.id} wallet is incorrectly set to master wallet ${masterWalletAddress}`);
        this.logger.log(`🔄 Attempting to regenerate company child wallet...`);
        
        // Force regenerate by deleting existing company wallet first
        try {
          await this.dataSource.query(
            'DELETE FROM company_wallets WHERE "companyId" = $1',
            [company.id]
          );
          this.logger.log(`🗑️  Deleted incorrect company wallet record`);
          
          // Generate new child wallet
          const walletResult = await this.walletService.generateCompanyWallet(user.sub, company.id);
          this.logger.log(`✅ Regenerated company wallet: ETH=${walletResult.ethAddress}, AVAX=${walletResult.avaxAddress}`);
          
          // Update company with new addresses
          company.ethAddress = walletResult.ethAddress;
          company.avaxAddress = walletResult.avaxAddress;
          
          // Recalculate wallet address with new values
          walletAddress = company.ethAddress || company.avaxAddress!;
          
          // Verify they're different now
          if (walletAddress.toLowerCase() === masterWalletAddress.toLowerCase()) {
            throw new Error('Regenerated wallet is still the same as master wallet. This should not happen.');
          }
          
          this.logger.log(`✅ Successfully regenerated different child wallet: ${walletAddress}`);
        } catch (regenError) {
          this.logger.error(`❌ Failed to regenerate company wallet: ${regenError.message}`);
          throw new HttpException(
            'Company wallet is incorrectly configured and auto-fix failed. Please delete the company and recreate it.',
            HttpStatus.BAD_REQUEST
          );
        }
      }

      // Deploy escrow contracts using user's private key from database
      const result = await this.escrowService.deployEscrowContracts(
        user.sub, // Pass userId to fetch user's wallet from database
        dto.wishlistItemId,
        walletAddress,
        masterWalletAddress,
        dto.targetAmountEth,
        dto.durationInDays,
        dto.chains,
        dto.campaignName || wishlistItem.title,
        dto.campaignDescription || wishlistItem.description || ''
      );

      // Save deployment records to database
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + dto.durationInDays);

      // Validate that at least one contract was deployed
      if (!result.ethereumAddress && !result.avalancheAddress) {
        throw new HttpException(
          'No contracts were deployed. Factory addresses may not be configured properly.',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

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
          campaignName: dto.campaignName || wishlistItem.title,
          campaignDescription: dto.campaignDescription || wishlistItem.description || '',
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
          campaignName: dto.campaignName || wishlistItem.title,
          campaignDescription: dto.campaignDescription || wishlistItem.description || '',
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
      this.logger.error(`❌ Failed to create escrow: ${error?.message || error}`);
      this.logger.error(error?.stack);

      // User-friendly error messages without exposing infrastructure details
      let userMessage = 'Failed to deploy escrow contracts';
      let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

      if (error instanceof HttpException) {
        throw error;
      }

      // Check for common blockchain/RPC errors
      if (error.message?.includes('factories are not configured') || error.message?.includes('factory contracts configured')) {
        userMessage = 'Smart contract deployment is not yet configured on this network. Please contact support.';
      } else if (error.message?.includes('No contract code found')) {
        userMessage = 'Smart contract factory is not deployed on the requested network. Please contact support.';
      } else if (error.message?.includes('No working') || error.message?.includes('RPC')) {
        userMessage = 'Blockchain service temporarily unavailable. Please try again in a few moments.';
      } else if (error.message?.includes('Insufficient funds') || error.message?.includes('insufficient funds') || error.message?.includes('zero balance')) {
        userMessage = 'Insufficient funds in wallet. Please ensure you have enough balance for gas fees.';
      } else if (error.message?.includes('Invalid') || error.message?.includes('invalid address')) {
        userMessage = 'Invalid wallet address. Please check your wallet configuration.';
      } else if (error.message?.includes('Simulation failed') || error.message?.includes('reverted')) {
        userMessage = 'Contract deployment validation failed. This may be due to incorrect parameters or network issues.';
      } else if (error.message?.includes('nonce')) {
        userMessage = 'Transaction ordering issue. Please try again.';
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
        userMessage = 'Network connection error. Please check your internet connection and try again.';
      } else if (error.message?.includes('wallet not found')) {
        userMessage = error.message;
        statusCode = HttpStatus.BAD_REQUEST;
      }

      throw new HttpException(
        {
          statusCode,
          message: userMessage,
          error: 'DeploymentFailed',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
        statusCode
      );
    }
  }

  /**
   * Estimate gas costs for deploying escrow contracts
   */
  @Post('estimate-gas')
  @UseGuards(AuthGuard('jwt'))
  async estimateGas(
    @Body() dto: CreateEscrowDto,
    @CurrentUser() user: any
  ) {
    this.logger.log(`📊 Estimating gas for wishlist item: ${dto.wishlistItemId} by user: ${user.sub}`);
    this.logger.debug(`DTO: ${JSON.stringify(dto)}`);

    try {
      // Verify wishlist item exists and user has permission
      const wishlistItem = await this.wishlistRepo.findOne({
        where: { id: dto.wishlistItemId },
        relations: ['company'],
      });

      if (!wishlistItem) {
        throw new HttpException('Wishlist item not found', HttpStatus.NOT_FOUND);
      }

      const company = await this.companyRepo.findOne({
        where: { id: wishlistItem.companyId },
      });

      if (!company || company.ownerId !== user.sub) {
        throw new HttpException(
          'You do not have permission to estimate gas for this company',
          HttpStatus.FORBIDDEN
        );
      }

      // Get user's master wallet
      const user_ = await this.userRepo.findOne({
        where: { id: user.sub },
        relations: ['userWallet'],
      });

      if (!user_ || !user_.userWallet) {
        throw new HttpException(
          'User does not have a master wallet configured. Please generate a wallet first.',
          HttpStatus.BAD_REQUEST
        );
      }

      // Check if company has wallet addresses
      if (!company.ethAddress && !company.avaxAddress) {
        throw new HttpException(
          'Company must have at least one wallet address configured',
          HttpStatus.BAD_REQUEST
        );
      }

      // Estimate gas costs
      const gasEstimate = await this.escrowService.estimateDeploymentGas(
        user.sub,
        dto.wishlistItemId,
        company.ethAddress || company.avaxAddress!,
        dto.targetAmountEth,
        dto.durationInDays,
        dto.chains,
        dto.campaignName || wishlistItem.title,
        dto.campaignDescription || wishlistItem.description || ''
      );

      return {
        success: true,
        data: gasEstimate,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to estimate gas: ${error?.message || error}`);
      this.logger.error(error?.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      // Return more specific error messages
      let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      let message = error?.message || 'Failed to estimate gas costs';

      // Check for validation/setup errors (400)
      if (message.includes('wallet not found') || 
          message.includes('wallet configured') ||
          message.includes('Invalid') ||
          message.includes('must have')) {
        statusCode = HttpStatus.BAD_REQUEST;
      }

      throw new HttpException(message, statusCode);
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
