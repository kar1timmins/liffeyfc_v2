import { Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Web3Controller } from './web3.controller';
import { WalletController } from './wallet.controller';
import { EscrowController } from './escrow.controller';
import { BountiesController } from './bounties.controller';
import { WalletBalanceController } from './wallet-balance.controller';
import { CryptoPricesController } from './crypto-prices.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Web3Service } from './web3.service';
import { WalletGenerationService } from './wallet-generation.service';
import { EscrowContractService } from './escrow-contract.service';
import { BountiesService } from './bounties.service';
import { CryptoPricesService } from './crypto-prices.service';
import { PlatformWalletService } from './platform-wallet.service';
import { NonceService } from './nonce.service';
import { RedisNonceService } from './nonce.redis.service';
import { UserWallet } from '../entities/user-wallet.entity';
import { CompanyWallet } from '../entities/company-wallet.entity';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { User } from '../entities/user.entity';
import { Company } from '../entities/company.entity';
import { EscrowDeployment } from '../entities/escrow-deployment.entity';
import { Contribution } from '../entities/contribution.entity';
import { ContractDeploymentHistory } from '../entities/contract-deployment-history.entity';
import { ContractHistoryService } from './contract-history.service';
import { UsersModule } from '../users/users.module';
import { CommonModule } from '../common/common.module';

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
    TypeOrmModule.forFeature([
      UserWallet,
      CompanyWallet,
      WishlistItem,
      User,
      Company,
      EscrowDeployment,
      Contribution,
      ContractDeploymentHistory,
    ]),
    ConfigModule,
    UsersModule,
    CommonModule,
  ],
  controllers: [
    Web3Controller,
    WalletController,
    EscrowController,
    BountiesController,
    WalletBalanceController,
    CryptoPricesController,
    NotificationsController,
  ],
  providers: [
    Web3Service,
    WalletGenerationService,
    EscrowContractService,
    BountiesService,
    CryptoPricesService,
    PlatformWalletService,
    ContractHistoryService,
    NotificationsService,
    nonceProvider,
  ],
  exports: [
    Web3Service,
    WalletGenerationService,
    EscrowContractService,
    BountiesService,
    CryptoPricesService,
    PlatformWalletService,
    ContractHistoryService,
    NonceService,
    NotificationsService,
  ],
})
export class Web3Module {}
