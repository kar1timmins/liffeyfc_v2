import { Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Web3Controller } from './web3.controller';
import { WalletController } from './wallet.controller';
import { Web3Service } from './web3.service';
import { WalletGenerationService } from './wallet-generation.service';
import { NonceService } from './nonce.service';
import { RedisNonceService } from './nonce.redis.service';
import { UserWallet } from '../entities/user-wallet.entity';
import { CompanyWallet } from '../entities/company-wallet.entity';
import { User } from '../entities/user.entity';
import { Company } from '../entities/company.entity';

const nonceProvider: Provider = {
  provide: NonceService,
  useFactory: () => {
    // If REDIS_URL is configured, use RedisNonceService, otherwise fall back to in-memory NonceService
    if (process.env.REDIS_URL) {
      return new RedisNonceService() as unknown as NonceService;
    }
    return new NonceService();
  },
};

@Module({
  imports: [
    TypeOrmModule.forFeature([UserWallet, CompanyWallet, User, Company]),
  ],
  controllers: [Web3Controller, WalletController],
  providers: [Web3Service, WalletGenerationService, nonceProvider],
  exports: [Web3Service, WalletGenerationService, NonceService],
})
export class Web3Module {}
