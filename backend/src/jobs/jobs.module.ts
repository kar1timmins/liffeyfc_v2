import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeploymentQueueService } from './deployment-queue.service';
import { DeploymentWorkerService } from './deployment-worker.service';
import { Payment } from '../entities/payment.entity';
import { Web3Module } from '../web3/web3.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment]),
    Web3Module, // Import Web3Module to access EscrowContractService
  ],
  providers: [DeploymentQueueService, DeploymentWorkerService],
  exports: [DeploymentQueueService], // Export queue service for use in PaymentsModule
})
export class JobsModule {}
