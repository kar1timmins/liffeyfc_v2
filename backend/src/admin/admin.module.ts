import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../entities/user.entity';
import { UserWallet } from '../entities/user-wallet.entity';
import { Company } from '../entities/company.entity';
import { Payment } from '../entities/payment.entity';
import { Contribution } from '../entities/contribution.entity';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { Web3Module } from '../web3/web3.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserWallet, Company, Payment, Contribution, WishlistItem]),
    Web3Module, // needed for WalletGenerationService
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
