
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
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService } from './payments.service';
import { USDCValidatorService } from './usdc-validator.service';
import { DeploymentQueueService } from '../jobs/deployment-queue.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateMasterWalletPaymentDto } from './dto/create-master-wallet-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly usdcValidator: USDCValidatorService,
    private readonly deploymentQueue: DeploymentQueueService,
  ) {}

  /**
   * Create a payment for contract deployment
   * This validates the USDC payment and creates a payment record
   * The actual deployment is handled by a separate queue worker
   */
  @Post('create')
  @UseGuards(AuthGuard('jwt'))
  async createPayment(@Body() dto: CreatePaymentDto, @CurrentUser() user: any) {
    try {
      this.logger.log(`💳 Payment creation request from user ${user.sub}`);

      // 1. Validate and create payment
      const payment = await this.paymentsService.createPayment(user.sub, dto);

      // 2. Queue deployment job
      this.logger.log(`📋 Queuing deployment job for payment ${payment.id}`);

      // Get wishlist item to extract company wallet info
      const wishlistItem = await this.paymentsService.getWishlistItemById(
        dto.wishlistItemId,
      );

      const jobId = await this.deploymentQueue.queueDeployment({
        paymentId: payment.id,
        userId: user.sub,
        wishlistItemId: dto.wishlistItemId,
        companyWalletAddress: wishlistItem.company.ethAddress || '', // Company child wallet
        masterWalletAddress: user.wallet?.ethAddress || '', // User master wallet (if available)
        targetAmountEth: dto.targetAmountEth,
        durationInDays: dto.durationInDays,
        chains: dto.deploymentChains,
        campaignName: dto.campaignName,
        campaignDescription: dto.campaignDescription,
      });

      this.logger.log(`✅ Deployment queued with job ID: ${jobId}`);

      return {
        success: true,
        message: 'Payment validated successfully. Deployment queued.',
        data: {
          paymentId: payment.id,
          jobId,
          status: payment.status,
          usdcAmount: payment.usdcAmount,
          chain: payment.chain,
          confirmedAt: payment.confirmedAt,
        },
      };
    } catch (error: any) {
      this.logger.error(`❌ Payment creation failed: ${error.message}`);
      throw new HttpException(
        error.message || 'Failed to create payment',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Deploy bounty escrow contracts, funded from the user's platform master wallet.
   * No MetaMask / on-chain USDC tx required — deducted from stored master wallet.
   * Also available at POST /payments/create-master-wallet for backwards compatibility.
   */
  @Post('deploy')
  @UseGuards(AuthGuard('jwt'))
  async deployBounty(
    @Body() dto: CreateMasterWalletPaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.createMasterWalletPayment(dto, user);
  }

  /** @deprecated Use POST /payments/deploy instead */
  @Post('create-master-wallet')
  @UseGuards(AuthGuard('jwt'))
  async createMasterWalletPayment(
    @Body() dto: CreateMasterWalletPaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.deployBountyInternal(dto, user);
  }

  private async deployBountyInternal(
    dto: CreateMasterWalletPaymentDto,
    user: any,
  ) {
    try {
      this.logger.log(`💳 Master wallet payment request from user ${user.sub}`);

      // Resolve the user's master wallet ETH address from the database
      const masterWalletEthAddress =
        await this.paymentsService.getMasterWalletEthAddress(user.sub);
      if (!masterWalletEthAddress) {
        throw new Error('Master wallet not configured for user');
      }

      const payment = await this.paymentsService.createMasterWalletPayment(
        user.sub,
        dto,
      );

      // Queue deployment job
      const wishlistItem = await this.paymentsService.getWishlistItemById(
        dto.wishlistItemId,
      );

      const jobId = await this.deploymentQueue.queueDeployment({
        paymentId: payment.id,
        userId: user.sub,
        wishlistItemId: dto.wishlistItemId,
        companyWalletAddress: wishlistItem.company.ethAddress || '',
        masterWalletAddress: masterWalletEthAddress,
        targetAmountEth: dto.targetAmountEth,
        durationInDays: dto.durationInDays,
        chains: dto.deploymentChains,
        campaignName: dto.campaignName,
        campaignDescription: dto.campaignDescription,
      });

      return {
        success: true,
        message: 'Master wallet payment accepted. Deployment queued.',
        data: {
          paymentId: payment.id,
          jobId,
          status: payment.status,
        },
      };
    } catch (error: any) {
      this.logger.error(`❌ Master wallet payment failed: ${error.message}`);
      throw new HttpException(
        error.message || 'Failed to process master wallet payment',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Verify a USDC payment without creating a payment record
   * Useful for frontend to check if payment is valid before submission
   */
  @Post('verify')
  @UseGuards(AuthGuard('jwt'))
  async verifyPayment(@Body() dto: VerifyPaymentDto) {
    try {
      // Check if already used
      const existingPayment = await this.paymentsService.getPaymentByTxHash(
        dto.txHash,
      );
      if (existingPayment) {
        return {
          success: false,
          message: 'Transaction already used for a payment',
          data: null,
        };
      }

      // Get platform address
      const platformAddress = this.usdcValidator.getPlatformUSDCAddress(
        dto.chain,
      );

      // Validate (with minimal expected amount for verification)
      const result = await this.usdcValidator.validateUSDCPayment(
        dto.txHash,
        dto.chain,
        0.01, // Minimal amount just to verify it's a valid USDC tx
        platformAddress,
      );

      return {
        success: true,
        message: 'Payment verified successfully',
        data: {
          valid: result.valid,
          amount: result.amount,
          from: result.from,
          to: result.to,
          blockNumber: result.blockNumber,
          timestamp: result.timestamp,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Payment verification failed: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage || 'Payment verification failed',
        data: null,
      };
    }
  }

  /**
   * Get payment details by ID
   */
  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async getPayment(@Param('id') paymentId: string, @CurrentUser() user: any) {
    try {
      const payment = await this.paymentsService.getPaymentById(paymentId);

      // Only allow user to see their own payments
      if (payment.userId !== user.sub) {
        throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);
      }

      return {
        success: true,
        data: payment,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to get payment',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get all payments for current user
   */
  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getUserPayments(@CurrentUser() user: any) {
    try {
      const payments = await this.paymentsService.getUserPayments(user.sub);

      return {
        success: true,
        data: payments,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to get payments',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Estimate deployment costs in USDC
   * Provides real-time gas cost estimates
   */
  @Post('estimate')
  async estimateDeploymentCosts(
    @Body() body: { chains: ('ethereum' | 'avalanche')[] },
  ) {
    try {
      const { chains } = body;

      if (!chains || chains.length === 0) {
        throw new HttpException(
          'At least one chain must be specified',
          HttpStatus.BAD_REQUEST,
        );
      }

      const estimate =
        await this.paymentsService.estimateDeploymentCosts(chains);

      return {
        success: true,
        data: estimate,
      };
    } catch (error: any) {
      this.logger.error('Failed to estimate deployment costs:', error.message);
      throw new HttpException(
        error.message || 'Failed to estimate costs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get deployment job status
   * Poll this endpoint to track deployment progress
   */
  @Get('job/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    try {
      const jobStatus = await this.deploymentQueue.getJobStatus(jobId);

      return {
        success: true,
        data: jobStatus,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to get job status for ${jobId}:`,
        error.message,
      );
      throw new HttpException(
        error.message || 'Failed to get job status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get USDC contract address and platform receiver for a chain
   */
  @Get('info/:chain')
  async getPaymentInfo(@Param('chain') chain: 'ethereum' | 'avalanche') {
    try {
      const usdcAddress = this.usdcValidator.getUSDCAddress(chain);
      const platformAddress = this.usdcValidator.getPlatformUSDCAddress(chain);

      return {
        success: true,
        data: {
          chain,
          usdcContract: usdcAddress,
          platformReceiver: platformAddress,
          network: chain === 'ethereum' ? 'Sepolia Testnet' : 'Fuji Testnet',
        },
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to get payment info',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

    /**
   * Get all payments for a wishlist item (for frontend to merge deployed contracts)
   */
  @Get('wishlist/:wishlistItemId')
  async getPaymentsForWishlistItem(@Param('wishlistItemId') wishlistItemId: string) {
    try {
      const payments = await this.paymentsService.getPaymentsForWishlistItem(wishlistItemId);
      return {
        success: true,
        data: payments,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to get payments for wishlist item',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all payments for a company (across all wishlist items)
   * Useful for loading all deployments/payments in a single request.
   */
  @Get('company/:companyId')
  async getPaymentsForCompany(@Param('companyId') companyId: string) {
    try {
      const payments = await this.paymentsService.getPaymentsForCompany(companyId);
      return {
        success: true,
        data: payments,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to get payments for company',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
