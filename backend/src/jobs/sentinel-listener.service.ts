/**
 * SentinelListenerService
 *
 * Subscribes to the two Redis Pub/Sub channels published by the On-Chain Sentinel
 * and reacts to each event inside the NestJS application context.
 *
 * Channels monitored:
 *   channel:x402_payments       → X402PaymentEvent
 *   channel:escrow_contributions → EscrowContributionEvent
 *   channel:native_payments     → NativePaymentEvent (BTC / XLM)
 *
 * Reactions:
 *   x402_usdc_payment:
 *     1. Look up the pending Payment record by sender address + chain.
 *     2. Verify the USDC amount matches the required payment.
 *     3. Mark the Payment as CONFIRMED and queue the escrow-deployment job.
 *     4. Emit an SSE notification to the frontend: X402_PAYMENT_DETECTED.
 *
 *   escrow_contribution:
 *     1. Find the matching EscrowDeployment by contractAddress + chain.
 *     2. Persist a new Contribution record.
 *     3. Aggregate totalRaised on the WishlistItem.
 *     4. Emit an SSE notification to the company owner: NEW_CONTRIBUTION.
 *
 *   native_payment (BTC / XLM):
 *     1. Look up the WishlistItem by bitcoinEscrowAddress or stellarEscrowAddress.
 *     2. Persist a Contribution record (idempotent via transactionHash).
 *     3. Convert native amount to EUR; update wishlistItem.amountRaised.
 *     4. Emit an SSE notification: NATIVE_PAYMENT_RECEIVED.
 *
 * This service uses a dedicated ioredis subscription connection (independent
 * from the one BullMQ uses for its queue, since ioredis subscribe connections
 * cannot execute regular commands).
 */
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { Payment, PaymentStatus, PaymentChain } from '../entities/payment.entity';
import { UserWallet } from '../entities/user-wallet.entity';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { EscrowDeployment } from '../entities/escrow-deployment.entity';
import { Contribution } from '../entities/contribution.entity';
import { DeploymentQueueService } from './deployment-queue.service';
import { NotificationsService } from '../web3/notifications.service';
import { CryptoPricesService } from '../web3/crypto-prices.service';

// ── Wire-format payload interfaces (mirror Go types) ──────────────────────────

interface X402PaymentEvent {
  eventType: 'x402_usdc_payment';
  chain: 'ethereum_sepolia' | 'avalanche_fuji' | 'solana';
  transactionHash: string;
  senderAddress: string;
  receiverAddress: string;
  amountUSDC: string;
  rawAmount: string;
  blockNumber: number;
  timestamp: string;
}

interface EscrowContributionEvent {
  eventType: 'escrow_contribution';
  chain: 'ethereum_sepolia' | 'avalanche_fuji';
  contractAddress: string;
  transactionHash: string;
  contributorAddress: string;
  amountNative: string;
  amountEurEstimate: number;
  totalRaisedNow: string;
  isTargetMet: boolean;
}

/** Published on channel:native_payments for Bitcoin and Stellar transactions. */
interface NativePaymentEvent {
  eventType: 'NATIVE_PAYMENT_RECEIVED';
  chain: 'bitcoin' | 'stellar';
  transactionHash: string;
  senderAddress: string;
  receiverAddress: string;
  amount: string;         // human-readable (e.g. "0.00012" BTC)
  currencySymbol: string; // "BTC", "XLM", "USDC"
  rawAmount: string;      // satoshis or stroops as string
  confirmed: boolean;
  blockNumber: number;
  timestamp: string;
}

const CHANNEL_X402 = 'channel:x402_payments';
const CHANNEL_ESCROW = 'channel:escrow_contributions';
const CHANNEL_NATIVE = 'channel:native_payments';

/** 10 USDC in raw units (6 decimal places). */
const REQUIRED_RAW_USDC = BigInt(10_000_000);

