import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';

// Solana & Stellar libraries for non-EVM transactions
import {
  Connection,
  Keypair as SolanaKeypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import { Server } from 'stellar-sdk';
import {
  Keypair as StellarKeypair,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
} from '@stellar/stellar-base';
// bitcoinjs v6 exports most pieces but the ECPair factory is in a separate package
import { payments, networks, Psbt, address } from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';

// create ECPair bound to testnet network later in code

import * as crypto from 'crypto';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { WalletGenerationService } from './wallet-generation.service';
import { Company } from '../entities/company.entity';
import { UserWallet } from '../entities/user-wallet.entity';
import { CompanyWallet } from '../entities/company-wallet.entity';
import { ContractHistoryService } from './contract-history.service';
import { PlatformWalletService } from './platform-wallet.service';
import { ContractAction } from '../entities/contract-deployment-history.entity';

// ABI for EscrowFactory contract
const ESCROW_FACTORY_ABI = [
  'function createEscrow(address _company, address _masterWallet, uint256 _targetAmount, uint256 _durationInDays, string _campaignName, string _campaignDescription, string _wishlistItemId) external returns (address)',
  'function getCompanyEscrows(address _company) external view returns (address[])',
  'function getEscrowDetails(address _escrow) external view returns (address company, uint256 totalRaised, uint256 targetAmount, uint256 deadline, bool isFinalized, bool isSuccessful, string campaignName, string campaignDescription)',
  'event EscrowCreated(address indexed escrowAddress, address indexed company, uint256 targetAmount, uint256 deadline, uint256 timestamp, string campaignName, string campaignDescription, string wishlistItemId)',
];

// ABI for CompanyWishlistEscrow contract
const ESCROW_ABI = [
  'function contribute() external payable',
  'function finalize() external',
  'function claimRefund() external',
  'function getCampaignStatus() external view returns (uint256 totalRaised, uint256 targetAmount, uint256 deadline, uint256 timeRemaining, bool isFinalized, bool isSuccessful, uint256 contributorCount)',
  'function getContribution(address contributor) external view returns (uint256)',
  'function getProgressPercentage() external view returns (uint256)',
  'function isActive() external view returns (bool)',
  'function company() external view returns (address)',
  'function targetAmount() external view returns (uint256)',
  'function deadline() external view returns (uint256)',
  'function totalRaised() external view returns (uint256)',
  'function isFinalized() external view returns (bool)',
  'function isSuccessful() external view returns (bool)',
  'function campaignName() external view returns (string)',
  'function campaignDescription() external view returns (string)',
  'function wishlistItemId() external view returns (string)',
  'function contributors(uint256 index) external view returns (address)',
  'function contributions(address contributor) external view returns (uint256)',
  'event ContributionReceived(address indexed contributor, uint256 amount, uint256 totalRaised)',
  'event FundsReleased(address indexed company, uint256 amount)',
  'event RefundIssued(address indexed contributor, uint256 amount)',
  'event CampaignFinalized(bool successful, uint256 totalRaised)',
];

export interface EscrowDeploymentResult {
  ethereumAddress?: string;
  avalancheAddress?: string;
  transactionHashes: {
    ethereum?: string;
    avalanche?: string;
  };
}

export interface ContributorUser {
  id: string;
  name?: string | null;
  profilePhotoUrl?: string | null;
}

export interface ContributorInfo {
  address: string;
  amount: string;
  amountEth: string;
  user?: ContributorUser | null;
}

export interface CampaignStatus {
  totalRaised: string; // in ETH/AVAX
  targetAmount: string;
  deadline: Date;
  timeRemaining: number; // in seconds
  isFinalized: boolean;
  isSuccessful: boolean;
  contributorCount: number;
  progressPercentage: number;
  isActive: boolean;
  contributors?: ContributorInfo[];
  campaignName?: string | null;
  campaignDescription?: string | null;
}

@Injectable()
export class EscrowContractService {
  private readonly logger = new Logger(EscrowContractService.name);
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private readonly ENCRYPTION_KEY: Buffer;

  // RPC Providers with fallbacks (FallbackProvider distributes across all RPCs automatically)
  private ethereumProvider: ethers.AbstractProvider;
  private avalancheProvider: ethers.AbstractProvider;

  // Factory contract addresses
  private ethereumFactoryAddress: string;
  private avalancheFactoryAddress: string;

  // Throttle timestamps to avoid repeated RPC warnings
  private lastEthereumRpcWarn: number;
  private lastAvalancheRpcWarn: number;

  // RPC Endpoint fallbacks
  // publicnode.com /rpc path returns 404 — use the correct hostname-only URL
  private ethereumRPCEndpoints = [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://rpc.sepolia.org',
    'https://sepolia.drpc.org',
    'https://eth-sepolia.public.blastapi.io',
    'https://sepolia.gateway.tenderly.co',
    'https://1rpc.io/sepolia',
  ];

  private avalancheRPCEndpoints = [
    'https://api.avax-test.network/ext/bc/C/rpc',
    'https://avalanche-fuji-c-chain.publicnode.com',
    'https://avalanche-fuji.drpc.org',
  ];

  // Non-EVM RPC endpoints
  private readonly solanaRpc = 'https://api.devnet.solana.com';
  private readonly stellarHorizon = 'https://horizon-testnet.stellar.org';

  constructor(
    @InjectRepository(WishlistItem)
    private wishlistRepo: Repository<WishlistItem>,
    @InjectRepository(Company)
    private companyRepo: Repository<Company>,
    @InjectRepository(UserWallet)
    private userWalletRepo: Repository<UserWallet>,
    @InjectRepository(CompanyWallet)
    private companyWalletRepo: Repository<CompanyWallet>,
    private readonly contractHistoryService: ContractHistoryService,
    private readonly platformWalletService: PlatformWalletService,
    private readonly walletGenerationService: WalletGenerationService,
  ) {
    // Get encryption key from environment variable (for decrypting stored wallets)
    const key = process.env.WALLET_ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
      throw new Error(
        'WALLET_ENCRYPTION_KEY must be set and be 64 hex characters (32 bytes)',
      );
    }
    this.ENCRYPTION_KEY = Buffer.from(key, 'hex');

    // Build FallbackProvider using only the testnet-specific free RPC lists.
    // We intentionally do NOT include ETHEREUM_RPC_URL / AVALANCHE_RPC_URL here
    // because those env vars may point to mainnet endpoints (different chain IDs)
    // which would cause FallbackProvider to throw a "network changed" error.
    //
    // staticNetwork avoids per-call chain-ID polling (eliminates the ~2s latency
    // spike on the first request after startup).
    const sepoliaNetwork = ethers.Network.from(11155111);
    const fujiNetwork = ethers.Network.from(43113);

    this.ethereumProvider = new ethers.FallbackProvider(
      this.ethereumRPCEndpoints.map((url, i) => ({
        provider: new ethers.JsonRpcProvider(url, sepoliaNetwork, { staticNetwork: sepoliaNetwork }),
        priority: i + 1,
        weight: 1,
        stallTimeout: 2500,
      })),
      sepoliaNetwork,
      { quorum: 1 },
    );
    this.avalancheProvider = new ethers.FallbackProvider(
      this.avalancheRPCEndpoints.map((url, i) => ({
        provider: new ethers.JsonRpcProvider(url, fujiNetwork, { staticNetwork: fujiNetwork }),
        priority: i + 1,
        weight: 1,
        stallTimeout: 2500,
      })),
      fujiNetwork,
      { quorum: 1 },
    );

    // Throttle repeated RPC warnings to avoid log spam on transient network issues
    this.lastEthereumRpcWarn = 0;
    this.lastAvalancheRpcWarn = 0;

    // Factory addresses from environment
    this.ethereumFactoryAddress = process.env.ETHEREUM_FACTORY_ADDRESS || '';
    this.avalancheFactoryAddress = process.env.AVALANCHE_FACTORY_ADDRESS || '';

    if (!this.ethereumFactoryAddress || !this.avalancheFactoryAddress) {
      this.logger.warn(
        '⚠️  Factory contract addresses not configured. Escrow functionality will be limited.',
      );
    }

    this.logger.log(`📡 Ethereum FallbackProvider: ${this.ethereumRPCEndpoints.length} Sepolia RPC(s) [staticNetwork]`);
    this.logger.log(`📡 Avalanche FallbackProvider: ${this.avalancheRPCEndpoints.length} Fuji RPC(s) [staticNetwork]`);
  }

  /**
   * Decrypt data encrypted with AES-256-GCM
   */
  private decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(
      this.ENCRYPTION_ALGORITHM,
      this.ENCRYPTION_KEY,
      iv,
    );
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Returns the Ethereum FallbackProvider (handles retries/rotation internally).
   */
  private async getWorkingEthereumProvider(): Promise<ethers.AbstractProvider> {
    return this.ethereumProvider;
  }

  /**
   * Returns the Avalanche FallbackProvider (handles retries/rotation internally).
   */
  private async getWorkingAvalancheProvider(): Promise<ethers.AbstractProvider> {
    return this.avalancheProvider;
  }

  /**
   * Get user's private key from database (decrypted)
   * This retrieves the user's master wallet private key from the database
   */
  async getUserPrivateKey(
    userId: string,
    chain: 'ethereum' | 'avalanche' | 'solana' | 'stellar' | 'bitcoin',
  ): Promise<string> {
    this.logger.log(`🔍 Looking up wallet for user: ${userId}`);

    const userWallet = await this.userWalletRepo.findOne({
      where: { userId },
    });

    if (!userWallet) {
      this.logger.error(`❌ No wallet found in database for user: ${userId}`);
      throw new BadRequestException(
        'User wallet not found. Please generate a wallet first.',
      );
    }

    this.logger.log(
      `🔍 Retrieved wallet for user ${userId}: ETH=${userWallet.ethAddress}, AVAX=${userWallet.avaxAddress}`,
    );

    // EVM chains simply use stored encrypted private key
    if (chain === 'ethereum' || chain === 'avalanche') {
      try {
        const decryptedPrivateKey = this.decrypt(
          userWallet.encryptedPrivateKey,
        );
        return decryptedPrivateKey;
      } catch (error) {
        this.logger.error('Failed to decrypt user private key:', error);
        throw new BadRequestException(
          'Failed to decrypt wallet. Please try again.',
        );
      }
    }

    // For Solana/Stellar we derive keys from mnemonic
    if (!userWallet.encryptedMnemonic || !userWallet.encryptedMnemonic.trim()) {
      throw new BadRequestException(
        'Mnemonic unavailable - cannot derive non-EVM key',
      );
    }

    let mnemonic: string;
    try {
      mnemonic = this.decrypt(userWallet.encryptedMnemonic);
    } catch (err) {
      this.logger.error(
        'Failed to decrypt mnemonic for non-EVM key derivation:',
        err,
      );
      throw new BadRequestException('Failed to access mnemonic');
    }

    const { solanaPrivateKey, stellarPrivateKey, bitcoinPrivateKey } =
      this.walletGenerationService.deriveNonEvmKeys(mnemonic);
    if (chain === 'solana') {
      if (!solanaPrivateKey)
        throw new BadRequestException('Solana key derivation failed');
      return solanaPrivateKey;
    }
    if (chain === 'stellar') {
      if (!stellarPrivateKey)
        throw new BadRequestException('Stellar key derivation failed');
      return stellarPrivateKey;
    }
    if (chain === 'bitcoin') {
      if (!bitcoinPrivateKey)
        throw new BadRequestException('Bitcoin key derivation failed');
      return bitcoinPrivateKey; // raw hex private key
    }

    // fallback should not happen
    throw new BadRequestException('Unsupported chain for key retrieval');
  }

  /**
   * Create signer for user's wallet
   */
  async createUserSigner(
    userId: string,
    chain: 'ethereum' | 'avalanche',
  ): Promise<ethers.Wallet> {
    const privateKey = await this.getUserPrivateKey(userId, chain);
    // FallbackProvider implements AbstractProvider which Wallet accepts
    const provider = chain === 'ethereum'
      ? this.ethereumProvider
      : this.avalancheProvider;
    return new ethers.Wallet(privateKey, provider as ethers.Provider);
  }

  /**
   * Deploy escrow contracts for a wishlist item using user's wallet (which has the funds)
   */
  async deployEscrowContracts(
    userId: string,
    wishlistItemId: string,
    companyWalletAddress: string,
    masterWalletAddress: string,
    targetAmountEth: number,
    durationInDays: number,
    chains: ('ethereum' | 'avalanche')[] = ['ethereum', 'avalanche'],
    campaignName: string | null = null,
    campaignDescription: string | null = null,
  ): Promise<EscrowDeploymentResult> {
    this.logger.log(
      `📝 Deploying escrow contracts for wishlist item: ${wishlistItemId} by user: ${userId}`,
    );
    this.logger.log(`   Company Wallet: ${companyWalletAddress}`);
    this.logger.log(
      `   Master Wallet (funds recipient): ${masterWalletAddress}`,
    );

    // Get wishlist item to extract company ID for history logging
    const wishlistItem = await this.wishlistRepo.findOne({
      where: { id: wishlistItemId },
      relations: ['company'],
    });

    if (!wishlistItem) {
      throw new BadRequestException(
        `Wishlist item ${wishlistItemId} not found`,
      );
    }

    const companyId = wishlistItem.companyId;

    // Validate that factory addresses are configured
    if (!this.ethereumFactoryAddress && !this.avalancheFactoryAddress) {
      throw new Error(
        'Smart contract factories are not configured. Please configure ETHEREUM_FACTORY_ADDRESS and/or AVALANCHE_FACTORY_ADDRESS environment variables.',
      );
    }

    // Check if requested chains have factories configured
    const unavailableChains = chains.filter((chain) => {
      if (chain === 'ethereum') return !this.ethereumFactoryAddress;
      if (chain === 'avalanche') return !this.avalancheFactoryAddress;
      return false;
    });

    if (unavailableChains.length === chains.length) {
      throw new Error(
        `None of the requested chains (${chains.join(', ')}) have factory contracts configured. ` +
          `Available: ${this.ethereumFactoryAddress ? 'ethereum' : ''}${this.avalancheFactoryAddress ? ' avalanche' : ''}`.trim(),
      );
    }

    if (unavailableChains.length > 0) {
      this.logger.warn(
        `⚠️  Skipping deployment on unavailable chains: ${unavailableChains.join(', ')}`,
      );
    }

    const result: EscrowDeploymentResult = {
      transactionHashes: {},
    };

    // Validate addresses - critical for contract deployment
    if (!ethers.isAddress(companyWalletAddress)) {
      const detail = `Invalid format: expected 42 characters (0x + 40 hex). Please regenerate company wallet.`;
      this.logger.error(`❌ Invalid company wallet address: ${detail}`);
      throw new BadRequestException(
        `Invalid company wallet address. ${detail}`,
      );
    }
    if (!ethers.isAddress(masterWalletAddress)) {
      const detail = `Invalid format: expected 42 characters (0x + 40 hex). Please regenerate master wallet.`;
      this.logger.error(`❌ Invalid master wallet address: ${detail}`);
      throw new BadRequestException(`Invalid master wallet address. ${detail}`);
    }

    // Extra validation - ensure addresses are exactly 42 characters
    if (companyWalletAddress.length !== 42) {
      const detail = `Address has ${companyWalletAddress.length} characters instead of 42 - data corruption suspected`;
      this.logger.error(`❌ Company wallet address length issue: ${detail}`);
      throw new BadRequestException(
        `Company wallet address validation failed. ${detail}. Please regenerate company wallet.`,
      );
    }
    if (masterWalletAddress.length !== 42) {
      const detail = `Address has ${masterWalletAddress.length} characters instead of 42 - data corruption suspected`;
      this.logger.error(`❌ Master wallet address length issue: ${detail}`);
      throw new BadRequestException(
        `Master wallet address validation failed. ${detail}. Please regenerate master wallet.`,
      );
    }

    // Ensure company and master wallet addresses are different
    if (
      companyWalletAddress.toLowerCase() === masterWalletAddress.toLowerCase()
    ) {
      throw new BadRequestException(
        'Company wallet and master wallet must be different addresses. ' +
          'Company wallet should be the company child wallet, not your personal master wallet.',
      );
    }

    // Convert target amount to wei
    const targetAmountWei = ethers.parseEther(targetAmountEth.toString());

    // Deploy to Ethereum
    if (chains.includes('ethereum') && this.ethereumFactoryAddress) {
      try {
        const signer = await this.createUserSigner(userId, 'ethereum');

        const factory = new ethers.Contract(
          this.ethereumFactoryAddress,
          ESCROW_FACTORY_ABI,
          signer,
        );

        this.logger.log(
          `🔑 Using wallet: ${signer.address} for Ethereum deployment`,
        );

        // Check that factory is a contract on the chain
        const factoryCode = await signer.provider!.getCode(
          this.ethereumFactoryAddress,
        );
        if (!factoryCode || factoryCode === '0x') {
          throw new Error(
            `❌ No contract found at Ethereum factory address ${this.ethereumFactoryAddress}. ` +
              `The factory contract may not be deployed on this network. ` +
              `Please verify the ETHEREUM_FACTORY_ADDRESS configuration.`,
          );
        }
        this.logger.log(
          `✅ Factory contract code exists at ${this.ethereumFactoryAddress} (code length: ${factoryCode.length} bytes)`,
        );

        // Try to verify it's actually the EscrowFactory by calling a view function
        try {
          const testFactory = new ethers.Contract(
            this.ethereumFactoryAddress,
            ESCROW_FACTORY_ABI,
            signer.provider,
          );
          const escrowCount = await testFactory.getEscrowCount();
          this.logger.log(
            `✅ Verified as EscrowFactory (current escrow count: ${escrowCount.toString()})`,
          );
        } catch (verifyErr: any) {
          this.logger.warn(
            `⚠️  Could not verify contract is EscrowFactory. Error: ${verifyErr?.message}`,
          );
          this.logger.warn(
            `⚠️  The contract at ${this.ethereumFactoryAddress} may not be the EscrowFactory.`,
          );
          this.logger.warn(
            `⚠️  Proceeding anyway - if this fails, factory contract may not be deployed.`,
          );
        }

        // Validate addresses FIRST
        if (!ethers.isAddress(companyWalletAddress)) {
          throw new Error(
            `❌ Invalid company wallet address: ${companyWalletAddress}. This address is not a valid Ethereum address.`,
          );
        }
        if (!ethers.isAddress(masterWalletAddress)) {
          throw new Error(
            `❌ Invalid master wallet address: ${masterWalletAddress}. This address is not a valid Ethereum address.`,
          );
        }

        // Checksum the addresses to ensure proper formatting
        const checksummedCompany = ethers.getAddress(companyWalletAddress);
        const checksummedMaster = ethers.getAddress(masterWalletAddress);

        // Log deployment parameters BEFORE balance check
        this.logger.log(`📋 Deployment Parameters:`);
        this.logger.log(
          `   Company: ${companyWalletAddress} → ${checksummedCompany} (valid: ${ethers.isAddress(companyWalletAddress)})`,
        );
        this.logger.log(
          `   Master Wallet: ${masterWalletAddress} → ${checksummedMaster} (valid: ${ethers.isAddress(masterWalletAddress)})`,
        );
        this.logger.log(
          `   Same address check: ${checksummedCompany.toLowerCase() === checksummedMaster.toLowerCase() ? 'SAME (INVALID)' : 'Different (OK)'}`,
        );
        this.logger.log(
          `   Target Amount: ${ethers.formatEther(targetAmountWei)} ETH (${targetAmountWei.toString()} wei)`,
        );
        this.logger.log(`   Duration: ${durationInDays} days`);
        this.logger.log(
          `   Campaign Name: "${campaignName || ''}" (length: ${(campaignName || '').length})`,
        );
        this.logger.log(
          `   Campaign Description: "${campaignDescription || ''}" (length: ${(campaignDescription || '').length})`,
        );
        this.logger.log(`   Factory: ${this.ethereumFactoryAddress}`);
        this.logger.log(`   Signer: ${signer.address}`);

        // Use checksummed addresses for deployment
        companyWalletAddress = checksummedCompany;
        masterWalletAddress = checksummedMaster;

        // Quick balance check to avoid estimateGas failure when empty wallets are used
        const signerBalance = await signer.provider!.getBalance(signer.address);
        this.logger.log(
          `💰 Signer balance: ${ethers.formatEther(signerBalance)} ETH (${signerBalance.toString()} wei)`,
        );

        // Require minimum balance for gas (0.001 ETH ~= $3 worth of gas on testnet)
        const minGasBalance = ethers.parseEther('0.001');
        if (signerBalance < minGasBalance) {
          throw new Error(
            `❌ Insufficient balance for gas fees. ` +
              `Your wallet ${signer.address} has ${ethers.formatEther(signerBalance)} ETH on Sepolia testnet. ` +
              `You need at least ${ethers.formatEther(minGasBalance)} ETH to deploy contracts. ` +
              `Please get testnet ETH from a faucet: https://sepoliafaucet.com/ or https://www.alchemy.com/faucets/ethereum-sepolia`,
          );
        }

        let tx;
        try {
          // Log the exact parameters being sent to help debug
          this.logger.log(`🔬 Exact parameters for createEscrow call:`);
          this.logger.log(
            `   [0] company: ${companyWalletAddress} (address, valid: ${ethers.isAddress(companyWalletAddress)})`,
          );
          this.logger.log(
            `   [1] masterWallet: ${masterWalletAddress} (address, valid: ${ethers.isAddress(masterWalletAddress)})`,
          );
          this.logger.log(
            `   [2] targetAmountWei: ${targetAmountWei.toString()} wei (> 0: ${targetAmountWei > 0n})`,
          );
          this.logger.log(
            `   [3] durationInDays: ${durationInDays} (> 0: ${durationInDays > 0})`,
          );
          this.logger.log(
            `   [4] campaignName: "${campaignName || ''}" (length: ${(campaignName || '').length})`,
          );
          this.logger.log(
            `   [5] campaignDescription: "${campaignDescription || ''}" (length: ${(campaignDescription || '').length})`,
          );
          this.logger.log(
            `   Addresses are different: ${companyWalletAddress.toLowerCase() !== masterWalletAddress.toLowerCase()}`,
          );

          // Try to estimate gas first - this will give us better error messages
          this.logger.log(`⛽ Estimating gas for contract deployment...`);
          let shouldProceedWithoutEstimate = false;
          try {
            const gasEstimate = await factory.createEscrow.estimateGas(
              companyWalletAddress,
              masterWalletAddress,
              targetAmountWei,
              durationInDays,
              campaignName || '',
              campaignDescription || '',
              wishlistItemId || '',
            );
            this.logger.log(
              `✅ Gas estimation successful: ${gasEstimate.toString()} gas units`,
            );
          } catch (gasErr: any) {
            const gasErrMsg = gasErr?.message || gasErr?.toString() || '';
            this.logger.error(`❌ Gas estimation failed: ${gasErrMsg}`);

            // Extract revert reason if available
            if (gasErr?.data) {
              this.logger.error(`   Revert data: ${gasErr.data}`);
            }
            if (gasErr?.reason) {
              this.logger.error(`   Revert reason: ${gasErr.reason}`);
            }
            if (gasErr?.error) {
              this.logger.error(
                `   Error details: ${JSON.stringify(gasErr.error, null, 2)}`,
              );
            }

            // Detailed parameter validation logging
            this.logger.error(
              `\n❌ CONTRACT VALIDATION FAILED - Checking each parameter:`,
            );
            this.logger.error(
              `   ✓ Company is valid address: ${ethers.isAddress(companyWalletAddress)}`,
            );
            this.logger.error(
              `   ✓ Master is valid address: ${ethers.isAddress(masterWalletAddress)}`,
            );
            this.logger.error(
              `   ✓ Addresses are different: ${companyWalletAddress.toLowerCase() !== masterWalletAddress.toLowerCase()}`,
            );
            this.logger.error(
              `   ✓ Target amount > 0: ${targetAmountWei > 0n} (value: ${targetAmountWei.toString()})`,
            );
            this.logger.error(
              `   ✓ Duration > 0: ${durationInDays > 0} (value: ${durationInDays})`,
            );

            // If RPC simply has no revert data (provider limitation), try proceeding anyway with high gas
            if (
              gasErrMsg.includes('missing revert data') ||
              gasErrMsg.includes('revert=null')
            ) {
              this.logger.warn(
                `⚠️  RPC provider returned no revert data. This is a provider limitation, not a contract error.`,
              );
              this.logger.warn(
                `⚠️  Proceeding with transaction using fallback gas amount (2,000,000 units)...`,
              );
              shouldProceedWithoutEstimate = true;
            } else {
              throw new Error(
                `Factory contract rejected the deployment. This could be due to: ` +
                  `1) Invalid parameters, 2) Contract is paused, 3) Insufficient permissions. ` +
                  `Error: ${gasErr?.reason || gasErr?.message || 'Unknown error'}`,
              );
            }
          }

          // Send the transaction
          if (shouldProceedWithoutEstimate) {
            this.logger.log(
              `📤 Sending transaction with fallback gas limit (2,000,000 units)...`,
            );
            tx = await factory.createEscrow(
              companyWalletAddress,
              masterWalletAddress,
              targetAmountWei,
              durationInDays,
              campaignName || '',
              campaignDescription || '',
              wishlistItemId || '',
              { gasLimit: 2000000 },
            );
          } else {
            tx = await factory.createEscrow(
              companyWalletAddress,
              masterWalletAddress,
              targetAmountWei,
              durationInDays,
              campaignName || '',
              campaignDescription || '',
              wishlistItemId || '',
            );
          }

          this.logger.log(`📤 Transaction sent: ${tx.hash}`);
        } catch (err: any) {
          this.logger.error(
            `❌ Error while creating Ethereum escrow: ${err?.message || err}`,
          );
          throw err;
        }

        let receipt;
        try {
          receipt = await tx.wait();
        } catch (waitErr: any) {
          // Transaction reverted on-chain
          this.logger.error(`⛔ Transaction reverted on-chain (Ethereum)`);
          if (waitErr?.receipt) {
            this.logger.error(`   Transaction hash: ${waitErr.receipt.hash}`);
            this.logger.error(`   Block: ${waitErr.receipt.blockNumber}`);
            this.logger.error(
              `   Gas used: ${waitErr.receipt.gasUsed?.toString() || 'unknown'}`,
            );
            this.logger.error(`   Status: ${waitErr.receipt.status}`);

            // If only minimal gas was used, factory contract might not exist or is paused
            if (waitErr.receipt.gasUsed && waitErr.receipt.gasUsed < 50000n) {
              this.logger.error(
                `\n⚠️  Very low gas used (${waitErr.receipt.gasUsed}). Possible issues:`,
              );
              this.logger.error(
                `    1) Factory contract doesn't exist at ${this.ethereumFactoryAddress}`,
              );
              this.logger.error(
                `    2) Factory contract is paused or has authorization checks`,
              );
              this.logger.error(
                `    3) Network mismatch (contract deployed on different chain)`,
              );

              // Check if factory exists
              try {
                const provider = await this.getWorkingEthereumProvider();
                const code = await provider.getCode(
                  this.ethereumFactoryAddress,
                );
                if (!code || code === '0x') {
                  this.logger.error(
                    `\n❌ CRITICAL: No contract code at factory address ${this.ethereumFactoryAddress}!`,
                  );
                  this.logger.error(
                    `    The factory contract is not deployed at this address on Ethereum Sepolia.`,
                  );
                  this.logger.error(
                    `    This address must be updated or the contract must be redeployed.`,
                  );
                } else {
                  this.logger.log(
                    `✓ Factory contract code exists at ${this.ethereumFactoryAddress} (${code.length} bytes)`,
                  );
                }
              } catch (codeErr: any) {
                this.logger.debug(
                  'Could not check factory code:',
                  codeErr?.message,
                );
              }
            }
          }
          throw new Error(
            `Factory contract rejected the transaction on Ethereum Sepolia. ` +
              `Status code: 0 (reverted). The factory contract may not be deployed at the configured address, ` +
              `may be paused, or may have failed internal validation. ` +
              `Check backend logs for factory contract details.`,
          );
        }

        result.transactionHashes.ethereum = receipt.hash;

        // Get escrow address from event
        const event = receipt.logs
          .map((log: any) => {
            try {
              return factory.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .find((e: any) => e && e.name === 'EscrowCreated');

        if (event) {
          result.ethereumAddress = event.args.escrowAddress;
          this.logger.log(
            `✅ Ethereum escrow deployed: ${result.ethereumAddress} (${event.args.campaignName || 'Unnamed'})`,
          );

          // Log deployment to history
          await this.contractHistoryService.logAction({
            userId,
            companyId,
            wishlistItemId,
            contractAddress: result.ethereumAddress,
            fromAddress: signer.address,
            chain: 'ethereum',
            network: 'sepolia',
            action: ContractAction.DEPLOYED,
            transactionHash: receipt.hash,
            metadata: {
              targetAmountEth,
              durationInDays,
              campaignName: campaignName || '',
              campaignDescription: campaignDescription || '',
              factoryAddress: this.ethereumFactoryAddress,
            },
          });
        }
      } catch (error) {
        this.logger.error('❌ Failed to deploy Ethereum escrow:', error);
        throw error;
      }
    }

    // Deploy to Avalanche
    if (chains.includes('avalanche') && this.avalancheFactoryAddress) {
      try {
        const signer = await this.createUserSigner(userId, 'avalanche');

        const factory = new ethers.Contract(
          this.avalancheFactoryAddress,
          ESCROW_FACTORY_ABI,
          signer,
        );

        this.logger.log(
          `🔑 Using wallet: ${signer.address} for Avalanche deployment`,
        );

        // Check that factory is a contract on the chain
        const avalancheFactoryCode = await signer.provider!.getCode(
          this.avalancheFactoryAddress,
        );
        if (!avalancheFactoryCode || avalancheFactoryCode === '0x') {
          throw new Error(
            `❌ No contract found at Avalanche factory address ${this.avalancheFactoryAddress}. ` +
              `The factory contract may not be deployed on this network. ` +
              `Please verify the AVALANCHE_FACTORY_ADDRESS configuration.`,
          );
        }
        this.logger.log(
          `✅ Factory contract code exists at ${this.avalancheFactoryAddress} (code length: ${avalancheFactoryCode.length} bytes)`,
        );

        // Try to verify it's actually the EscrowFactory by calling a view function
        try {
          const testFactory = new ethers.Contract(
            this.avalancheFactoryAddress,
            ESCROW_FACTORY_ABI,
            signer.provider,
          );
          const escrowCount = await testFactory.getEscrowCount();
          this.logger.log(
            `✅ Verified as EscrowFactory (current escrow count: ${escrowCount.toString()})`,
          );
        } catch (verifyErr: any) {
          this.logger.warn(
            `⚠️  Could not verify contract is EscrowFactory. Error: ${verifyErr?.message}`,
          );
          this.logger.warn(
            `⚠️  The contract at ${this.avalancheFactoryAddress} may not be the EscrowFactory.`,
          );
          this.logger.warn(
            `⚠️  Proceeding anyway - if this fails, factory contract may not be deployed.`,
          );
        }

        const signerBalanceAvax = await signer.provider!.getBalance(
          signer.address,
        );
        this.logger.log(
          `💰 Signer balance: ${ethers.formatEther(signerBalanceAvax)} AVAX`,
        );

        // Require minimum balance for gas
        const minGasBalance = ethers.parseEther('0.01'); // AVAX is cheaper, but require 0.01 to be safe
        if (signerBalanceAvax < minGasBalance) {
          throw new Error(
            `❌ Insufficient balance for gas fees. ` +
              `Your wallet ${signer.address} has ${ethers.formatEther(signerBalanceAvax)} AVAX on Fuji testnet. ` +
              `You need at least ${ethers.formatEther(minGasBalance)} AVAX to deploy contracts. ` +
              `Please get testnet AVAX from the faucet: https://core.app/tools/testnet-faucet/`,
          );
        }

        let tx;
        try {
          // Log deployment parameters
          this.logger.log(`📋 Avalanche Deployment Parameters:`);
          this.logger.log(`   Company: ${companyWalletAddress}`);
          this.logger.log(`   Master Wallet: ${masterWalletAddress}`);
          this.logger.log(
            `   Target Amount: ${ethers.formatEther(targetAmountWei)} AVAX`,
          );
          this.logger.log(`   Duration: ${durationInDays} days`);
          this.logger.log(`   Campaign Name: ${campaignName || '(empty)'}`);
          this.logger.log(`   Factory: ${this.avalancheFactoryAddress}`);
          this.logger.log(`   Signer: ${signer.address}`);
          this.logger.log(
            `   Signer Balance: ${ethers.formatEther(signerBalanceAvax)} AVAX`,
          );

          // Try to estimate gas first - this will give us better error messages
          let shouldProceedWithoutEstimateAvax = false;
          try {
            const gasEstimate = await factory.createEscrow.estimateGas(
              companyWalletAddress,
              masterWalletAddress,
              targetAmountWei,
              durationInDays,
              campaignName || '',
              campaignDescription || '',
              wishlistItemId || '',
            );
            this.logger.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);
          } catch (gasErr: any) {
            const gasErrMsg = gasErr?.message || gasErr?.toString() || '';
            this.logger.error(`❌ Gas estimation failed: ${gasErrMsg}`);
            if (gasErr?.data) {
              this.logger.error(`   Revert data: ${gasErr.data}`);
            }
            if (gasErr?.reason) {
              this.logger.error(`   Revert reason: ${gasErr.reason}`);
            }

            // If RPC simply has no revert data (provider limitation), try proceeding anyway with high gas
            if (
              gasErrMsg.includes('missing revert data') ||
              gasErrMsg.includes('revert=null')
            ) {
              this.logger.warn(
                `⚠️  RPC provider returned no revert data. This is a provider limitation, not a contract error.`,
              );
              this.logger.warn(
                `⚠️  Proceeding with transaction using fallback gas amount (2,000,000 units)...`,
              );
              shouldProceedWithoutEstimateAvax = true;
            } else {
              throw new Error(
                `Factory contract rejected the deployment. Error: ${gasErr?.reason || gasErr?.message || 'Unknown error'}`,
              );
            }
          }

          // Send the transaction
          if (shouldProceedWithoutEstimateAvax) {
            this.logger.log(
              `📤 Sending transaction with fallback gas limit (2,000,000 units)...`,
            );
            tx = await factory.createEscrow(
              companyWalletAddress,
              masterWalletAddress,
              targetAmountWei,
              durationInDays,
              campaignName || '',
              campaignDescription || '',
              wishlistItemId || '',
              { gasLimit: 2000000 },
            );
          } else {
            tx = await factory.createEscrow(
              companyWalletAddress,
              masterWalletAddress,
              targetAmountWei,
              durationInDays,
              campaignName || '',
              campaignDescription || '',
              wishlistItemId || '',
            );
          }

          this.logger.log(`📤 Transaction sent: ${tx.hash}`);
        } catch (err: any) {
          this.logger.error(
            `❌ Error while creating Avalanche escrow: ${err?.message || err}`,
          );
          throw err;
        }

        let receipt;
        try {
          receipt = await tx.wait();
        } catch (waitErr: any) {
          // Transaction reverted on-chain
          this.logger.error(`⛔ Transaction reverted on-chain (Avalanche)`);
          if (waitErr?.receipt) {
            this.logger.error(`   Transaction hash: ${waitErr.receipt.hash}`);
            this.logger.error(`   Block: ${waitErr.receipt.blockNumber}`);
            this.logger.error(
              `   Gas used: ${waitErr.receipt.gasUsed?.toString() || 'unknown'}`,
            );
            this.logger.error(`   Status: ${waitErr.receipt.status}`);

            // If only minimal gas was used, factory contract might not exist or is paused
            if (waitErr.receipt.gasUsed && waitErr.receipt.gasUsed < 50000n) {
              this.logger.error(
                `\n⚠️  Very low gas used (${waitErr.receipt.gasUsed}). Possible issues:`,
              );
              this.logger.error(
                `    1) Factory contract doesn't exist at ${this.avalancheFactoryAddress}`,
              );
              this.logger.error(
                `    2) Factory contract is paused or has authorization checks`,
              );
              this.logger.error(
                `    3) Network mismatch (contract deployed on different chain)`,
              );

              // Check if factory exists
              try {
                const provider = await this.getWorkingAvalancheProvider();
                const code = await provider.getCode(
                  this.avalancheFactoryAddress,
                );
                if (!code || code === '0x') {
                  this.logger.error(
                    `\n❌ CRITICAL: No contract code at factory address ${this.avalancheFactoryAddress}!`,
                  );
                  this.logger.error(
                    `    The factory contract is not deployed at this address on Avalanche Fuji.`,
                  );
                  this.logger.error(
                    `    This address must be updated or the contract must be redeployed.`,
                  );
                } else {
                  this.logger.log(
                    `✓ Factory contract code exists at ${this.avalancheFactoryAddress} (${code.length} bytes)`,
                  );
                }
              } catch (codeErr: any) {
                this.logger.debug(
                  'Could not check factory code:',
                  codeErr?.message,
                );
              }
            }
          }
          throw new Error(
            `Factory contract rejected the transaction on Avalanche Fuji. ` +
              `Status code: 0 (reverted). The factory contract may not be deployed at the configured address, ` +
              `may be paused, or may have failed internal validation. ` +
              `Check backend logs for factory contract details.`,
          );
        }

        result.transactionHashes.avalanche = receipt.hash;

        // Get escrow address from event
        const event = receipt.logs
          .map((log: any) => {
            try {
              return factory.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .find((e: any) => e && e.name === 'EscrowCreated');

        if (event) {
          result.avalancheAddress = event.args.escrowAddress;
          this.logger.log(
            `✅ Avalanche escrow deployed: ${result.avalancheAddress} (${event.args.campaignName || 'Unnamed'})`,
          );

          // Log deployment to history
          await this.contractHistoryService.logAction({
            userId,
            companyId,
            wishlistItemId,
            contractAddress: result.avalancheAddress,
            fromAddress: signer.address,
            chain: 'avalanche',
            network: 'fuji',
            action: ContractAction.DEPLOYED,
            transactionHash: receipt.hash,
            metadata: {
              targetAmountEth,
              durationInDays,
              campaignName: campaignName || '',
              campaignDescription: campaignDescription || '',
              factoryAddress: this.avalancheFactoryAddress,
            },
          });
        }
      } catch (error) {
        this.logger.error('❌ Failed to deploy Avalanche escrow:', error);
        throw error;
      }
    }

    return result;
  }

  /**
   * Deploy escrow contracts using PLATFORM wallet (X402 payment flow)
   *
   * This method is called after user pays in USDC via X402 payment system.
   * The platform wallet pays for gas instead of the user's wallet.
   *
   * Key differences from deployEscrowContracts:
   * - Uses platform wallet signer (not user's wallet)
   * - Platform pays all gas fees (user paid in USDC)
   * - No user private key needed
   *
   * @param userId - User ID (for logging/tracking, not for wallet access)
   * @param wishlistItemId - Wishlist item to deploy for
   * @param companyWalletAddress - Company child wallet (funds recipient)
   * @param masterWalletAddress - User's master wallet (tracking purposes)
   * @param targetAmountEth - Campaign goal in ETH
   * @param durationInDays - Campaign duration
   * @param chains - Chains to deploy on
   * @param campaignName - Optional campaign name
   * @param campaignDescription - Optional campaign description
   */
  async deployEscrowContractsWithPlatformWallet(
    userId: string,
    wishlistItemId: string,
    companyWalletAddress: string,
    masterWalletAddress: string,
    targetAmountEth: number,
    durationInDays: number,
    chains: ('ethereum' | 'avalanche')[] = ['ethereum', 'avalanche'],
    campaignName: string | null = null,
    campaignDescription: string | null = null,
  ): Promise<EscrowDeploymentResult> {
    this.logger.log(
      `📝 [PLATFORM WALLET] Deploying escrow contracts for wishlist item: ${wishlistItemId}`,
    );
    this.logger.log(`   User ID: ${userId}`);
    this.logger.log(`   Company Wallet: ${companyWalletAddress}`);
    this.logger.log(`   Master Wallet: ${masterWalletAddress}`);
    this.logger.log(`   Payment Method: X402 USDC (Platform wallet pays gas)`);

    // Get wishlist item to extract company ID for history logging
    const wishlistItem = await this.wishlistRepo.findOne({
      where: { id: wishlistItemId },
      relations: ['company'],
    });

    if (!wishlistItem) {
      throw new BadRequestException(
        `Wishlist item ${wishlistItemId} not found`,
      );
    }

    const companyId = wishlistItem.companyId;

    // Validate that factory addresses are configured
    if (!this.ethereumFactoryAddress && !this.avalancheFactoryAddress) {
      throw new Error(
        'Smart contract factories are not configured. Please configure ETHEREUM_FACTORY_ADDRESS and/or AVALANCHE_FACTORY_ADDRESS environment variables.',
      );
    }

    // Check if requested chains have factories configured
    const unavailableChains = chains.filter((chain) => {
      if (chain === 'ethereum') return !this.ethereumFactoryAddress;
      if (chain === 'avalanche') return !this.avalancheFactoryAddress;
      return false;
    });

    if (unavailableChains.length === chains.length) {
      throw new Error(
        `None of the requested chains (${chains.join(', ')}) have factory contracts configured. ` +
          `Available: ${this.ethereumFactoryAddress ? 'ethereum' : ''}${this.avalancheFactoryAddress ? ' avalanche' : ''}`.trim(),
      );
    }

    if (unavailableChains.length > 0) {
      this.logger.warn(
        `⚠️  Skipping deployment on unavailable chains: ${unavailableChains.join(', ')}`,
      );
    }

    const result: EscrowDeploymentResult = {
      transactionHashes: {},
    };

    // Validate addresses
    if (!ethers.isAddress(companyWalletAddress)) {
      throw new BadRequestException(
        `Invalid company wallet address: ${companyWalletAddress}`,
      );
    }
    if (!ethers.isAddress(masterWalletAddress)) {
      throw new BadRequestException(
        `Invalid master wallet address: ${masterWalletAddress}`,
      );
    }

    // Ensure company and master wallet addresses are different
    if (
      companyWalletAddress.toLowerCase() === masterWalletAddress.toLowerCase()
    ) {
      throw new BadRequestException(
        'Company wallet and master wallet must be different addresses. ' +
          'Company wallet should be the company child wallet, not your personal master wallet.',
      );
    }

    // Convert target amount to wei
    const targetAmountWei = ethers.parseEther(targetAmountEth.toString());

    // Deploy to Ethereum using PLATFORM wallet
    if (chains.includes('ethereum') && this.ethereumFactoryAddress) {
      try {
        // Use platform wallet signer instead of user's wallet
        const signer = await this.platformWalletService.getEthereumSigner();

        const factory = new ethers.Contract(
          this.ethereumFactoryAddress,
          ESCROW_FACTORY_ABI,
          signer,
        );

        this.logger.log(
          `🔑 [PLATFORM] Using platform wallet: ${signer.address} for Ethereum deployment`,
        );

        // Check platform wallet balance
        const balance =
          await this.platformWalletService.getPlatformBalance('ethereum');
        this.logger.log(
          `💰 [PLATFORM] Platform Ethereum balance: ${balance.balanceEth} ETH`,
        );

        // Estimate gas cost
        const data = factory.interface.encodeFunctionData('createEscrow', [
          ethers.getAddress(companyWalletAddress),
          ethers.getAddress(masterWalletAddress),
          targetAmountWei,
          durationInDays,
          campaignName || '',
          campaignDescription || '',
          wishlistItemId || '',
        ]);

        const gasEstimate = await this.platformWalletService.estimateGasCost(
          'ethereum',
          this.ethereumFactoryAddress,
          data,
        );

        this.logger.log(
          `⛽ [PLATFORM] Estimated gas cost: ${gasEstimate.estimatedCostEth} ETH (${gasEstimate.gasLimit.toString()} gas units)`,
        );

        // Check sufficient balance
        if (
          !(await this.platformWalletService.hasSufficientGas(
            'ethereum',
            gasEstimate.estimatedCostWei,
          ))
        ) {
          throw new Error(
            `Platform wallet has insufficient balance for gas. ` +
              `Required: ${gasEstimate.estimatedCostEth} ETH, ` +
              `Available: ${balance.balanceEth} ETH`,
          );
        }

        // Send transaction using platform wallet
        this.logger.log(`🚀 [PLATFORM] Deploying Ethereum escrow contract...`);
        const tx = await factory.createEscrow(
          ethers.getAddress(companyWalletAddress),
          ethers.getAddress(masterWalletAddress),
          targetAmountWei,
          durationInDays,
          campaignName || '',
          campaignDescription || '',
          wishlistItemId || '',
        );

        this.logger.log(
          `⏳ [PLATFORM] Waiting for Ethereum transaction: ${tx.hash}`,
        );
        const receipt = await tx.wait();

        if (!receipt || receipt.status !== 1) {
          throw new Error('Ethereum transaction failed');
        }

        // Parse event to get escrow address
        const iface = new ethers.Interface(ESCROW_FACTORY_ABI);
        const log = receipt.logs.find((log) => {
          try {
            const parsed = iface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
            return parsed?.name === 'EscrowCreated';
          } catch {
            return false;
          }
        });

        if (log) {
          const parsedLog = iface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          result.ethereumAddress = parsedLog?.args[0];
        }

        result.transactionHashes.ethereum = tx.hash;

        this.logger.log(
          `✅ [PLATFORM] Ethereum escrow deployed: ${result.ethereumAddress}`,
        );
        this.logger.log(`   Transaction: ${tx.hash}`);
        this.logger.log(`   Gas Used: ${receipt.gasUsed.toString()}`);

        // Log to contract history
        await this.contractHistoryService.logAction({
          userId,
          companyId,
          wishlistItemId,
          contractAddress: result.ethereumAddress || '',
          fromAddress: signer.address,
          chain: 'ethereum',
          network: 'sepolia',
          action: ContractAction.DEPLOYED,
          transactionHash: tx.hash,
          metadata: {
            deploymentMethod: 'platform_wallet',
            paymentMethod: 'x402_usdc',
            targetAmountEth,
            durationInDays,
            campaignName: campaignName || '',
            campaignDescription: campaignDescription || '',
            factoryAddress: this.ethereumFactoryAddress,
          },
          notes: `Platform wallet deployment via X402 USDC payment`,
        });
      } catch (error: any) {
        this.logger.error(
          `❌ [PLATFORM] Failed to deploy Ethereum escrow: ${error?.message}`,
        );
        throw error;
      }
    }

    // Deploy to Avalanche using PLATFORM wallet
    if (chains.includes('avalanche') && this.avalancheFactoryAddress) {
      try {
        // Use platform wallet signer instead of user's wallet
        const signer = await this.platformWalletService.getAvalancheSigner();

        const factory = new ethers.Contract(
          this.avalancheFactoryAddress,
          ESCROW_FACTORY_ABI,
          signer,
        );

        this.logger.log(
          `🔑 [PLATFORM] Using platform wallet: ${signer.address} for Avalanche deployment`,
        );

        // Check platform wallet balance
        const balance =
          await this.platformWalletService.getPlatformBalance('avalanche');
        this.logger.log(
          `💰 [PLATFORM] Platform Avalanche balance: ${balance.balanceEth} AVAX`,
        );

        // Estimate gas cost
        const data = factory.interface.encodeFunctionData('createEscrow', [
          ethers.getAddress(companyWalletAddress),
          ethers.getAddress(masterWalletAddress),
          targetAmountWei,
          durationInDays,
          campaignName || '',
          campaignDescription || '',
          wishlistItemId || '',
        ]);

        const gasEstimate = await this.platformWalletService.estimateGasCost(
          'avalanche',
          this.avalancheFactoryAddress,
          data,
        );

        this.logger.log(
          `⛽ [PLATFORM] Estimated gas cost: ${gasEstimate.estimatedCostEth} AVAX (${gasEstimate.gasLimit.toString()} gas units)`,
        );

        // Check sufficient balance
        if (
          !(await this.platformWalletService.hasSufficientGas(
            'avalanche',
            gasEstimate.estimatedCostWei,
          ))
        ) {
          throw new Error(
            `Platform wallet has insufficient balance for gas. ` +
              `Required: ${gasEstimate.estimatedCostEth} AVAX, ` +
              `Available: ${balance.balanceEth} AVAX`,
          );
        }

        // Send transaction using platform wallet
        this.logger.log(`🚀 [PLATFORM] Deploying Avalanche escrow contract...`);
        const tx = await factory.createEscrow(
          ethers.getAddress(companyWalletAddress),
          ethers.getAddress(masterWalletAddress),
          targetAmountWei,
          durationInDays,
          campaignName || '',
          campaignDescription || '',
          wishlistItemId || '',
        );

        this.logger.log(
          `⏳ [PLATFORM] Waiting for Avalanche transaction: ${tx.hash}`,
        );
        const receipt = await tx.wait();

        if (!receipt || receipt.status !== 1) {
          throw new Error('Avalanche transaction failed');
        }

        // Parse event to get escrow address
        const iface = new ethers.Interface(ESCROW_FACTORY_ABI);
        const log = receipt.logs.find((log) => {
          try {
            const parsed = iface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
            return parsed?.name === 'EscrowCreated';
          } catch {
            return false;
          }
        });

        if (log) {
          const parsedLog = iface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          result.avalancheAddress = parsedLog?.args[0];
        }

        result.transactionHashes.avalanche = tx.hash;

        this.logger.log(
          `✅ [PLATFORM] Avalanche escrow deployed: ${result.avalancheAddress}`,
        );
        this.logger.log(`   Transaction: ${tx.hash}`);
        this.logger.log(`   Gas Used: ${receipt.gasUsed.toString()}`);

        // Log to contract history
        await this.contractHistoryService.logAction({
          userId,
          companyId,
          wishlistItemId,
          contractAddress: result.avalancheAddress || '',
          fromAddress: signer.address,
          chain: 'avalanche',
          network: 'fuji',
          action: ContractAction.DEPLOYED,
          transactionHash: tx.hash,
          metadata: {
            deploymentMethod: 'platform_wallet',
            paymentMethod: 'x402_usdc',
            targetAmountEth,
            durationInDays,
            campaignName: campaignName || '',
            campaignDescription: campaignDescription || '',
            factoryAddress: this.avalancheFactoryAddress,
          },
          notes: `Platform wallet deployment via X402 USDC payment`,
        });
      } catch (error: any) {
        this.logger.error(
          `❌ [PLATFORM] Failed to deploy Avalanche escrow: ${error?.message}`,
        );
        throw error;
      }
    }

    return result;
  }

  /**
   * Estimate gas costs for deploying escrow contracts
   */
  async estimateDeploymentGas(
    userId: string,
    wishlistItemId: string,
    companyWalletAddress: string,
    targetAmountEth: number,
    durationInDays: number,
    chains: ('ethereum' | 'avalanche')[] = ['ethereum', 'avalanche'],
    campaignName: string | null = null,
    campaignDescription: string | null = null,
  ) {
    this.logger.log(`📊 Estimating gas costs for escrow deployment`);

    const gasEstimate: {
      ethereum?: {
        estimatedGasWei: string;
        estimatedGasEth: string;
        estimatedGasUsd: string;
      };
      avalanche?: {
        estimatedGasWei: string;
        estimatedGasEth: string;
        estimatedGasUsd: string;
      };
    } = {};

    // Get current gas prices using fee data (supports EIP-1559 networks)
    const ethereumFeeData = chains.includes('ethereum')
      ? await this.ethereumProvider.getFeeData()
      : null;
    const avalancheFeeData = chains.includes('avalanche')
      ? await this.avalancheProvider.getFeeData()
      : null;
    // Prefer maxFeePerGas (EIP-1559), otherwise fall back to gasPrice or priority fee
    const ethereumGasPrice = ethereumFeeData
      ? (ethereumFeeData.maxFeePerGas ??
        ethereumFeeData.gasPrice ??
        ethereumFeeData.maxPriorityFeePerGas)
      : null;
    const avalancheGasPrice = avalancheFeeData
      ? (avalancheFeeData.maxFeePerGas ??
        avalancheFeeData.gasPrice ??
        avalancheFeeData.maxPriorityFeePerGas)
      : null;

    // Estimate Ethereum deployment
    if (
      chains.includes('ethereum') &&
      this.ethereumFactoryAddress &&
      ethereumGasPrice
    ) {
      try {
        const signer = await this.createUserSigner(userId, 'ethereum');
        const factory = new ethers.Contract(
          this.ethereumFactoryAddress,
          ESCROW_FACTORY_ABI,
          signer,
        );

        const targetAmountWei = ethers.parseEther(targetAmountEth.toString());

        // Estimate gas
        // Run estimate with retry for providers that reject batched requests
        let estimatedGas: bigint | null = null;
        let lastError: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            estimatedGas = await factory.createEscrow.estimateGas(
              companyWalletAddress,
              signer.address, // masterWallet for fund forwarding
              targetAmountWei,
              durationInDays,
              campaignName || '',
              campaignDescription || '',
            );
            // success
            break;
          } catch (gasErr: any) {
            lastError = gasErr;
            const msg = gasErr?.message || gasErr?.toString() || '';
            // Detect drpc.org free-tier batching error and attempt to switch provider and retry once
            if (
              msg.includes('Batch of more than') ||
              msg.includes('Batch of more than 3 requests') ||
              (gasErr?.data && String(gasErr.data).includes('Batch of more'))
            ) {
              this.logger.warn(
                '⚠️  Provider rejected batched requests. Switching to next RPC endpoint and retrying gas estimate...',
              );
              try {
                await this.getWorkingEthereumProvider();
                continue; // retry
              } catch (swapErr: any) {
                this.logger.debug(
                  'Failed to switch provider during gas estimate retry',
                  swapErr?.message || swapErr,
                );
                break;
              }
            }

            // For other errors, break and handle below
            break;
          }
        }

        if (estimatedGas) {
          const gasCostWei = estimatedGas * ethereumGasPrice;
          const gasCostEth = ethers.formatEther(gasCostWei);

          gasEstimate.ethereum = {
            estimatedGasWei: estimatedGas.toString(),
            estimatedGasEth: gasCostEth,
            estimatedGasUsd: (parseFloat(gasCostEth) * 2500).toFixed(2), // Rough USD estimate (1 ETH ≈ $2500)
          };

          this.logger.log(
            `✅ Ethereum gas estimate: ${gasCostEth} ETH (~$${gasEstimate.ethereum.estimatedGasUsd})`,
          );
        } else {
          this.logger.warn(
            `⚠️  Failed to estimate Ethereum gas: ${lastError?.message || lastError}`,
          );
          if (lastError) {
            try {
              this.logger.debug(
                'Detailed Ethereum gas estimate error:',
                JSON.stringify({
                  message: lastError.message,
                  reason: lastError.reason,
                  data: lastError.data,
                  error: lastError.error,
                }),
              );
            } catch (jsonErr) {
              this.logger.debug(
                'Could not stringify lastError for Ethereum gas estimate',
              );
            }

            // Attempt a direct provider.call to retrieve revert data (if any)
            try {
              const provider = await this.getWorkingEthereumProvider();
              const iface = new ethers.Interface(ESCROW_FACTORY_ABI);
              const data = iface.encodeFunctionData('createEscrow', [
                companyWalletAddress,
                signer.address,
                targetAmountWei,
                durationInDays,
                campaignName || '',
                campaignDescription || '',
              ]);

              try {
                await provider.call({
                  to: this.ethereumFactoryAddress,
                  data,
                  from: signer.address,
                });
              } catch (callErr: any) {
                const hex = callErr?.data || callErr?.error?.data || null;
                if (hex) {
                  this.logger.debug(
                    'Raw revert data from provider.call (hex):',
                    hex,
                  );
                  try {
                    const h = hex.startsWith('0x') ? hex.slice(2) : hex;
                    const selector = h.slice(0, 8);
                    if (selector === '08c379a0') {
                      // Error(string) - parse length and string
                      const lenHex = h.slice(8 + 64, 8 + 64 + 64);
                      const len = parseInt(lenHex, 16);
                      const strHex = h.slice(
                        8 + 64 + 64,
                        8 + 64 + 64 + len * 2,
                      );
                      const reason = Buffer.from(strHex, 'hex').toString(
                        'utf8',
                      );
                      this.logger.warn(
                        `⚠️  Revert reason from factory call: ${reason}`,
                      );
                    } else {
                      this.logger.debug(
                        'Factory revert had non-standard selector:',
                        selector,
                      );
                    }
                  } catch (decodeErr: any) {
                    this.logger.debug(
                      'Failed to decode revert data:',
                      decodeErr?.message || decodeErr,
                    );
                  }
                }
              }
            } catch (providerCallErr: any) {
              this.logger.debug(
                'Provider.call attempt failed during error diagnosis:',
                providerCallErr?.message || providerCallErr,
              );
            }
          }

          try {
            const provider = await this.getWorkingEthereumProvider();
            const factory = new ethers.Contract(
              this.ethereumFactoryAddress,
              ESCROW_FACTORY_ABI,
              provider,
            );
            const code = await provider.getCode(this.ethereumFactoryAddress);
            if (!code || code === '0x') {
              this.logger.warn(
                `⚠️  No contract code found at Ethereum factory address ${factory.address} during gas estimate`,
              );
            }
          } catch (e) {
            this.logger.debug(
              'Could not check factory code during gas estimate',
            );
          }
          // Use conservative estimate if actual estimate fails
          gasEstimate.ethereum = {
            estimatedGasWei: '500000',
            estimatedGasEth: ethers.formatEther(
              BigInt(500000) * ethereumGasPrice,
            ),
            estimatedGasUsd: '12.50', // Rough estimate
          };
        }
      } catch (error: any) {
        this.logger.warn(
          `⚠️  Failed to estimate Ethereum gas (outer): ${error?.message || error}`,
        );
        // Use conservative estimate if actual estimate fails
        gasEstimate.ethereum = {
          estimatedGasWei: '500000',
          estimatedGasEth: ethers.formatEther(
            BigInt(500000) * ethereumGasPrice,
          ),
          estimatedGasUsd: '12.50',
        };
      }
    }

    // Estimate Avalanche deployment
    if (
      chains.includes('avalanche') &&
      this.avalancheFactoryAddress &&
      avalancheGasPrice
    ) {
      try {
        const signer = await this.createUserSigner(userId, 'avalanche');
        const factory = new ethers.Contract(
          this.avalancheFactoryAddress,
          ESCROW_FACTORY_ABI,
          signer,
        );

        const targetAmountWei = ethers.parseEther(targetAmountEth.toString());

        // Estimate gas
        // Run estimate with retry for providers that reject batched requests
        let estimatedGasAvax: bigint | null = null;
        let lastAvaxError: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            estimatedGasAvax = await factory.createEscrow.estimateGas(
              companyWalletAddress,
              signer.address, // masterWallet for fund forwarding
              targetAmountWei,
              durationInDays,
              campaignName || '',
              campaignDescription || '',
            );
            break;
          } catch (gasErr: any) {
            lastAvaxError = gasErr;
            const msg = gasErr?.message || gasErr?.toString() || '';
            if (
              msg.includes('Batch of more than') ||
              (gasErr?.data && String(gasErr.data).includes('Batch of more'))
            ) {
              this.logger.warn(
                '⚠️  Provider rejected batched requests on Avalanche endpoint. Switching RPC and retrying...',
              );
              try {
                await this.getWorkingAvalancheProvider();
                continue;
              } catch (swapErr: any) {
                this.logger.debug(
                  'Failed to switch avalanche provider during gas estimate retry',
                  swapErr?.message || swapErr,
                );
                break;
              }
            }
            break;
          }
        }

        if (estimatedGasAvax) {
          const gasCostWei = estimatedGasAvax * avalancheGasPrice;
          const gasCostAvax = ethers.formatEther(gasCostWei);

          gasEstimate.avalanche = {
            estimatedGasWei: estimatedGasAvax.toString(),
            estimatedGasEth: gasCostAvax,
            estimatedGasUsd: (parseFloat(gasCostAvax) * 80).toFixed(2), // Rough USD estimate (1 AVAX ≈ $80)
          };

          this.logger.log(
            `✅ Avalanche gas estimate: ${gasCostAvax} AVAX (~$${gasEstimate.avalanche.estimatedGasUsd})`,
          );
        } else {
          this.logger.warn(
            `⚠️  Failed to estimate Avalanche gas: ${lastAvaxError?.message || lastAvaxError}`,
          );
          if (lastAvaxError) {
            try {
              this.logger.debug(
                'Detailed Avalanche gas estimate error:',
                JSON.stringify({
                  message: lastAvaxError.message,
                  reason: lastAvaxError.reason,
                  data: lastAvaxError.data,
                  error: lastAvaxError.error,
                }),
              );
            } catch (jsonErr) {
              this.logger.debug(
                'Could not stringify lastAvaxError for Avalanche gas estimate',
              );
            }
          }

          try {
            const provider = await this.getWorkingAvalancheProvider();
            const factory = new ethers.Contract(
              this.avalancheFactoryAddress,
              ESCROW_FACTORY_ABI,
              provider,
            );
            const code = await provider.getCode(this.avalancheFactoryAddress);
            if (!code || code === '0x') {
              this.logger.warn(
                `⚠️  No contract code found at Avalanche factory address ${factory.address} during gas estimate`,
              );
            }
          } catch (e) {
            this.logger.debug(
              'Could not check factory code during avalanche gas estimate',
            );
          }
          // Use conservative estimate if actual estimate fails
          gasEstimate.avalanche = {
            estimatedGasWei: '500000',
            estimatedGasEth: ethers.formatEther(
              BigInt(500000) * avalancheGasPrice,
            ),
            estimatedGasUsd: '4.00', // Rough estimate
          };
        }
      } catch (error: any) {
        this.logger.warn(
          `⚠️  Failed to estimate Avalanche gas (outer): ${error?.message || error}`,
        );
        // Use conservative estimate if actual estimate fails
        gasEstimate.avalanche = {
          estimatedGasWei: '500000',
          estimatedGasEth: ethers.formatEther(
            BigInt(500000) * avalancheGasPrice,
          ),
          estimatedGasUsd: '4.00',
        };
      }
    }

    return gasEstimate;
  }

  /**
   * Get campaign status from blockchain
   */
  async getCampaignStatus(
    escrowAddress: string,
    chain: 'ethereum' | 'avalanche' = 'ethereum',
    includeContributors: boolean = false,
  ): Promise<CampaignStatus> {
    const provider =
      chain === 'ethereum' ? this.ethereumProvider : this.avalancheProvider;

    const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, provider);

    const [
      totalRaised,
      targetAmount,
      deadline,
      timeRemaining,
      isFinalized,
      isSuccessful,
      contributorCount,
    ] = await escrow.getCampaignStatus();

    const progressPercentage = await escrow.getProgressPercentage();
    const isActive = await escrow.isActive();

    const status: CampaignStatus = {
      totalRaised: ethers.formatEther(totalRaised),
      targetAmount: ethers.formatEther(targetAmount),
      deadline: new Date(Number(deadline) * 1000),
      timeRemaining: Number(timeRemaining),
      isFinalized,
      isSuccessful,
      contributorCount: Number(contributorCount),
      progressPercentage: Number(progressPercentage),
      isActive,
    };

    // Optionally include contributor details
    if (includeContributors && Number(contributorCount) > 0) {
      status.contributors = await this.getContributors(
        escrowAddress,
        Number(contributorCount),
        chain,
      );
    }

    try {
      // Attempt to read name & description from contract
      const name = await escrow.campaignName();
      const description = await escrow.campaignDescription();
      status.campaignName = name || null;
      status.campaignDescription = description || null;
    } catch (err) {
      // Not all contracts or older versions may have these; ignore errors
    }

    return status;
  }

  /**
   * Get list of all contributors and their contributions
   */
  async getContributors(
    escrowAddress: string,
    count: number,
    chain: 'ethereum' | 'avalanche' = 'ethereum',
  ): Promise<ContributorInfo[]> {
    const provider =
      chain === 'ethereum' ? this.ethereumProvider : this.avalancheProvider;
    const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, provider);

    const contributors: ContributorInfo[] = [];

    for (let i = 0; i < count; i++) {
      const address = await escrow.contributors(i);
      const amount = await escrow.contributions(address);
      const amountEth = ethers.formatEther(amount);

      contributors.push({
        address,
        amount: amount.toString(),
        amountEth,
      });
    }

    return contributors;
  }

  /**
   * Sync wishlist item with blockchain state
   */
  async syncWishlistWithBlockchain(wishlistItemId: string): Promise<void> {
    const wishlistItem = await this.wishlistRepo.findOne({
      where: { id: wishlistItemId },
    });

    if (!wishlistItem) {
      throw new Error('Wishlist item not found');
    }

    // Check Ethereum escrow if exists
    if (wishlistItem.ethereumEscrowAddress) {
      try {
        const status = await this.getCampaignStatus(
          wishlistItem.ethereumEscrowAddress,
          'ethereum',
        );

        await this.wishlistRepo.update(wishlistItemId, {
          amountRaised: parseFloat(status.totalRaised),
          isEscrowActive: status.isActive,
          isEscrowFinalized: status.isFinalized,
          isFulfilled: status.isSuccessful,
        });

        this.logger.log(
          `✅ Synced Ethereum escrow status for wishlist ${wishlistItemId}`,
        );
      } catch (error) {
        this.logger.error(`❌ Failed to sync Ethereum escrow:`, error);
      }
    }

    // Check Avalanche escrow if exists
    if (wishlistItem.avalancheEscrowAddress) {
      try {
        const status = await this.getCampaignStatus(
          wishlistItem.avalancheEscrowAddress,
          'avalanche',
        );

        // If Avalanche has higher amount raised, use that
        const currentAmount = parseFloat(status.totalRaised);
        if (currentAmount > wishlistItem.amountRaised) {
          await this.wishlistRepo.update(wishlistItemId, {
            amountRaised: currentAmount,
            isEscrowActive: status.isActive,
            isEscrowFinalized: status.isFinalized,
            isFulfilled: status.isSuccessful,
          });
        }

        this.logger.log(
          `✅ Synced Avalanche escrow status for wishlist ${wishlistItemId}`,
        );
      } catch (error) {
        this.logger.error(`❌ Failed to sync Avalanche escrow:`, error);
      }
    }
  }

  /**
   * Get all escrows for a company
   */
  async getCompanyEscrows(
    companyWalletAddress: string,
    chain: 'ethereum' | 'avalanche' = 'ethereum',
  ): Promise<string[]> {
    const provider =
      chain === 'ethereum' ? this.ethereumProvider : this.avalancheProvider;
    const factoryAddress =
      chain === 'ethereum'
        ? this.ethereumFactoryAddress
        : this.avalancheFactoryAddress;

    if (!factoryAddress) {
      throw new Error(`Factory address not configured for ${chain}`);
    }

    const factory = new ethers.Contract(
      factoryAddress,
      ESCROW_FACTORY_ABI,
      provider,
    );
    return await factory.getCompanyEscrows(companyWalletAddress);
  }

  /**
   * Check if contracts are deployed and configured
   */
  isConfigured(): boolean {
    return !!(this.ethereumFactoryAddress && this.avalancheFactoryAddress);
  }

  /**
   * Get provider for reading blockchain data
   */
  getProvider(chain: 'ethereum' | 'avalanche'): ethers.AbstractProvider {
    return chain === 'ethereum'
      ? this.ethereumProvider
      : this.avalancheProvider;
  }

  /**
   * Send a transaction from user's wallet to recipient
   */
  async sendUserTransaction(
    userId: string,
    recipientAddress: string,
    chain: 'ethereum' | 'avalanche' | 'solana' | 'stellar' | 'bitcoin',
    amountEth: number,
  ): Promise<{
    transactionHash: string;
    from: string;
    to: string;
    amount: string;
    explorerUrl: string;
  }> {
    this.logger.log(
      `📤 Sending transaction from user ${userId} to ${recipientAddress} on ${chain}`,
    );

    // Validate amount
    if (amountEth <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    try {
      // Non-EVM chains first
      if (chain === 'solana') {
        // derive keypair and send SOL
        const secret = await this.getUserPrivateKey(userId, 'solana');
        const keypair = SolanaKeypair.fromSecretKey(Buffer.from(secret, 'hex'));
        const connection = new Connection(this.solanaRpc, 'confirmed');
        const lamports = Math.round(amountEth * LAMPORTS_PER_SOL);
        const solTx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: new PublicKey(recipientAddress),
            lamports,
          }),
        );
        const signature = await sendAndConfirmTransaction(connection, solTx, [
          keypair,
        ]);
        this.logger.log(`✅ Solana tx sent: ${signature}`);
        const explorerUrl = `https://explorer.solana.com/tx/${signature}`;
        return {
          transactionHash: signature,
          from: keypair.publicKey.toBase58(),
          to: recipientAddress,
          amount: amountEth.toString(),
          explorerUrl,
        };
      }

      if (chain === 'stellar') {
        const secret = await this.getUserPrivateKey(userId, 'stellar');
        const keypair = StellarKeypair.fromSecret(secret);
        const server = new Server(this.stellarHorizon);
        const account = await server.loadAccount(keypair.publicKey());
        const fee = await server.fetchBaseFee();
        const amountStr = amountEth.toString();
        const tx = new TransactionBuilder(account, {
          fee: fee.toString(),
          networkPassphrase: Networks.PUBLIC,
        })
          .addOperation(
            Operation.payment({
              destination: recipientAddress,
              asset: Asset.native(),
              amount: amountStr,
            }),
          )
          .setTimeout(30)
          .build();
        tx.sign(keypair);
        const txResponse = await server.submitTransaction(tx as any);
        this.logger.log(`✅ Stellar tx sent: ${txResponse.hash}`);
        const explorerUrl = `https://stellarscan.io/tx/${txResponse.hash}`;
        return {
          transactionHash: txResponse.hash,
          from: keypair.publicKey(),
          to: recipientAddress,
          amount: amountStr,
          explorerUrl,
        };
      }

      if (chain === 'bitcoin') {
        // mainnet bc1q (P2WPKH) address validation
        if (!/^bc1[a-z0-9]{25,80}$/.test(recipientAddress)) {
          throw new Error('Invalid Bitcoin address (expected mainnet bc1... address)');
        }
        // build and broadcast a simple P2WPKH transaction using Blockstream API
        const wif = await this.getUserPrivateKey(userId, 'bitcoin');
        // instantiate factory each time in case networks object not yet configured
        const ECPair = ECPairFactory({ network: networks.bitcoin });
        // wif is a raw hex private key; use fromPrivateKey instead of fromWIF
        const keyPair = ECPair.fromPrivateKey(Buffer.from(wif.replace(/^0x/, ''), 'hex'), { network: networks.bitcoin });
        const { address: fromAddr } = payments.p2wpkh({
          pubkey: keyPair.publicKey,
          network: networks.bitcoin,
        });

        if (!fromAddr) {
          throw new Error('Failed to derive Bitcoin address from keypair');
        }

        // fetch UTXOs
        const utxoResp = await fetch(
          `https://blockstream.info/api/address/${fromAddr}/utxo`,
        );
        if (!utxoResp.ok) throw new Error('Failed to fetch UTXOs');
        const utxos: Array<{ txid: string; vout: number; value: number }> =
          await utxoResp.json();
        const psbt = new Psbt({ network: networks.bitcoin });
        let totalSats = 0;
        for (const u of utxos) {
          psbt.addInput({
            hash: u.txid,
            index: u.vout,
            witnessUtxo: {
              script: address.toOutputScript(fromAddr, networks.bitcoin),
              value: u.value,
            },
          });
          totalSats += u.value;
        }
        const satAmount = Math.round(amountEth * 1e8);
        const fee = 1000; // flat fee
        if (totalSats < satAmount + fee)
          throw new Error('Insufficient BTC balance');
        psbt.addOutput({ address: recipientAddress, value: satAmount });
        const change = totalSats - satAmount - fee;
        if (change > 0) {
          psbt.addOutput({ address: fromAddr, value: change });
        }
        psbt.signAllInputs(keyPair);
        psbt.finalizeAllInputs();
        const rawTx = psbt.extractTransaction().toHex();
        const broadcastResp = await fetch(
          'https://blockstream.info/api/tx',
          { method: 'POST', body: rawTx },
        );
        if (!broadcastResp.ok) {
          const errText = await broadcastResp.text();
          throw new Error(`Broadcast failed: ${errText}`);
        }
        const txid = await broadcastResp.text();
        const explorerUrl = `https://www.blockstream.info/tx/${txid}`;
        return {
          transactionHash: txid,
          from: fromAddr,
          to: recipientAddress,
          amount: amountEth.toString(),
          explorerUrl,
        };
      }

      // Handle each chain separately
      if (chain === 'ethereum' || chain === 'avalanche') {
        // Validate EVM address
        if (!ethers.isAddress(recipientAddress)) {
          throw new Error('Invalid recipient address');
        }

        // Create signer from user's wallet
        const signer = await this.createUserSigner(userId, chain);
        const fromAddress = signer.address;

        this.logger.log(
          `🔑 Using wallet: ${fromAddress} for ${chain} transaction`,
        );

        // Convert amount to Wei
        const amountWei = ethers.parseEther(amountEth.toString());

        // Get current gas price
        const provider =
          chain === 'ethereum' ? this.ethereumProvider : this.avalancheProvider;
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice;

        if (!gasPrice) {
          throw new Error('Could not retrieve gas price');
        }

        this.logger.log(
          `⛽ Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`,
        );

        // Estimate gas
        const estimatedGas = await provider.estimateGas({
          to: recipientAddress,
          from: fromAddress,
          value: amountWei,
        });

        this.logger.log(`⛽ Estimated gas: ${estimatedGas.toString()}`);

        // Create and send transaction
        const tx = await signer.sendTransaction({
          to: recipientAddress,
          value: amountWei,
          gasLimit: (estimatedGas * BigInt(120)) / BigInt(100), // Add 20% buffer
        });

        this.logger.log(`✅ Transaction sent: ${tx.hash}`);

        // Wait for transaction to be mined
        const receipt = await tx.wait();

        const explorerUrl =
          chain === 'ethereum'
            ? `https://sepolia.etherscan.io/tx/${tx.hash}`
            : `https://testnet.snowtrace.io/tx/${tx.hash}`;

        return {
          transactionHash: tx.hash,
          from: fromAddress,
          to: recipientAddress,
          amount: amountEth.toString(),
          explorerUrl,
        };
      }

      // Fallback
      throw new Error('Unsupported chain');
    } catch (error: any) {
      this.logger.error(`❌ Transaction failed: ${error.message}`);
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }
}
