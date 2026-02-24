import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../entities/user.entity';
import { UserWallet } from '../entities/user-wallet.entity';
import { Company } from '../entities/company.entity';
import { Payment } from '../entities/payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserWallet, Company, Payment])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
