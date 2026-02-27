import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { Company } from '../entities/company.entity';
import { UserWallet } from '../entities/user-wallet.entity';
import { USDCValidatorService } from './usdc-validator.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PlatformWalletService } from '../web3/platform-wallet.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    @InjectRepository(WishlistItem)
    private wishlistRepo: Repository<WishlistItem>,
    @InjectRepository(Company)
    private companyRepo: Repository<Company>,
    @InjectRepository(UserWallet)
    private userWalletRepo: Repository<UserWallet>,
    private usdcValidator: USDCValidatorService,
    private platformWalletService: PlatformWalletService,
  ) {}

  /**
   * Fetch the user's master wallet ETH address from the database.
   * Returns null if no master wallet has been generated yet.
   */
  async getMasterWalletEthAddress(userId: string): Promise<string | null> {
    const wallet = await this.userWalletRepo.findOne({ where: { userId } });
    return wallet?.ethAddress ?? null;
  }

  /**
   * Create and validate a payment for contract deployment
   */
  async createPayment(userId: string, dto: CreatePaymentDto): Promise<Payment> {
    this.logger.log(`💳 Creating payment for user ${userId}`);

    // 1. Verify wishlist item exists and user owns the company
    const wishlistItem = await this.wishlistRepo.findOne({
      where: { id: dto.wishlistItemId },
      relations: ['company'],
    });

    if (!wishlistItem) {
      throw new NotFoundException('Wishlist item not found');
    }

    const company = await this.companyRepo.findOne({
      where: { id: wishlistItem.companyId },
    });

    if (!company || company.ownerId !== userId) {
      throw new BadRequestException(
        'You do not have permission to create deployments for this company',
      );
    }

    // 2. Check if transaction has already been used
    const existingPayment = await this.paymentRepo.findOne({
      where: { usdcTxHash: dto.usdcTxHash },
    });

    if (existingPayment) {
      throw new BadRequestException(
        'This transaction has already been used for a payment',
      );
    }

    // 3. Get platform's USDC receiver address
    const platformAddress = this.usdcValidator.getPlatformUSDCAddress(
      dto.chain,
    );

    // 4. Validate USDC payment on-chain
    this.logger.log(`🔍 Validating USDC payment on ${dto.chain}...`);
    const validationResult = await this.usdcValidator.validateUSDCPayment(
      dto.usdcTxHash,
      dto.chain,
      dto.usdcAmount,
      platformAddress,
    );

    if (!validationResult.valid) {
      throw new BadRequestException('USDC payment validation failed');
    }

    // 5. Create payment record
    const payment = this.paymentRepo.create({
      userId,
      wishlistItemId: dto.wishlistItemId,
      usdcTxHash: dto.usdcTxHash,
      usdcAmount: validationResult.amount,
      chain: dto.chain as any, // Cast to enum
      fromAddress: validationResult.from,
      toAddress: validationResult.to,
      status: PaymentStatus.CONFIRMED,
      confirmedAt: validationResult.timestamp,
      deploymentChains: dto.deploymentChains,
    });

    const savedPayment = await this.paymentRepo.save(payment);

    this.logger.log(`✅ Payment created and confirmed: ${savedPayment.id}`);
    this.logger.log(`   Amount: ${validationResult.amount} USDC`);
    this.logger.log(`   From: ${validationResult.from}`);
    this.logger.log(`   Block: ${validationResult.blockNumber}`);

    return savedPayment;
  }

  /**
   * Create a payment record for a master-wallet payment (off-chain acknowledgement)
   * No on-chain tx is required from the user MetaMask wallet.
   */
  async createMasterWalletPayment(
    userId: string,
    dto: import('./dto/create-master-wallet-payment.dto').CreateMasterWalletPaymentDto,
  ): Promise<Payment> {
    this.logger.log(`💳 Creating master-wallet payment for user ${userId}`);

    // Verify wishlist item exists and user owns the company
    const wishlistItem = await this.wishlistRepo.findOne({
      where: { id: dto.wishlistItemId },
      relations: ['company'],
    });

    if (!wishlistItem) {
      throw new NotFoundException('Wishlist item not found');
    }

    const company = await this.companyRepo.findOne({
      where: { id: wishlistItem.companyId },
    });

    if (!company || company.ownerId !== userId) {
      throw new BadRequestException(
        'You do not have permission to create deployments for this company',
      );
    }

    // Prevent duplicate confirmed payments for same wishlist item
    const existing = await this.paymentRepo.findOne({
      where: {
        wishlistItemId: dto.wishlistItemId,
        status: PaymentStatus.CONFIRMED,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'A confirmed payment already exists for this wishlist item',
      );
    }

    // Platform receiver address for record keeping
    const platformAddress = this.usdcValidator.getPlatformUSDCAddress(
      dto.chain,
    );

    const payment = this.paymentRepo.create({
      userId,
      wishlistItemId: dto.wishlistItemId,
      usdcTxHash: null,
      usdcAmount: dto.usdcAmount,
      chain: dto.chain as any,
      fromAddress: null,
      toAddress: platformAddress,
      status: PaymentStatus.CONFIRMED,
      confirmedAt: new Date(),
      deploymentChains: dto.deploymentChains,
      paymentMethod: 'master-wallet',
    });

    const saved = await this.paymentRepo.save(payment);

    this.logger.log(`✅ Master-wallet payment created: ${saved.id}`);

    return saved;
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['user', 'wishlistItem'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  /**
   * Get all payments for a user
   */
  async getUserPayments(userId: string): Promise<Payment[]> {
    return this.paymentRepo.find({
      where: { userId },
      relations: ['wishlistItem'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get payment by transaction hash
   */
  async getPaymentByTxHash(txHash: string): Promise<Payment | null> {
    return this.paymentRepo.findOne({
      where: { usdcTxHash: txHash },
    });
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    options?: {
      errorMessage?: string;
      deployedContracts?: { ethereum?: string; avalanche?: string };
      deploymentTxHashes?: { ethereum?: string; avalanche?: string };
    },
  ): Promise<Payment> {
    const payment = await this.getPaymentById(paymentId);

    payment.status = status;

    if (status === PaymentStatus.DEPLOYED) {
      payment.deployedAt = new Date();
      if (options?.deployedContracts) {
        payment.deployedContracts = options.deployedContracts;
      }
      if (options?.deploymentTxHashes) {
        payment.deploymentTxHashes = options.deploymentTxHashes;
      }
    }

    if (status === PaymentStatus.FAILED && options?.errorMessage) {
      payment.errorMessage = options.errorMessage;
    }

    return this.paymentRepo.save(payment);
  }

  /**
   * Get wishlist item by ID (with company relation)
   */
  async getWishlistItemById(wishlistItemId: string): Promise<WishlistItem> {
    const wishlistItem = await this.wishlistRepo.findOne({
      where: { id: wishlistItemId },
      relations: ['company'],
    });

    if (!wishlistItem) {
      throw new NotFoundException('Wishlist item not found');
    }

    return wishlistItem;
  }

  /**
   * Get pending payments (confirmed but not yet deployed)
   */
  async getPendingPayments(): Promise<Payment[]> {
    return this.paymentRepo.find({
      where: { status: PaymentStatus.CONFIRMED },
      relations: ['user', 'wishlistItem'],
      order: { confirmedAt: 'ASC' },
    });
  }

  /**
   * Estimate deployment costs in USDC
   * Returns gas cost estimates with conversion to USDC
   * Uses historical averages since exact gas estimation requires contract parameters
   */
  async estimateDeploymentCosts(chains: ('ethereum' | 'avalanche')[]): Promise<{
    breakdown: { chain: string; gasCostETH: string; gasCostUSD: number }[];
    totalUSD: number;
    platformFeeUSD: number;
    grandTotalUSD: number;
  }> {
    this.logger.log(
      `📊 Estimating deployment costs for chains: ${chains.join(', ')}`,
    );

    const ETH_TO_USD = 3800; // Approximate rate (in production, fetch from price oracle like Chainlink)
    const AVAX_TO_USD = 40; // Approximate rate (in production, fetch from price oracle)
    const PLATFORM_FEE_USD = 0; // No platform fee currently

    // Historical gas cost estimates for contract deployment
    // Based on CompanyWishlistEscrow.sol deployment costs
    const GAS_ESTIMATES = {
      ethereum: '0.002', // ~2M gas * 50 gwei = 0.001 ETH + buffer
      avalanche: '0.01', // Avalanche is cheaper per gas but deployment cost is similar
    };

    const breakdown: {
      chain: string;
      gasCostETH: string;
      gasCostUSD: number;
    }[] = [];

    for (const chain of chains) {
      const gasCostETH = GAS_ESTIMATES[chain];
      const rate = chain === 'ethereum' ? ETH_TO_USD : AVAX_TO_USD;
      const gasCostUSD = parseFloat(gasCostETH) * rate;

      breakdown.push({
        chain: chain.charAt(0).toUpperCase() + chain.slice(1),
        gasCostETH,
        gasCostUSD: Math.round(gasCostUSD * 100) / 100,
      });

      this.logger.log(
        `   ${chain}: ${gasCostETH} ${chain === 'ethereum' ? 'ETH' : 'AVAX'} (~$${gasCostUSD.toFixed(2)})`,
      );
    }

    const totalUSD = breakdown.reduce((sum, item) => sum + item.gasCostUSD, 0);
    const grandTotalUSD = Math.round((totalUSD + PLATFORM_FEE_USD) * 100) / 100;

    this.logger.log(
      `💰 Total estimated cost: $${grandTotalUSD.toFixed(2)} USDC`,
    );

    return {
      breakdown,
      totalUSD: Math.round(totalUSD * 100) / 100,
      platformFeeUSD: PLATFORM_FEE_USD,
      grandTotalUSD,
    };
  }
}
