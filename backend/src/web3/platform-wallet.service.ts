import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

/**
 * Platform Wallet Service
 *
 * Manages platform-owned wallets for paying gas fees on contract deployments.
 * Users pay in USDC to the platform, then the platform deploys contracts using
 * its own wallets (which have ETH/AVAX for gas).
 *
 * Security Notes:
 * - Private keys stored in environment variables (PLATFORM_ETH_PRIVATE_KEY, PLATFORM_AVAX_PRIVATE_KEY)
 * - Keys should be encrypted at rest in production (use secrets management like AWS Secrets Manager)
 * - Keys should have minimal permissions (only deploy contracts, no admin functions)
 * - Monitor wallet balances to ensure sufficient gas funds
 */
@Injectable()
export class PlatformWalletService {
  private readonly logger = new Logger(PlatformWalletService.name);

  // Platform private keys (loaded from environment)
  private readonly ethereumPrivateKey: string;
  private readonly avalanchePrivateKey: string;

  // Platform wallet addresses (derived from private keys)
  private readonly ethereumAddress: string;
  private readonly avalancheAddress: string;

  // RPC Providers with fallbacks (FallbackProvider distributes across all RPCs automatically)
  private ethereumProvider: ethers.AbstractProvider;
  private avalancheProvider: ethers.AbstractProvider;

  // RPC Endpoint fallbacks
  private ethereumRPCEndpoints = [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://sepolia.drpc.org',
    'https://rpc.sepolia.org',
    'https://eth-sepolia.public.blastapi.io',
    'https://sepolia.gateway.tenderly.co',
    'https://1rpc.io/sepolia',
  ];

  private avalancheRPCEndpoints = [
    'https://api.avax-test.network/ext/bc/C/rpc',
    'https://avalanche-fuji-c-chain.publicnode.com',
    'https://avalanche-fuji.drpc.org',
  ];

  // Throttle timestamps to avoid repeated RPC warnings
  private lastEthereumRpcWarn: number = 0;
  private lastAvalancheRpcWarn: number = 0;

  constructor(private configService: ConfigService) {
    // Load platform private keys from environment
    const ethKey =
      this.configService.get<string>('PLATFORM_ETH_PRIVATE_KEY') || '';
    const avaxKey =
      this.configService.get<string>('PLATFORM_AVAX_PRIVATE_KEY') || '';

    // Normalize private keys (add 0x prefix if missing, as MetaMask exports without it)
    this.ethereumPrivateKey = this.normalizePrivateKey(ethKey);
    this.avalanchePrivateKey = this.normalizePrivateKey(avaxKey);

    // Validate that keys are configured
    if (!this.ethereumPrivateKey || !this.avalanchePrivateKey) {
      this.logger.warn(
        '⚠️  Platform wallet private keys not fully configured.',
      );
      this.logger.warn(
        '   Missing: ' +
          (!this.ethereumPrivateKey ? 'PLATFORM_ETH_PRIVATE_KEY ' : '') +
          (!this.avalanchePrivateKey ? 'PLATFORM_AVAX_PRIVATE_KEY' : ''),
      );
      this.logger.warn(
        '   X402 payment deployments will not work until keys are configured.',
      );
    }

    // Validate key formats (must be 64 hex characters with or without 0x prefix)
    if (
      this.ethereumPrivateKey &&
      !this.isValidPrivateKey(this.ethereumPrivateKey)
    ) {
      throw new Error(
        'PLATFORM_ETH_PRIVATE_KEY has invalid format (must be 64 hex characters)',
      );
    }
    if (
      this.avalanchePrivateKey &&
      !this.isValidPrivateKey(this.avalanchePrivateKey)
    ) {
      throw new Error(
        'PLATFORM_AVAX_PRIVATE_KEY has invalid format (must be 64 hex characters)',
      );
    }

    // Derive wallet addresses from private keys
    if (this.ethereumPrivateKey) {
      const ethWallet = new ethers.Wallet(this.ethereumPrivateKey);
      this.ethereumAddress = ethWallet.address;
      this.logger.log(`🔑 Platform Ethereum wallet: ${this.ethereumAddress}`);
    }

    if (this.avalanchePrivateKey) {
      const avaxWallet = new ethers.Wallet(this.avalanchePrivateKey);
      this.avalancheAddress = avaxWallet.address;
      this.logger.log(`🔑 Platform Avalanche wallet: ${this.avalancheAddress}`);
    }

    // Use testnet-specific RPC lists only (do NOT include ETHEREUM_RPC_URL which
    // may be a mainnet endpoint on a different chain ID).
    // staticNetwork skips per-call chain-ID polling for faster first requests.
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

    this.logger.log(`📡 Platform Ethereum FallbackProvider: ${this.ethereumRPCEndpoints.length} Sepolia RPC(s) [staticNetwork]`);
    this.logger.log(`📡 Platform Avalanche FallbackProvider: ${this.avalancheRPCEndpoints.length} Fuji RPC(s) [staticNetwork]`);
  }

