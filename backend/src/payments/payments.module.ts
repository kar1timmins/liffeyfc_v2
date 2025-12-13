import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { USDCValidatorService } from './usdc-validator.service';
import { Payment } from '../entities/payment.entity';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { Company } from '../entities/company.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      WishlistItem,
      Company,
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, USDCValidatorService],
  exports: [PaymentsService, USDCValidatorService],
})
export class PaymentsModule {}
