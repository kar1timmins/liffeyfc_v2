import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { EscrowContractService } from '../web3/escrow-contract.service';
import { DeploymentJobData } from './deployment-queue.service';

/**
 * Worker service that processes deployment jobs from the queue
 * Uses platform wallet to deploy contracts (not user's wallet)
 */
@Injectable()
export class DeploymentWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeploymentWorkerService.name);
  private worker: Worker<DeploymentJobData>;
  private redisConnection: any;

  constructor(
    private configService: ConfigService,
    private escrowService: EscrowContractService,
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
  ) {}

  async onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    this.logger.log(
      `📡 Worker connecting to Redis: ${redisUrl.replace(/:[^:]*@/, ':****@')}`,
    );

    // Parse Redis URL
    const redisConfig = this.parseRedisUrl(redisUrl);

    this.redisConnection = {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

    // Create worker
    this.worker = new Worker<DeploymentJobData>(
      'escrow-deployment',
      async (job: Job<DeploymentJobData>) => this.processDeployment(job),
      {
        connection: this.redisConnection,
        concurrency: 2, // Process 2 jobs concurrently
        limiter: {
          max: 5, // Max 5 jobs per duration
          duration: 60000, // Per minute (rate limiting to avoid RPC throttling)
        },
      },
    );

    // Worker event listeners
    this.worker.on('completed', (job) => {
      this.logger.log(`✅ Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`❌ Job ${job?.id} failed: ${error.message}`);
    });

    this.worker.on('error', (error) => {
      this.logger.error(`❌ Worker error: ${error.message}`);
    });

    this.logger.log('✅ Deployment worker started');
  }

  async onModuleDestroy() {
    await this.worker.close();
    this.logger.log('🔌 Deployment worker closed');
  }

  /**
   * Parse Redis URL into connection options
   */
  private parseRedisUrl(redisUrl: string): {
    host: string;
    port: number;
    password?: string;
  } {
    try {
      const url = new URL(redisUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
      };
    } catch (error) {
      this.logger.warn(`⚠️  Failed to parse REDIS_URL, using localhost:6379`);
      return {
        host: 'localhost',
        port: 6379,
      };
    }
  }

  /**
   * Process a deployment job
   * This is where the actual contract deployment happens
   */
  private async processDeployment(job: Job<DeploymentJobData>) {
    const { paymentId, ...deploymentData } = job.data;

    this.logger.log(`🚀 Processing deployment job: ${job.id}`);
    this.logger.log(`   Payment ID: ${paymentId}`);
    this.logger.log(`   Chains: ${deploymentData.chains.join(', ')}`);

    try {
      // Update payment status to deploying
      await job.updateProgress(10);
      await this.updatePaymentStatus(paymentId, 'deploying');

      // Deploy escrow contracts using platform wallet
      await job.updateProgress(30);
      this.logger.log(
        `📋 Starting contract deployment with PLATFORM wallet...`,
      );

      const result =
        await this.escrowService.deployEscrowContractsWithPlatformWallet(
          deploymentData.userId,
          deploymentData.wishlistItemId,
          deploymentData.companyWalletAddress,
          deploymentData.masterWalletAddress,
          deploymentData.targetAmountEth,
          deploymentData.durationInDays,
          deploymentData.chains,
          deploymentData.campaignName || null,
          deploymentData.campaignDescription || null,
        );

      await job.updateProgress(90);

      // Update payment with deployment results
      await this.paymentRepo.update(paymentId, {
        status: PaymentStatus.DEPLOYED,
        deployedAt: new Date(),
        deployedContracts: {
          ethereum: result.ethereumAddress,
          avalanche: result.avalancheAddress,
        },
        deploymentTxHashes: result.transactionHashes,
      });

      await job.updateProgress(100);

      this.logger.log(`✅ Deployment completed successfully`);
      this.logger.log(`   Ethereum: ${result.ethereumAddress || 'N/A'}`);
      this.logger.log(`   Avalanche: ${result.avalancheAddress || 'N/A'}`);

      return {
        success: true,
        deployedContracts: {
          ethereum: result.ethereumAddress,
          avalanche: result.avalancheAddress,
        },
        transactionHashes: result.transactionHashes,
      };
    } catch (error) {
      this.logger.error(`❌ Deployment failed: ${error.message}`);

      // Update payment status to failed
      await this.paymentRepo.update(paymentId, {
        status: PaymentStatus.FAILED,
        errorMessage: error.message,
      });

      throw error; // Re-throw to mark job as failed (will trigger retry)
    }
  }

  /**
   * Update payment status (intermediate states)
   */
  private async updatePaymentStatus(paymentId: string, status: string) {
    // Note: 'deploying' is not in PaymentStatus enum yet, but we can store in errorMessage temporarily
    // or add it to the enum later
    this.logger.log(`📝 Payment ${paymentId} status: ${status}`);
  }
}