  /**
   * Normalize private key format (add 0x prefix if missing)
   * MetaMask exports private keys without 0x, but ethers.js accepts both formats
   */
  private normalizePrivateKey(key: string): string {
    if (!key) return '';
    const trimmed = key.trim();
    return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  }

  /**
   * Validate private key format (must be 64 hex characters with or without 0x)
   */
  private isValidPrivateKey(key: string): boolean {
    // After normalization, should be 0x + 64 hex chars = 66 total
    return (
      key.startsWith('0x') &&
      key.length === 66 &&
      /^0x[0-9a-fA-F]{64}$/.test(key)
    );
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
   * Get platform signer for Ethereum
   */
  async getEthereumSigner(): Promise<ethers.Wallet> {
    if (!this.ethereumPrivateKey) {
      throw new Error(
        'Platform Ethereum wallet not configured (PLATFORM_ETH_PRIVATE_KEY missing)',
      );
    }

    const provider = await this.getWorkingEthereumProvider();
    return new ethers.Wallet(this.ethereumPrivateKey, provider as ethers.Provider);
  }

  /**
   * Get platform signer for Avalanche
   */
  async getAvalancheSigner(): Promise<ethers.Wallet> {
    if (!this.avalanchePrivateKey) {
      throw new Error(
        'Platform Avalanche wallet not configured (PLATFORM_AVAX_PRIVATE_KEY missing)',
      );
    }

    const provider = await this.getWorkingAvalancheProvider();
    return new ethers.Wallet(this.avalanchePrivateKey, provider as ethers.Provider);
  }

  /**
   * Get platform signer for specified chain
   */
  async getSigner(chain: 'ethereum' | 'avalanche'): Promise<ethers.Wallet> {
    if (chain === 'ethereum') {
      return this.getEthereumSigner();
    } else {
      return this.getAvalancheSigner();
    }
  }

  /**
   * Get platform wallet address for specified chain
   */
  getPlatformAddress(chain: 'ethereum' | 'avalanche'): string {
    if (chain === 'ethereum') {
      if (!this.ethereumAddress) {
        throw new Error('Platform Ethereum wallet not configured');
      }
      return this.ethereumAddress;
    } else {
      if (!this.avalancheAddress) {
        throw new Error('Platform Avalanche wallet not configured');
      }
      return this.avalancheAddress;
    }
  }

  /**
   * Get platform wallet balance on specified chain
   */
  async getPlatformBalance(chain: 'ethereum' | 'avalanche'): Promise<{
    balanceWei: string;
    balanceEth: string;
    address: string;
  }> {
    const signer = await this.getSigner(chain);
    const balance = await signer.provider!.getBalance(signer.address);

    return {
      balanceWei: balance.toString(),
      balanceEth: ethers.formatEther(balance),
      address: signer.address,
    };
  }

  /**
   * Estimate gas cost for a transaction
   */
  async estimateGasCost(
    chain: 'ethereum' | 'avalanche',
    to: string,
    data: string,
    value: bigint = 0n,
  ): Promise<{
    gasLimit: bigint;
    gasPrice: bigint;
    estimatedCostWei: bigint;
    estimatedCostEth: string;
  }> {
    const signer = await this.getSigner(chain);

    // Estimate gas limit
    const gasLimit = await signer.provider!.estimateGas({
      from: signer.address,
      to,
      data,
      value,
    });

    // Get current gas price (with 20% buffer for price fluctuations)
    const feeData = await signer.provider!.getFeeData();
    const gasPrice = feeData.gasPrice || 0n;
    const bufferedGasPrice = (gasPrice * 120n) / 100n; // 20% buffer

    // Calculate estimated cost
    const estimatedCostWei = gasLimit * bufferedGasPrice;

    return {
      gasLimit,
      gasPrice: bufferedGasPrice,
      estimatedCostWei,
      estimatedCostEth: ethers.formatEther(estimatedCostWei),
    };
  }

  /**
   * Check if platform wallet has sufficient balance for gas
   */
  async hasSufficientGas(
    chain: 'ethereum' | 'avalanche',
    requiredGasWei: bigint,
  ): Promise<boolean> {
    const balance = await this.getPlatformBalance(chain);
    return BigInt(balance.balanceWei) >= requiredGasWei;
  }

  /**
   * Send transaction using platform wallet
   */
  async sendTransaction(
    chain: 'ethereum' | 'avalanche',
    to: string,
    data: string,
    value: bigint = 0n,
  ): Promise<ethers.TransactionResponse> {
    const signer = await this.getSigner(chain);

    this.logger.log(`📤 Sending transaction on ${chain}`);
    this.logger.log(`   From: ${signer.address}`);
    this.logger.log(`   To: ${to}`);
    this.logger.log(
      `   Value: ${ethers.formatEther(value)} ${chain === 'ethereum' ? 'ETH' : 'AVAX'}`,
    );

    // Get current balance
    const balance = await signer.provider!.getBalance(signer.address);
    this.logger.log(
      `   Platform Balance: ${ethers.formatEther(balance)} ${chain === 'ethereum' ? 'ETH' : 'AVAX'}`,
    );

    // Estimate gas
    const gasEstimate = await this.estimateGasCost(chain, to, data, value);
    this.logger.log(
      `   Estimated Gas Cost: ${gasEstimate.estimatedCostEth} ${chain === 'ethereum' ? 'ETH' : 'AVAX'}`,
    );

    // Check sufficient balance
    if (balance < gasEstimate.estimatedCostWei + value) {
      throw new Error(
        `Insufficient platform wallet balance. ` +
          `Required: ${ethers.formatEther(gasEstimate.estimatedCostWei + value)} ${chain === 'ethereum' ? 'ETH' : 'AVAX'}, ` +
          `Available: ${ethers.formatEther(balance)} ${chain === 'ethereum' ? 'ETH' : 'AVAX'}`,
      );
    }

    // Send transaction
    const tx = await signer.sendTransaction({
      to,
      data,
      value,
      gasLimit: gasEstimate.gasLimit,
    });

    this.logger.log(`✅ Transaction sent: ${tx.hash}`);
    return tx;
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(
    chain: 'ethereum' | 'avalanche',
    txHash: string,
    confirmations: number = 1,
  ): Promise<ethers.TransactionReceipt | null> {
    const provider =
      chain === 'ethereum'
        ? await this.getWorkingEthereumProvider()
        : await this.getWorkingAvalancheProvider();

    this.logger.log(
      `⏳ Waiting for transaction ${txHash} (${confirmations} confirmations)...`,
    );

    const receipt = await provider.waitForTransaction(txHash, confirmations);

    if (receipt) {
      this.logger.log(`✅ Transaction confirmed: ${txHash}`);
      this.logger.log(`   Block: ${receipt.blockNumber}`);
      this.logger.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
      this.logger.log(
        `   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`,
      );
    }

    return receipt;
  }
}