@Injectable()
export class SentinelListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SentinelListenerService.name);
  private subscriber: Redis | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(UserWallet)
    private readonly walletRepo: Repository<UserWallet>,
    @InjectRepository(WishlistItem)
    private readonly wishlistRepo: Repository<WishlistItem>,
    @InjectRepository(EscrowDeployment)
    private readonly escrowRepo: Repository<EscrowDeployment>,
    @InjectRepository(Contribution)
    private readonly contributionRepo: Repository<Contribution>,
    private readonly deploymentQueue: DeploymentQueueService,
    private readonly notifications: NotificationsService,
    private readonly cryptoPrices: CryptoPricesService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn(
        '⚠️  REDIS_URL not set — SentinelListenerService disabled',
      );
      return;
    }

    // A dedicated ioredis client in subscriber mode.
    // Subscriber connections cannot run regular commands (GET, SET, etc.),
    // so we keep this separate from the BullMQ connection.
    this.subscriber = new Redis(redisUrl, {
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 500, 10_000),
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });

    this.subscriber.on('error', (err) => {
      this.logger.error(`❌ Redis subscriber error: ${err.message}`);
    });

    this.subscriber.on('connect', () => {
      this.logger.log('✅ Sentinel Redis subscriber connected');
    });

    await this.subscriber.connect();

    // Register message handler before subscribing.
    this.subscriber.on('message', (channel: string, message: string) => {
      this.handleMessage(channel, message).catch((err) => {
        this.logger.error(`❌ Error handling sentinel message: ${err.message}`);
      });
    });

    await this.subscriber.subscribe(CHANNEL_X402, CHANNEL_ESCROW, CHANNEL_NATIVE);
    this.logger.log(
      `📡 Subscribed to Redis channels: ${CHANNEL_X402}, ${CHANNEL_ESCROW}, ${CHANNEL_NATIVE}`,
    );
  }

  async onModuleDestroy() {
    if (this.subscriber) {
      await this.subscriber.unsubscribe();
      await this.subscriber.quit();
      this.logger.log('🔌 Sentinel Redis subscriber closed');
    }
  }

  // ── Message router ──────────────────────────────────────────────────────────

  private async handleMessage(channel: string, raw: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn(`⚠️  Malformed message on ${channel}: ${raw}`);
      return;
    }

    switch (channel) {
      case CHANNEL_X402:
        await this.handleX402Payment(parsed as X402PaymentEvent);
        break;
      case CHANNEL_ESCROW:
        await this.handleEscrowContribution(parsed as EscrowContributionEvent);
        break;
      case CHANNEL_NATIVE:
        await this.handleNativePayment(parsed as NativePaymentEvent);
        break;
    }
  }

  // ── x402 USDC Payment ───────────────────────────────────────────────────────

  private async handleX402Payment(event: X402PaymentEvent): Promise<void> {
    this.logger.log(
      `💰 x402 payment detected on ${event.chain} — sender=${event.senderAddress} amount=${event.amountUSDC} USDC tx=${event.transactionHash}`,
    );

    // 1. Verify the amount is exactly the required USDC payment.
    const rawAmount = BigInt(event.rawAmount || '0');
    if (rawAmount < REQUIRED_RAW_USDC) {
      this.logger.warn(
        `⚠️  Payment amount ${event.rawAmount} < required ${REQUIRED_RAW_USDC}. Ignoring.`,
      );
      return;
    }

    // 2. Map chain identifier to PaymentChain enum.
    const chain = this.resolveChain(event.chain);
    if (!chain) {
      this.logger.warn(`⚠️  Unknown chain identifier: ${event.chain}`);
      return;
    }

    // 3. Find the user who owns this sender address (master wallet or company child wallet).
    const userId = await this.resolveUserIdFromAddress(event.senderAddress);
    if (!userId) {
      this.logger.warn(
        `⚠️  No user found for sender address ${event.senderAddress}. Cannot auto-queue deployment.`,
      );
      return;
    }

    // 4. Find a PENDING payment record for this user + chain (to avoid duplicates).
    const payment = await this.paymentRepo.findOne({
      where: {
        userId,
        chain,
        status: PaymentStatus.PENDING,
      },
      relations: ['wishlistItem', 'wishlistItem.company'],
      order: { createdAt: 'DESC' },
    });

    if (!payment) {
      this.logger.warn(
        `⚠️  No pending Payment record found for user ${userId} on ${chain}. ` +
          `The payment tx ${event.transactionHash} may have arrived before the record was created.`,
      );
      // Emit a raw notification so the frontend can show a toast and
      // the user can manually trigger the deployment via the UI.
      this.notifications.emit({
        userId,
        type: 'X402_PAYMENT_ORPHANED',
        payload: {
          transactionHash: event.transactionHash,
          chain: event.chain,
          amountUsdc: event.amountUSDC,
        },
      });
      return;
    }

    // 5. Guard against re-processing the same transaction.
    if (payment.usdcTxHash === event.transactionHash) {
      this.logger.debug(
        `ℹ️  Payment ${payment.id} already processed for tx ${event.transactionHash}`,
      );
      return;
    }

    // 6. Confirm the payment record.
    await this.paymentRepo.update(payment.id, {
      status: PaymentStatus.CONFIRMED,
      usdcTxHash: event.transactionHash,
      confirmedAt: new Date(event.timestamp),
    });

    this.logger.log(`✅ Payment ${payment.id} confirmed — queuing deployment`);

    // 7. Notify frontend immediately (before deployment completes).
    this.notifications.emit({
      userId,
      type: 'X402_PAYMENT_DETECTED',
      payload: {
        paymentId: payment.id,
        transactionHash: event.transactionHash,
        chain: event.chain,
        amountUsdc: event.amountUSDC,
        message: 'Payment verified! Deploying escrow contracts...',
      },
    });

    // 8. Queue the BullMQ deployment job.
    // targetAmountEth and durationInDays live on any prior EscrowDeployment
    // for this wishlist item; fall back to sensible defaults if not found.
    const wishlist = payment.wishlistItem;
    const existingEscrow = await this.escrowRepo.findOne({
      where: { wishlistItemId: payment.wishlistItemId },
      order: { createdAt: 'DESC' },
    });
    const targetAmountEth = existingEscrow?.targetAmountEth ?? 0;
    const durationInDays = existingEscrow?.durationInDays ?? 30;

    try {
      const jobId = await this.deploymentQueue.queueDeployment({
        paymentId: payment.id,
        userId,
        wishlistItemId: payment.wishlistItemId,
        companyWalletAddress: wishlist?.company?.ethAddress ?? '',
        masterWalletAddress: '',
        targetAmountEth,
        durationInDays,
        chains: [chain === PaymentChain.ETHEREUM ? 'ethereum' : 'avalanche'],
        campaignName: wishlist?.title ?? '',
        campaignDescription: wishlist?.description ?? '',
      });

      this.logger.log(
        `📋 Deployment job ${jobId} queued for payment ${payment.id}`,
      );
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to queue deployment for payment ${payment.id}: ${err.message}`,
      );
    }
  }

  // ── Escrow Contribution ─────────────────────────────────────────────────────

  private async handleEscrowContribution(
    event: EscrowContributionEvent,
  ): Promise<void> {
    this.logger.log(
      `🎯 Contribution on ${event.chain} contract=${event.contractAddress} ` +
        `amount=${event.amountNative} from=${event.contributorAddress} tx=${event.transactionHash}`,
    );

    // 1. Find the EscrowDeployment by contract address.
    const escrow = await this.escrowRepo.findOne({
      where: { contractAddress: event.contractAddress },
      relations: ['wishlistItem', 'wishlistItem.company', 'wishlistItem.company.owner'],
    });

    if (!escrow) {
      this.logger.warn(
        `⚠️  No EscrowDeployment found for contract ${event.contractAddress}. ` +
          `Sentinel may have detected a contract deployed outside of the platform.`,
      );
      return;
    }

    // 2. Convert native amount to EUR using CryptoPricesService.
    const nativeSymbol = event.chain === 'ethereum_sepolia' ? 'ETH' : 'AVAX';
    const nativeAmount = parseFloat(event.amountNative);
    let amountEur = 0;
    try {
      amountEur = await this.cryptoPrices.toEur(nativeSymbol, nativeAmount);
    } catch (err: any) {
      this.logger.warn(
        `⚠️  Could not convert ${nativeAmount} ${nativeSymbol} to EUR: ${err.message}`,
      );
    }

    // 3. Persist a Contribution record (idempotent via tx hash).
    const exists = await this.contributionRepo.findOne({
      where: { transactionHash: event.transactionHash },
    });

    if (!exists) {
      const contribution = this.contributionRepo.create({
        escrowDeployment: escrow,
        wishlistItem: escrow.wishlistItem,
        contributorAddress: event.contributorAddress,
        amountWei: this.etherToWei(event.amountNative),
        amountEth: nativeAmount,
        amountEur,
        transactionHash: event.transactionHash,
        chain: event.chain.includes('ethereum') ? 'ethereum' : 'avalanche',
        currencySymbol: nativeSymbol,
        nativeAmount,
      });

      await this.contributionRepo.save(contribution);
      this.logger.log(
        `💾 Contribution saved  id=${contribution.id}  ${nativeAmount} ${nativeSymbol} ≈ €${amountEur.toFixed(2)}`,
      );
    }

    // 4. Update amountRaised on the WishlistItem.
    const totalRaisedNative = parseFloat(event.totalRaisedNow);
    let totalRaisedEur = 0;
    try {
      totalRaisedEur = await this.cryptoPrices.toEur(
        nativeSymbol,
        totalRaisedNative,
      );
    } catch (err: any) {
      this.logger.warn(
        `⚠️  Could not convert ${totalRaisedNative} ${nativeSymbol} to EUR: ${err.message}`,
      );
    }

    await this.wishlistRepo.update(escrow.wishlistItemId, {
      amountRaised: totalRaisedEur,
    });

    // 5. Notify the company owner via SSE.
    const ownerId = escrow.wishlistItem?.company?.owner?.id;
    if (ownerId) {
      this.notifications.emit({
        userId: ownerId,
        type: 'NEW_CONTRIBUTION',
        payload: {
          wishlistItemId: escrow.wishlistItemId,
          contractAddress: event.contractAddress,
          chain: event.chain,
          contributorAddress: event.contributorAddress,
          amountNative: event.amountNative,
          amountEur: amountEur.toFixed(2),
          totalRaisedEur: totalRaisedEur.toFixed(2),
          isTargetMet: event.isTargetMet,
          transactionHash: event.transactionHash,
        },
      });
    }
  }

  // ── Native Payment (Bitcoin / Stellar) ────────────────────────────────────

  private async handleNativePayment(event: NativePaymentEvent): Promise<void> {
    this.logger.log(
      `🔗 Native payment on ${event.chain} — ${event.amount} ${event.currencySymbol} ` +
        `to=${event.receiverAddress} confirmed=${event.confirmed} tx=${event.transactionHash}`,
    );

    // 1. Find the WishlistItem that owns this deposit address.
    const addressField =
      event.chain === 'bitcoin' ? 'bitcoinEscrowAddress' : 'stellarEscrowAddress';

    const wishlistItem = await this.wishlistRepo.findOne({
      where: { [addressField]: event.receiverAddress },
      relations: ['company', 'company.owner'],
    });

    if (!wishlistItem) {
      this.logger.warn(
        `⚠️  No WishlistItem found with ${addressField}=${event.receiverAddress}. ` +
          `tx=${event.transactionHash}`,
      );
      return;
    }

    // 2. Idempotency guard — skip if this tx was already recorded.
    const exists = await this.contributionRepo.findOne({
      where: { transactionHash: event.transactionHash },
    });
    if (exists) {
      this.logger.debug(
        `ℹ️  Native payment tx ${event.transactionHash} already recorded — skipping`,
      );
      return;
    }

    // 3. Convert amount to EUR.
    const nativeAmount = parseFloat(event.amount);
    let amountEur = 0;
    try {
      amountEur = await this.cryptoPrices.toEur(event.currencySymbol, nativeAmount);
    } catch (err: any) {
      this.logger.warn(
        `⚠️  Could not convert ${nativeAmount} ${event.currencySymbol} to EUR: ${err.message}`,
      );
    }

    // 4. Persist the Contribution.
    const contribution = this.contributionRepo.create({
      wishlistItem,
      contributorAddress: event.senderAddress,
      amountWei: '0',
      amountEth: 0,
      amountEur,
      transactionHash: event.transactionHash,
      chain: event.chain,
      currencySymbol: event.currencySymbol,
      nativeAmount,
    });
    await this.contributionRepo.save(contribution);
    this.logger.log(
      `💾 Native contribution saved id=${contribution.id} ` +
        `${nativeAmount} ${event.currencySymbol} ≈ €${amountEur.toFixed(2)}`,
    );

    // 5. Update wishlistItem.amountRaised (additive — accumulate all contributions).
    const newAmountRaised = (wishlistItem.amountRaised ?? 0) + amountEur;
    await this.wishlistRepo.update(wishlistItem.id, { amountRaised: newAmountRaised });

    // 6. Notify company owner via SSE.
    const ownerId = wishlistItem.company?.owner?.id;
    if (ownerId) {
      this.notifications.emit({
        userId: ownerId,
        type: 'NATIVE_PAYMENT_RECEIVED',
        payload: {
          wishlistItemId: wishlistItem.id,
          chain: event.chain,
          senderAddress: event.senderAddress,
          receiverAddress: event.receiverAddress,
          amount: event.amount,
          currencySymbol: event.currencySymbol,
          amountEur: amountEur.toFixed(2),
          totalRaisedEur: newAmountRaised.toFixed(2),
          transactionHash: event.transactionHash,
          confirmed: event.confirmed,
        },
      });
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Looks up a user by their EVM wallet address checking both the
   * user_wallets table (master wallet) and the companies table (child wallets).
   */
  private async resolveUserIdFromAddress(
    address: string,
  ): Promise<string | null> {
    const normalised = address.toLowerCase();

    // Check master wallet.
    const masterWallet = await this.walletRepo.findOne({
      where: [
        { ethAddress: normalised },
        { avaxAddress: normalised },
      ],
    });
    if (masterWallet) return masterWallet.userId;

    return null;
  }

  private resolveChain(
    sentinelChain: string,
  ): PaymentChain | null {
    if (sentinelChain === 'ethereum_sepolia') return PaymentChain.ETHEREUM;
    if (sentinelChain === 'avalanche_fuji') return PaymentChain.AVALANCHE;
    return null;
  }

  /** Approximate ETH → Wei conversion (string, 18 dp). */
  private etherToWei(etherStr: string): string {
    try {
      const val = parseFloat(etherStr);
      return Math.round(val * 1e18).toString();
    } catch {
      return '0';
    }
  }
}
