import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvestorsService } from './investors.service';
import { InvestorsController } from './investors.controller';
import { Investor } from '../entities/investor.entity';
import { User } from '../entities/user.entity';
import { Wallet } from '../entities/wallet.entity';
import { RefreshToken } from '../entities/refresh-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Investor, User, Wallet, RefreshToken])],
  providers: [InvestorsService],
  controllers: [InvestorsController],
  exports: [InvestorsService],
})
export class InvestorsModule {}
