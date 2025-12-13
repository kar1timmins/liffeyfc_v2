import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import * as crypto from 'crypto';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { Company } from '../entities/company.entity';
import { UserWallet } from '../entities/user-wallet.entity';
import { CompanyWallet } from '../entities/company-wallet.entity';

// ABI for EscrowFactory contract
const ESCROW_FACTORY_ABI = [
  "function createEscrow(address _company, address _masterWallet, uint256 _targetAmount, uint256 _durationInDays, string _campaignName, string _campaignDescription) external returns (address)",
  "function getCompanyEscrows(address _company) external view returns (address[])",
  "function getEscrowDetails(address _escrow) external view returns (address company, uint256 totalRaised, uint256 targetAmount, uint256 deadline, bool isFinalized, bool isSuccessful, string campaignName, string campaignDescription)",
  "event EscrowCreated(address indexed escrowAddress, address indexed company, uint256 targetAmount, uint256 deadline, uint256 timestamp, string campaignName, string campaignDescription)"
];

// ABI for CompanyWishlistEscrow contract
const ESCROW_ABI = [
  "function contribute() external payable",
  "function finalize() external",
  "function claimRefund() external",
  "function getCampaignStatus() external view returns (uint256 totalRaised, uint256 targetAmount, uint256 deadline, uint256 timeRemaining, bool isFinalized, bool isSuccessful, uint256 contributorCount)",
  "function getContribution(address contributor) external view returns (uint256)",
  "function getProgressPercentage() external view returns (uint256)",
  "function isActive() external view returns (bool)",
  "function company() external view returns (address)",
  "function targetAmount() external view returns (uint256)",
  "function deadline() external view returns (uint256)",
  "function totalRaised() external view returns (uint256)",
  "function isFinalized() external view returns (bool)",
  "function isSuccessful() external view returns (bool)",
  "function campaignName() external view returns (string)",
  "function campaignDescription() external view returns (string)",
  "function contributors(uint256 index) external view returns (address)",
  "function contributions(address contributor) external view returns (uint256)",
  "event ContributionReceived(address indexed contributor, uint256 amount, uint256 totalRaised)",
  "event FundsReleased(address indexed company, uint256 amount)",
  "event RefundIssued(address indexed contributor, uint256 amount)",
  "event CampaignFinalized(bool successful, uint256 totalRaised)"
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

  // RPC Providers with fallbacks
  private ethereumProvider: ethers.JsonRpcProvider;
  private avalancheProvider: ethers.JsonRpcProvider;

  // Factory contract addresses
  private ethereumFactoryAddress: string;
  private avalancheFactoryAddress: string;

  // RPC Endpoint fallbacks
  private ethereumRPCEndpoints = [
    'https://sepolia.drpc.org',
    'https://sepolia-rpc.publicnode.com',
    'https://ethereum-sepolia.publicnode.com',
    'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    'https://rpc.sepolia.org'
  ];

  private avalancheRPCEndpoints = [
    'https://api.avax-test.network/ext/bc/C/rpc',
    'https://avalanche-fuji-c-chain.publicnode.com',
    'https://avalanche-fuji.drpc.org'
  ];

  constructor(
    @InjectRepository(WishlistItem)
    private wishlistRepo: Repository<WishlistItem>,
    @InjectRepository(Company)
    private companyRepo: Repository<Company>,
    @InjectRepository(UserWallet)
    private userWalletRepo: Repository<UserWallet>,
    @InjectRepository(CompanyWallet)
    private companyWalletRepo: Repository<CompanyWallet>,
  ) {
    // Get encryption key from environment variable (for decrypting stored wallets)
    const key = process.env.WALLET_ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
      throw new Error('WALLET_ENCRYPTION_KEY must be set and be 64 hex characters (32 bytes)');
    }
    this.ENCRYPTION_KEY = Buffer.from(key, 'hex');

    // Get RPC URLs from environment or use first fallback
    const ethereumRpcUrl = process.env.ETHEREUM_RPC_URL || this.ethereumRPCEndpoints[0];
    const avalancheRpcUrl = process.env.AVALANCHE_RPC_URL || this.avalancheRPCEndpoints[0];

    // Initialize providers with fallback retry logic
    this.ethereumProvider = new ethers.JsonRpcProvider(ethereumRpcUrl);
    this.avalancheProvider = new ethers.JsonRpcProvider(avalancheRpcUrl);

    // Factory addresses from environment
    this.ethereumFactoryAddress = process.env.ETHEREUM_FACTORY_ADDRESS || '';
    this.avalancheFactoryAddress = process.env.AVALANCHE_FACTORY_ADDRESS || '';

    if (!this.ethereumFactoryAddress || !this.avalancheFactoryAddress) {
      this.logger.warn('⚠️  Factory contract addresses not configured. Escrow functionality will be limited.');
    }

    this.logger.log(`📡 Using Ethereum RPC: ${ethereumRpcUrl}`);
    this.logger.log(`📡 Using Avalanche RPC: ${avalancheRpcUrl}`);
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
   * Get working Ethereum provider with fallback
   */
  private async getWorkingEthereumProvider(): Promise<ethers.JsonRpcProvider> {
    try {
      // Test current provider
      await this.ethereumProvider.getNetwork();
      return this.ethereumProvider;
    } catch (error) {
      this.logger.warn('⚠️  Current Ethereum RPC endpoint failed, trying fallbacks...');
      for (const rpcUrl of this.ethereumRPCEndpoints) {
        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          await provider.getNetwork();
          this.logger.log(`✅ Successfully switched to Ethereum RPC: ${rpcUrl}`);
          this.ethereumProvider = provider;
          return provider;
        } catch (e) {
          this.logger.debug(`Failed to connect to ${rpcUrl}`);
        }
      }
      throw new Error('No working Ethereum RPC endpoint available');
    }
  }

  /**
   * Get working Avalanche provider with fallback
   */
  private async getWorkingAvalancheProvider(): Promise<ethers.JsonRpcProvider> {
    try {
      // Test current provider
      await this.avalancheProvider.getNetwork();
      return this.avalancheProvider;
    } catch (error) {
      this.logger.warn('⚠️  Current Avalanche RPC endpoint failed, trying fallbacks...');
      for (const rpcUrl of this.avalancheRPCEndpoints) {
        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          await provider.getNetwork();
          this.logger.log(`✅ Successfully switched to Avalanche RPC: ${rpcUrl}`);
          this.avalancheProvider = provider;
          return provider;
        } catch (e) {
          this.logger.debug(`Failed to connect to ${rpcUrl}`);
        }
      }
      throw new Error('No working Avalanche RPC endpoint available');
    }
  }

  /**
   * Get user's private key from database (decrypted)
   * This retrieves the user's master wallet private key from the database
   */
  async getUserPrivateKey(userId: string, chain: 'ethereum' | 'avalanche'): Promise<string> {
    this.logger.log(`🔍 Looking up wallet for user: ${userId}`);
    
    const userWallet = await this.userWalletRepo.findOne({
      where: { userId }
    });

    if (!userWallet) {
      this.logger.error(`❌ No wallet found in database for user: ${userId}`);
      throw new BadRequestException('User wallet not found. Please generate a wallet first.');
    }

    this.logger.log(`🔍 Retrieved wallet for user ${userId}: ETH=${userWallet.ethAddress}, AVAX=${userWallet.avaxAddress}`);

    try {
      const decryptedPrivateKey = this.decrypt(userWallet.encryptedPrivateKey);
      return decryptedPrivateKey;
    } catch (error) {
      this.logger.error('Failed to decrypt user private key:', error);
      throw new BadRequestException('Failed to decrypt wallet. Please try again.');
    }
  }

  /**
   * Create signer for user's wallet
   */
  async createUserSigner(
    userId: string,
    chain: 'ethereum' | 'avalanche'
  ): Promise<ethers.Wallet> {
    const privateKey = await this.getUserPrivateKey(userId, chain);
    
    if (chain === 'ethereum') {
      const provider = await this.getWorkingEthereumProvider();
      return new ethers.Wallet(privateKey, provider);
    } else {
      const provider = await this.getWorkingAvalancheProvider();
      return new ethers.Wallet(privateKey, provider);
    }
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
    this.logger.log(`📝 Deploying escrow contracts for wishlist item: ${wishlistItemId} by user: ${userId}`);
    this.logger.log(`   Company Wallet: ${companyWalletAddress}`);
    this.logger.log(`   Master Wallet (funds recipient): ${masterWalletAddress}`);

    // Validate that factory addresses are configured
    if (!this.ethereumFactoryAddress && !this.avalancheFactoryAddress) {
      throw new Error(
        'Smart contract factories are not configured. Please configure ETHEREUM_FACTORY_ADDRESS and/or AVALANCHE_FACTORY_ADDRESS environment variables.'
      );
    }

    // Check if requested chains have factories configured
    const unavailableChains = chains.filter(chain => {
      if (chain === 'ethereum') return !this.ethereumFactoryAddress;
      if (chain === 'avalanche') return !this.avalancheFactoryAddress;
      return false;
    });

    if (unavailableChains.length === chains.length) {
      throw new Error(
        `None of the requested chains (${chains.join(', ')}) have factory contracts configured. ` +
        `Available: ${this.ethereumFactoryAddress ? 'ethereum' : ''}${this.avalancheFactoryAddress ? ' avalanche' : ''}`.trim()
      );
    }

    if (unavailableChains.length > 0) {
      this.logger.warn(`⚠️  Skipping deployment on unavailable chains: ${unavailableChains.join(', ')}`);
    }

    const result: EscrowDeploymentResult = {
      transactionHashes: {}
    };

    // Validate addresses
    if (!ethers.isAddress(companyWalletAddress)) {
      throw new BadRequestException(`Invalid company wallet address: ${companyWalletAddress}`);
    }
    if (!ethers.isAddress(masterWalletAddress)) {
      throw new BadRequestException(`Invalid master wallet address: ${masterWalletAddress}`);
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
          signer
        );

        this.logger.log(`🔑 Using wallet: ${signer.address} for Ethereum deployment`);

        // Check that factory is a contract on the chain
        const factoryCode = await signer.provider!.getCode(this.ethereumFactoryAddress);
        if (!factoryCode || factoryCode === '0x') {
          throw new Error(`No contract code found at Ethereum factory address ${this.ethereumFactoryAddress}`);
        }

        // Quick balance check to avoid estimateGas failure when empty wallets are used
        const signerBalance = await signer.provider!.getBalance(signer.address);
        if (signerBalance <= BigInt(0)) {
          throw new Error(`Signer ${signer.address} has zero balance on Ethereum; top up to pay transaction gas.`);
        }

        let tx;
        try {
          // Simulate the call to discover any revert reasons without submitting a transaction
          try {
            const data = factory.interface.encodeFunctionData('createEscrow', [
              companyWalletAddress,
              masterWalletAddress,
              targetAmountWei,
              durationInDays,
              campaignName || '',
              campaignDescription || ''
            ]);
            await signer.provider!.call({ to: this.ethereumFactoryAddress, data, from: signer.address });
          } catch (simErr: any) {
            this.logger.error(`❌ Simulation failed for Ethereum createEscrow: ${simErr?.message || simErr}`);
            throw simErr;
          }
          tx = await factory.createEscrow(
          companyWalletAddress,
          masterWalletAddress,
          targetAmountWei,
          durationInDays,
          campaignName || '',
          campaignDescription || ''
          );
        } catch (err: any) {
          this.logger.error(`❌ Error while creating Ethereum escrow: ${err?.message || err}`);
          if (err?.code === 'CALL_EXCEPTION') {
            throw new Error(`createEscrow reverted on Ethereum factory ${factory.address} for company ${companyWalletAddress}`);
          }
          throw err;
        }

        const receipt = await tx.wait();
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
          this.logger.log(`✅ Ethereum escrow deployed: ${result.ethereumAddress} (${event.args.campaignName || 'Unnamed'})`);
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
          signer
        );

        this.logger.log(`🔑 Using wallet: ${signer.address} for Avalanche deployment`);

        // Check that factory is a contract on the chain
        const avalancheFactoryCode = await signer.provider!.getCode(this.avalancheFactoryAddress);
        if (!avalancheFactoryCode || avalancheFactoryCode === '0x') {
          throw new Error(`No contract code found at Avalanche factory address ${this.avalancheFactoryAddress}`);
        }

        const signerBalanceAvax = await signer.provider!.getBalance(signer.address);
        if (signerBalanceAvax <= BigInt(0)) {
          throw new Error(`Signer ${signer.address} has zero balance on Avalanche; top up to pay transaction gas.`);
        }

        let tx;
        try {
          // Simulate the call to discover any revert reasons without submitting a transaction
          try {
            const data = factory.interface.encodeFunctionData('createEscrow', [
              companyWalletAddress,
              masterWalletAddress,
              targetAmountWei,
              durationInDays,
              campaignName || '',
              campaignDescription || ''
            ]);
            await signer.provider!.call({ to: this.avalancheFactoryAddress, data, from: signer.address });
          } catch (simErr: any) {
            this.logger.error(`❌ Simulation failed for Avalanche createEscrow: ${simErr?.message || simErr}`);
            throw simErr;
          }
          tx = await factory.createEscrow(
          companyWalletAddress,
          masterWalletAddress,
          targetAmountWei,
          durationInDays,
          campaignName || '',
          campaignDescription || ''
          );
        } catch (err: any) {
          this.logger.error(`❌ Error while creating Avalanche escrow: ${err?.message || err}`);
          if (err?.code === 'CALL_EXCEPTION') {
            throw new Error(`createEscrow reverted on Avalanche factory ${factory.address} for company ${companyWalletAddress}`);
          }
          throw err;
        }

        const receipt = await tx.wait();
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
          this.logger.log(`✅ Avalanche escrow deployed: ${result.avalancheAddress} (${event.args.campaignName || 'Unnamed'})`);
        }
      } catch (error) {
        this.logger.error('❌ Failed to deploy Avalanche escrow:', error);
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
      ethereum?: { estimatedGasWei: string; estimatedGasEth: string; estimatedGasUsd: string };
      avalanche?: { estimatedGasWei: string; estimatedGasEth: string; estimatedGasUsd: string };
    } = {};

    // Get current gas prices using fee data (supports EIP-1559 networks)
    const ethereumFeeData = chains.includes('ethereum') ? await this.ethereumProvider.getFeeData() : null;
    const avalancheFeeData = chains.includes('avalanche') ? await this.avalancheProvider.getFeeData() : null;
    // Prefer maxFeePerGas (EIP-1559), otherwise fall back to gasPrice or priority fee
    const ethereumGasPrice = ethereumFeeData ? (ethereumFeeData.maxFeePerGas ?? ethereumFeeData.gasPrice ?? ethereumFeeData.maxPriorityFeePerGas) : null;
    const avalancheGasPrice = avalancheFeeData ? (avalancheFeeData.maxFeePerGas ?? avalancheFeeData.gasPrice ?? avalancheFeeData.maxPriorityFeePerGas) : null;

    // Estimate Ethereum deployment
    if (chains.includes('ethereum') && this.ethereumFactoryAddress && ethereumGasPrice) {
      try {
        const signer = await this.createUserSigner(userId, 'ethereum');
        const factory = new ethers.Contract(
          this.ethereumFactoryAddress,
          ESCROW_FACTORY_ABI,
          signer
        );

        const targetAmountWei = ethers.parseEther(targetAmountEth.toString());

        // Estimate gas
        const estimatedGas = await factory.createEscrow.estimateGas(
          companyWalletAddress,
          signer.address, // masterWallet for fund forwarding
          targetAmountWei,
          durationInDays,
          campaignName || '',
          campaignDescription || ''
        );

        const gasCostWei = estimatedGas * ethereumGasPrice;
        const gasCostEth = ethers.formatEther(gasCostWei);

        gasEstimate.ethereum = {
          estimatedGasWei: estimatedGas.toString(),
          estimatedGasEth: gasCostEth,
          estimatedGasUsd: (parseFloat(gasCostEth) * 2500).toFixed(2), // Rough USD estimate (1 ETH ≈ $2500)
        };

        this.logger.log(`✅ Ethereum gas estimate: ${gasCostEth} ETH (~$${gasEstimate.ethereum.estimatedGasUsd})`);
      } catch (error: any) {
        this.logger.warn(`⚠️  Failed to estimate Ethereum gas: ${error?.message || error}`);
        try {
          const provider = await this.getWorkingEthereumProvider();
          const factory = new ethers.Contract(this.ethereumFactoryAddress, ESCROW_FACTORY_ABI, provider);
          const code = await provider.getCode(this.ethereumFactoryAddress);
          if (!code || code === '0x') {
            this.logger.warn(`⚠️  No contract code found at Ethereum factory address ${factory.address} during gas estimate`);
          }
        } catch (e) {
          this.logger.debug('Could not check factory code during gas estimate');
        }
        // Use conservative estimate if actual estimate fails
        gasEstimate.ethereum = {
          estimatedGasWei: '500000',
          estimatedGasEth: ethers.formatEther(BigInt(500000) * ethereumGasPrice!),
          estimatedGasUsd: '12.50', // Rough estimate
        };
      }
    }

    // Estimate Avalanche deployment
    if (chains.includes('avalanche') && this.avalancheFactoryAddress && avalancheGasPrice) {
      try {
        const signer = await this.createUserSigner(userId, 'avalanche');
        const factory = new ethers.Contract(
          this.avalancheFactoryAddress,
          ESCROW_FACTORY_ABI,
          signer
        );

        const targetAmountWei = ethers.parseEther(targetAmountEth.toString());

        // Estimate gas
        const estimatedGas = await factory.createEscrow.estimateGas(
          companyWalletAddress,
          signer.address, // masterWallet for fund forwarding
          targetAmountWei,
          durationInDays,
          campaignName || '',
          campaignDescription || ''
        );

        const gasCostWei = estimatedGas * avalancheGasPrice;
        const gasCostAvax = ethers.formatEther(gasCostWei);

        gasEstimate.avalanche = {
          estimatedGasWei: estimatedGas.toString(),
          estimatedGasEth: gasCostAvax,
          estimatedGasUsd: (parseFloat(gasCostAvax) * 80).toFixed(2), // Rough USD estimate (1 AVAX ≈ $80)
        };

        this.logger.log(`✅ Avalanche gas estimate: ${gasCostAvax} AVAX (~$${gasEstimate.avalanche.estimatedGasUsd})`);
      } catch (error: any) {
        this.logger.warn(`⚠️  Failed to estimate Avalanche gas: ${error?.message || error}`);
        try {
          const provider = await this.getWorkingAvalancheProvider();
          const factory = new ethers.Contract(this.avalancheFactoryAddress, ESCROW_FACTORY_ABI, provider);
          const code = await provider.getCode(this.avalancheFactoryAddress);
          if (!code || code === '0x') {
            this.logger.warn(`⚠️  No contract code found at Avalanche factory address ${factory.address} during gas estimate`);
          }
        } catch (e) {
          this.logger.debug('Could not check factory code during avalanche gas estimate');
        }
        // Use conservative estimate if actual estimate fails
        gasEstimate.avalanche = {
          estimatedGasWei: '500000',
          estimatedGasEth: ethers.formatEther(BigInt(500000) * avalancheGasPrice!),
          estimatedGasUsd: '4.00', // Rough estimate
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
    includeContributors: boolean = false
  ): Promise<CampaignStatus> {
    const provider = chain === 'ethereum' ? this.ethereumProvider : this.avalancheProvider;
    
    const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, provider);

    const [
      totalRaised,
      targetAmount,
      deadline,
      timeRemaining,
      isFinalized,
      isSuccessful,
      contributorCount
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
      status.contributors = await this.getContributors(escrowAddress, Number(contributorCount), chain);
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
    chain: 'ethereum' | 'avalanche' = 'ethereum'
  ): Promise<ContributorInfo[]> {
    const provider = chain === 'ethereum' ? this.ethereumProvider : this.avalancheProvider;
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
      where: { id: wishlistItemId }
    });

    if (!wishlistItem) {
      throw new Error('Wishlist item not found');
    }

    // Check Ethereum escrow if exists
    if (wishlistItem.ethereumEscrowAddress) {
      try {
        const status = await this.getCampaignStatus(
          wishlistItem.ethereumEscrowAddress,
          'ethereum'
        );

        await this.wishlistRepo.update(wishlistItemId, {
          amountRaised: parseFloat(status.totalRaised),
          isEscrowActive: status.isActive,
          isEscrowFinalized: status.isFinalized,
          isFulfilled: status.isSuccessful,
        });

        this.logger.log(`✅ Synced Ethereum escrow status for wishlist ${wishlistItemId}`);
      } catch (error) {
        this.logger.error(`❌ Failed to sync Ethereum escrow:`, error);
      }
    }

    // Check Avalanche escrow if exists
    if (wishlistItem.avalancheEscrowAddress) {
      try {
        const status = await this.getCampaignStatus(
          wishlistItem.avalancheEscrowAddress,
          'avalanche'
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

        this.logger.log(`✅ Synced Avalanche escrow status for wishlist ${wishlistItemId}`);
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
    chain: 'ethereum' | 'avalanche' = 'ethereum'
  ): Promise<string[]> {
    const provider = chain === 'ethereum' ? this.ethereumProvider : this.avalancheProvider;
    const factoryAddress = chain === 'ethereum' 
      ? this.ethereumFactoryAddress 
      : this.avalancheFactoryAddress;

    if (!factoryAddress) {
      throw new Error(`Factory address not configured for ${chain}`);
    }

    const factory = new ethers.Contract(factoryAddress, ESCROW_FACTORY_ABI, provider);
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
  getProvider(chain: 'ethereum' | 'avalanche'): ethers.JsonRpcProvider {
    return chain === 'ethereum' ? this.ethereumProvider : this.avalancheProvider;
  }

  /**
   * Send a transaction from user's wallet to recipient
   */
  async sendUserTransaction(
    userId: string,
    recipientAddress: string,
    chain: 'ethereum' | 'avalanche',
    amountEth: number,
  ): Promise<{ transactionHash: string; from: string; to: string; amount: string; explorerUrl: string }> {
    this.logger.log(`📤 Sending transaction from user ${userId} to ${recipientAddress} on ${chain}`);

    // Validate recipient address
    if (!ethers.isAddress(recipientAddress)) {
      throw new Error('Invalid recipient address');
    }

    // Validate amount
    if (amountEth <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    try {
      // Create signer from user's wallet
      const signer = await this.createUserSigner(userId, chain);
      const fromAddress = signer.address;

      this.logger.log(`🔑 Using wallet: ${fromAddress} for ${chain} transaction`);

      // Convert amount to Wei
      const amountWei = ethers.parseEther(amountEth.toString());

      // Get current gas price
      const provider = chain === 'ethereum' ? this.ethereumProvider : this.avalancheProvider;
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice;

      if (!gasPrice) {
        throw new Error('Could not retrieve gas price');
      }

      this.logger.log(`⛽ Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

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

      if (!receipt) {
        throw new Error('Transaction failed - no receipt received');
      }

      this.logger.log(`✅ Transaction confirmed: ${receipt.hash}`);

      // Determine explorer URL
      const explorerUrl = chain === 'ethereum'
        ? `https://sepolia.etherscan.io/tx/${receipt.hash}`
        : `https://testnet.snowtrace.io/tx/${receipt.hash}`;

      return {
        transactionHash: receipt.hash,
        from: fromAddress,
        to: recipientAddress,
        amount: amountEth.toString(),
        explorerUrl,
      };
    } catch (error: any) {
      this.logger.error(`❌ Transaction failed: ${error.message}`);
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }
}
