import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeploymentQueueService } from './deployment-queue.service';
import { DeploymentWorkerService } from './deployment-worker.service';
import { SentinelListenerService } from './sentinel-listener.service';
import { Payment } from '../entities/payment.entity';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { EscrowDeployment } from '../entities/escrow-deployment.entity';
import { Contribution } from '../entities/contribution.entity';
import { UserWallet } from '../entities/user-wallet.entity';
import { Web3Module } from '../web3/web3.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Payment,
      WishlistItem,
      EscrowDeployment,
      Contribution,
      UserWallet,
    ]),
    Web3Module, // Provides CryptoPricesService, NotificationsService, EscrowContractService, BountiesService
  ],
  providers: [DeploymentQueueService, DeploymentWorkerService, SentinelListenerService],
  exports: [DeploymentQueueService], // Export queue service for use in PaymentsModule
})
export class JobsModule {}
