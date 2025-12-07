import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { Company } from '../entities/company.entity';

// ABI for EscrowFactory contract
const ESCROW_FACTORY_ABI = [
  "function createEscrow(address _company, uint256 _targetAmount, uint256 _durationInDays) external returns (address)",
  "function getCompanyEscrows(address _company) external view returns (address[])",
  "function getEscrowDetails(address _escrow) external view returns (address company, uint256 totalRaised, uint256 targetAmount, uint256 deadline, bool isFinalized, bool isSuccessful)",
  "event EscrowCreated(address indexed escrowAddress, address indexed company, uint256 targetAmount, uint256 deadline, uint256 timestamp)"
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
}

@Injectable()
export class EscrowContractService {
  private readonly logger = new Logger(EscrowContractService.name);

  // RPC Providers
  private ethereumProvider: ethers.JsonRpcProvider;
  private avalancheProvider: ethers.JsonRpcProvider;

  // Signers (for deploying contracts)
  private ethereumSigner: ethers.Wallet | null = null;
  private avalancheSigner: ethers.Wallet | null = null;

  // Factory contract addresses
  private ethereumFactoryAddress: string;
  private avalancheFactoryAddress: string;

  constructor(
    @InjectRepository(WishlistItem)
    private wishlistRepo: Repository<WishlistItem>,
    @InjectRepository(Company)
    private companyRepo: Repository<Company>,
  ) {
    // Initialize providers
    this.ethereumProvider = new ethers.JsonRpcProvider(
      process.env.ETHEREUM_RPC_URL || 'http://localhost:8545'
    );
    this.avalancheProvider = new ethers.JsonRpcProvider(
      process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc'
    );

    // Initialize signers if private key is available
    const privateKey = process.env.WEB3_PRIVATE_KEY;
    if (privateKey) {
      this.ethereumSigner = new ethers.Wallet(privateKey, this.ethereumProvider);
      this.avalancheSigner = new ethers.Wallet(privateKey, this.avalancheProvider);
    }

    // Factory addresses from environment
    this.ethereumFactoryAddress = process.env.ETHEREUM_FACTORY_ADDRESS || '';
    this.avalancheFactoryAddress = process.env.AVALANCHE_FACTORY_ADDRESS || '';

    if (!this.ethereumFactoryAddress || !this.avalancheFactoryAddress) {
      this.logger.warn('⚠️  Factory contract addresses not configured. Escrow functionality will be limited.');
    }
  }

  /**
   * Deploy escrow contracts for a wishlist item
   */
  async deployEscrowContracts(
    wishlistItemId: string,
    companyWalletAddress: string,
    targetAmountEth: number,
    durationInDays: number,
    chains: ('ethereum' | 'avalanche')[] = ['ethereum', 'avalanche']
  ): Promise<EscrowDeploymentResult> {
    this.logger.log(`📝 Deploying escrow contracts for wishlist item: ${wishlistItemId}`);

    const result: EscrowDeploymentResult = {
      transactionHashes: {}
    };

    // Convert target amount to wei
    const targetAmountWei = ethers.parseEther(targetAmountEth.toString());

    // Deploy to Ethereum
    if (chains.includes('ethereum') && this.ethereumSigner && this.ethereumFactoryAddress) {
      try {
        const factory = new ethers.Contract(
          this.ethereumFactoryAddress,
          ESCROW_FACTORY_ABI,
          this.ethereumSigner
        );

        const tx = await factory.createEscrow(
          companyWalletAddress,
          targetAmountWei,
          durationInDays
        );

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
          this.logger.log(`✅ Ethereum escrow deployed: ${result.ethereumAddress}`);
        }
      } catch (error) {
        this.logger.error('❌ Failed to deploy Ethereum escrow:', error);
        throw error;
      }
    }

    // Deploy to Avalanche
    if (chains.includes('avalanche') && this.avalancheSigner && this.avalancheFactoryAddress) {
      try {
        const factory = new ethers.Contract(
          this.avalancheFactoryAddress,
          ESCROW_FACTORY_ABI,
          this.avalancheSigner
        );

        const tx = await factory.createEscrow(
          companyWalletAddress,
          targetAmountWei,
          durationInDays
        );

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
          this.logger.log(`✅ Avalanche escrow deployed: ${result.avalancheAddress}`);
        }
      } catch (error) {
        this.logger.error('❌ Failed to deploy Avalanche escrow:', error);
        throw error;
      }
    }

    // Update wishlist item with contract addresses
    await this.wishlistRepo.update(wishlistItemId, {
      ethereumEscrowAddress: result.ethereumAddress,
      avalancheEscrowAddress: result.avalancheAddress,
      campaignDurationDays: durationInDays,
      campaignDeadline: new Date(Date.now() + durationInDays * 24 * 60 * 60 * 1000),
      isEscrowActive: true,
    });

    return result;
  }

  /**
   * Get campaign status from blockchain
   */
  async getCampaignStatus(
    escrowAddress: string,
    chain: 'ethereum' | 'avalanche' = 'ethereum'
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

    return {
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
    return !!(
      this.ethereumFactoryAddress &&
      this.avalancheFactoryAddress &&
      this.ethereumSigner &&
      this.avalancheSigner
    );
  }

  /**
   * Get provider for reading blockchain data
   */
  getProvider(chain: 'ethereum' | 'avalanche'): ethers.JsonRpcProvider {
    return chain === 'ethereum' ? this.ethereumProvider : this.avalancheProvider;
  }
}
