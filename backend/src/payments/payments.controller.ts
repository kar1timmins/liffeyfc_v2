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
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly usdcValidator: USDCValidatorService,
  ) {}

  /**
   * Create a payment for contract deployment
   * This validates the USDC payment and creates a payment record
   * The actual deployment is handled by a separate queue worker
   */
  @Post('create')
  @UseGuards(AuthGuard('jwt'))
  async createPayment(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: any
  ) {
    try {
      this.logger.log(`💳 Payment creation request from user ${user.sub}`);

      const payment = await this.paymentsService.createPayment(user.sub, dto);

      return {
        success: true,
        message: 'Payment validated successfully. Deployment queued.',
        data: {
          paymentId: payment.id,
          status: payment.status,
          usdcAmount: payment.usdcAmount,
          chain: payment.chain,
          confirmedAt: payment.confirmedAt,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Payment creation failed: ${error.message}`);
      throw new HttpException(
        error.message || 'Failed to create payment',
        error.status || HttpStatus.BAD_REQUEST
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
      const existingPayment = await this.paymentsService.getPaymentByTxHash(dto.txHash);
      if (existingPayment) {
        return {
          success: false,
          message: 'Transaction already used for a payment',
          data: null,
        };
      }

      // Get platform address
      const platformAddress = this.usdcValidator.getPlatformUSDCAddress(dto.chain);

      // Validate (with minimal expected amount for verification)
      const result = await this.usdcValidator.validateUSDCPayment(
        dto.txHash,
        dto.chain,
        0.01, // Minimal amount just to verify it's a valid USDC tx
        platformAddress
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
      this.logger.error(`❌ Payment verification failed: ${error.message}`);
      return {
        success: false,
        message: error.message || 'Payment verification failed',
        data: null,
      };
    }
  }

  /**
   * Get payment details by ID
   */
  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async getPayment(
    @Param('id') paymentId: string,
    @CurrentUser() user: any
  ) {
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
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get payment',
        error.status || HttpStatus.BAD_REQUEST
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
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get payments',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
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
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get payment info',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
