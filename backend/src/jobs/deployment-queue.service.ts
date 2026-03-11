import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

export interface DeploymentJobData {
  paymentId: string;
  userId: string;
  wishlistItemId: string;
  companyWalletAddress: string;
  masterWalletAddress: string;
  targetAmountEth: number;
  durationInDays: number;
  chains: ('ethereum' | 'avalanche')[];
  campaignName?: string;
  campaignDescription?: string;
}

/**
 * Strip raw ethers.js transaction data from BullMQ failedReason strings so that
 * the API surface never leaks internal calldata or wallet addresses.
 */
function sanitizeJobFailedReason(reason: string): string {
  let msg = reason;
  // ethers appends serialised tx from "(action=" onwards — cut it off
  const cutMarkers = ['(action=', ' transaction=', '(transaction='];
  for (const marker of cutMarkers) {
    const idx = msg.indexOf(marker);
    if (idx > 0) {
      msg = msg.slice(0, idx).replace(/[,;]+$/, '').trim();
      break;
    }
  }
  return msg.length > 300 ? msg.slice(0, 297) + '…' : msg;
}

/**
 * Service to manage the deployment queue using BullMQ
 * Uses existing Railway Redis instance as the backing store
 */
@Injectable()
export class DeploymentQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeploymentQueueService.name);
  private queue!: Queue<DeploymentJobData>;
  private redisConnection: any;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    this.logger.log(
      `📡 Connecting to Redis for deployment queue: ${redisUrl.replace(/:[^:]*@/, ':****@')}`,
    );

    // Parse Redis URL to get connection options
    const redisConfig = this.parseRedisUrl(redisUrl);

    // Create shared Redis connection for BullMQ
    this.redisConnection = {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false, // Better for serverless/cloud Redis
    };

    // Create deployment queue
    this.queue = new Queue<DeploymentJobData>('escrow-deployment', {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 3, // Retry up to 3 times on failure
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 second delay
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 200, // Keep last 200 failed jobs for debugging
      },
    });

    // Listen to queue events
    this.queue.on('error', (error) => {
      this.logger.error(`❌ Queue error: ${error.message}`);
    });

    this.queue.on('waiting', (job) => {
      this.logger.log(`⏳ Job ${job.id} is waiting`);
    });

    this.logger.log('✅ Deployment queue initialized');
  }

  async onModuleDestroy() {
    await this.queue.close();
    this.logger.log('🔌 Deployment queue closed');
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
      // Fallback to localhost if URL parsing fails
      this.logger.warn(`⚠️  Failed to parse REDIS_URL, using localhost:6379`);
      return {
        host: 'localhost',
        port: 6379,
      };
    }
  }

  /**
   * Add a deployment job to the queue
   * This is called after USDC payment is validated
   */
  async queueDeployment(data: DeploymentJobData): Promise<string> {
    this.logger.log(`📝 Queuing deployment for payment: ${data.paymentId}`);
    this.logger.log(`   Chains: ${data.chains.join(', ')}`);
    this.logger.log(`   Target: ${data.targetAmountEth} ETH`);
    this.logger.log(`   Duration: ${data.durationInDays} days`);

    try {
      const job = await this.queue.add('deploy-escrow', data, {
        jobId: `deployment-${data.paymentId}`, // Unique job ID based on payment
        priority: 1, // Higher priority for faster processing
      });

      this.logger.log(`✅ Job queued successfully: ${job.id}`);
      return job.id!;
    } catch (error: any) {
      this.logger.error(`❌ Failed to queue deployment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get job status by job ID
   */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress?: number;
    data?: any;
    error?: string;
  }> {
    try {
      const job = await this.queue.getJob(jobId);

      if (!job) {
        return { status: 'not-found' };
      }

      const state = await job.getState();
      const progress = job.progress;
      const failedReason = job.failedReason;

      return {
        status: state,
        progress: typeof progress === 'number' ? progress : undefined,
        data: job.returnvalue,
        error: failedReason ? sanitizeJobFailedReason(failedReason) : undefined,
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to get job status: ${error.message}`);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const counts = await this.queue.getJobCounts();
    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
    };
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.retry();
      this.logger.log(`🔄 Retrying job: ${jobId}`);
    }
  }

  /**
   * Remove a job from the queue
   */
  async removeJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(`🗑️  Removed job: ${jobId}`);
    }
  }
}
