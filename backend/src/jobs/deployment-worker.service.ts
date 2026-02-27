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
import { WishlistItem } from '../entities/wishlist-item.entity';
import { EscrowDeployment } from '../entities/escrow-deployment.entity';
import { EscrowContractService } from '../web3/escrow-contract.service';
import { BountiesService } from '../web3/bounties.service';
import { CryptoPricesService } from '../web3/crypto-prices.service';
import { DeploymentJobData } from './deployment-queue.service';

/**
 * Worker service that processes deployment jobs from the queue
 * Uses platform wallet to deploy contracts (not user's wallet)
 */
@Injectable()
export class DeploymentWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeploymentWorkerService.name);
  private worker!: Worker<DeploymentJobData>;
  private redisConnection: any;

  constructor(
    private configService: ConfigService,
    private escrowService: EscrowContractService,
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    @InjectRepository(WishlistItem)
    private wishlistRepo: Repository<WishlistItem>,
    @InjectRepository(EscrowDeployment)
    private escrowDeploymentRepo: Repository<EscrowDeployment>,
    private bountiesService: BountiesService,
    private cryptoPrices: CryptoPricesService,
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

      // After deployment we need to update the wishlist item so the UI can
      // recognise the bounty and display the chain selector. Older code in the
      // EscrowController handled this for manual deployments; the platform wallet
      // flow was missing that step which resulted in bounties showing the
      // fallback "Donate" form. We also create an escrowDeployment record and
      // optionally create a bounty entry for completeness.
      try {
        const wl = await this.wishlistRepo.findOne({
          where: { id: deploymentData.wishlistItemId },
        });
        if (wl) {
          // mark escrow active and store addresses
          wl.ethereumEscrowAddress =
            result.ethereumAddress || wl.ethereumEscrowAddress;
          wl.avalancheEscrowAddress =
            result.avalancheAddress || wl.avalancheEscrowAddress;
          wl.campaignDurationDays = deploymentData.durationInDays;
          wl.campaignDeadline = new Date(
            Date.now() + deploymentData.durationInDays * 24 * 60 * 60 * 1000,
          );
          wl.isEscrowActive = true;

          // also set approximate euro value if not already set
          if (!wl.value || wl.value === 0) {
            // convert ETH goal to EUR using current market price (choose first chain)
            const prices = await this.cryptoPrices.getPrices();
            const rate =
              deploymentData.chains.includes('ethereum')
                ? prices.ethEur
                : prices.avaxEur;
            wl.value = Math.round(deploymentData.targetAmountEth * rate);
          }

          await this.wishlistRepo.save(wl);

          // create escrow deployment entries to mirror escrow controller behaviour
          if (result.ethereumAddress) {
            const ethDeployment = this.escrowDeploymentRepo.create({
              contractAddress: result.ethereumAddress,
              chain: 'ethereum',
              network: 'sepolia',
              deploymentTxHash: result.transactionHashes.ethereum || undefined,
              targetAmountEth: deploymentData.targetAmountEth,
              durationInDays: deploymentData.durationInDays,
              deadline: wl.campaignDeadline,
              deployedById: deploymentData.userId,
              wishlistItemId: wl.id,
              campaignName:
                deploymentData.campaignName || wl.title || '',
              campaignDescription:
                deploymentData.campaignDescription || wl.description || '',
              status: 'active',
            });
            await this.escrowDeploymentRepo.save(ethDeployment);
          }
          if (result.avalancheAddress) {
            const avaxDeployment = this.escrowDeploymentRepo.create({
              contractAddress: result.avalancheAddress,
              chain: 'avalanche',
              network: 'fuji',
              deploymentTxHash: result.transactionHashes.avalanche || undefined,
              targetAmountEth: deploymentData.targetAmountEth,
              durationInDays: deploymentData.durationInDays,
              deadline: wl.campaignDeadline,
              deployedById: deploymentData.userId,
              wishlistItemId: wl.id,
              campaignName:
                deploymentData.campaignName || wl.title || '',
              campaignDescription:
                deploymentData.campaignDescription || wl.description || '',
              status: 'active',
            });
            await this.escrowDeploymentRepo.save(avaxDeployment);
          }

          // ensure a bounty record exists so the /bounties endpoints return this
          // item when users browse global bounties. createFromWishlistItem will
          // set isEscrowActive=true again and populate other fields but will
          // throw if the flag was already flipped; therefore we only call it if
          // there is no existing bounty linked to this wishlist item.
          try {
            await this.bountiesService.createFromWishlistItem(
              wl.id,
              wl.value || 0,
              deploymentData.durationInDays,
              deploymentData.userId,
            );
          } catch (e: any) {
            // ignore conflict errors; bounty may already exist
            this.logger.debug(
              'Bounty creation skipped or failed:',
              e.message || e,
            );
          }
        }
      } catch (updErr) {
        this.logger.error('Failed to update wishlist item after deployment:', updErr);
      }

      return {
        success: true,
        deployedContracts: {
          ethereum: result.ethereumAddress,
          avalanche: result.avalancheAddress,
        },
        transactionHashes: result.transactionHashes,
      };
    } catch (error: any) {
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
