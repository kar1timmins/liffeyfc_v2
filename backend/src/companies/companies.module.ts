import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { Company } from '../entities/company.entity';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { User } from '../entities/user.entity';
import { Wallet } from '../entities/wallet.entity';
import { UsersService } from '../users/users.service';

@Module({
  imports: [TypeOrmModule.forFeature([Company, WishlistItem, User, Wallet])],
  controllers: [CompaniesController],
  providers: [CompaniesService, UsersService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
