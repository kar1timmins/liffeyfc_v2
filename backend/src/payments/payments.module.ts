import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { USDCValidatorService } from './usdc-validator.service';
import { Payment } from '../entities/payment.entity';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { Company } from '../entities/company.entity';
import { UserWallet } from '../entities/user-wallet.entity';
import { JobsModule } from '../jobs/jobs.module';
import { Web3Module } from '../web3/web3.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, WishlistItem, Company, UserWallet]),
    JobsModule, // Import JobsModule to access DeploymentQueueService
    Web3Module, // Import Web3Module to access PlatformWalletService
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, USDCValidatorService],
  exports: [PaymentsService, USDCValidatorService],
})
export class PaymentsModule {}
