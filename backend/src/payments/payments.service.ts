import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { Company } from '../entities/company.entity';
import { USDCValidatorService } from './usdc-validator.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

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
    private usdcValidator: USDCValidatorService,
  ) {}

  /**
   * Create and validate a payment for contract deployment
   */
  async createPayment(
    userId: string,
    dto: CreatePaymentDto
  ): Promise<Payment> {
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
        'You do not have permission to create deployments for this company'
      );
    }

    // 2. Check if transaction has already been used
    const existingPayment = await this.paymentRepo.findOne({
      where: { usdcTxHash: dto.usdcTxHash },
    });

    if (existingPayment) {
      throw new BadRequestException(
        'This transaction has already been used for a payment'
      );
    }

    // 3. Get platform's USDC receiver address
    const platformAddress = this.usdcValidator.getPlatformUSDCAddress(dto.chain);

    // 4. Validate USDC payment on-chain
    this.logger.log(`🔍 Validating USDC payment on ${dto.chain}...`);
    const validationResult = await this.usdcValidator.validateUSDCPayment(
      dto.usdcTxHash,
      dto.chain,
      dto.usdcAmount,
      platformAddress
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
    }
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
   * Get pending payments (confirmed but not yet deployed)
   */
  async getPendingPayments(): Promise<Payment[]> {
    return this.paymentRepo.find({
      where: { status: PaymentStatus.CONFIRMED },
      relations: ['user', 'wishlistItem'],
      order: { confirmedAt: 'ASC' },
    });
  }
}
