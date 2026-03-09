import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ethers } from 'ethers';

/**
 * Service to validate USDC payments on testnet blockchains
 * Ensures users have paid the required USDC before deploying contracts
 */
@Injectable()
export class USDCValidatorService {
  private readonly logger = new Logger(USDCValidatorService.name);

  // Testnet USDC contract addresses
  private readonly USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
  private readonly USDC_FUJI = '0x5425890298aed601595a70AB815c96711a31Bc65';

  // RPC providers (FallbackProvider distributes across all RPCs automatically)
  private ethereumProvider: ethers.AbstractProvider;
  private avalancheProvider: ethers.AbstractProvider;

  // RPC Endpoint fallbacks (same as escrow-contract.service)
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

  constructor() {
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

    this.logger.log(`📡 USDC Validator - Ethereum FallbackProvider: ${this.ethereumRPCEndpoints.length} Sepolia RPC(s) [staticNetwork]`);
    this.logger.log(`📡 USDC Validator - Avalanche FallbackProvider: ${this.avalancheRPCEndpoints.length} Fuji RPC(s) [staticNetwork]`);
  }

  /**
   * Returns the Ethereum FallbackProvider (handles retries/rotation internally).
   */
  private async getWorkingEthereumProvider(): Promise<ethers.AbstractProvider> {
    return this.ethereumProvider;
  }

  /**
   * Get working Avalanche provider with fallback
   */
  /**
   * Returns the Avalanche FallbackProvider (handles retries/rotation internally).
   */
  private async getWorkingAvalancheProvider(): Promise<ethers.AbstractProvider> {
    return this.avalancheProvider;
  }

  /**
   * Validate USDC payment on-chain
   * @param txHash Transaction hash of USDC payment
   * @param chain Chain where payment was made (ethereum or avalanche)
   * @param expectedAmount Expected amount in USDC (decimal number, e.g., 3.40)
   * @param recipientAddress Platform's USDC receiver address
   * @returns Validated payment details
   */
  async validateUSDCPayment(
    txHash: string,
    chain: 'ethereum' | 'avalanche',
    expectedAmount: number,
    recipientAddress: string,
  ): Promise<{
    valid: boolean;
    amount: number;
    from: string;
    to: string;
    blockNumber: number;
    timestamp: Date;
  }> {
    this.logger.log(`🔍 Validating USDC payment: ${txHash} on ${chain}`);
    this.logger.log(
      `   Expected: ${expectedAmount} USDC to ${recipientAddress}`,
    );

    try {
      // 1. Get provider for the chain
      const provider =
        chain === 'ethereum'
          ? await this.getWorkingEthereumProvider()
          : await this.getWorkingAvalancheProvider();

      // 2. Get USDC contract address for the chain
      const usdcAddress =
        chain === 'ethereum' ? this.USDC_SEPOLIA : this.USDC_FUJI;

      // 3. Fetch transaction receipt
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new BadRequestException(
          'Transaction not found or not yet confirmed',
        );
      }

      this.logger.log(
        `✅ Transaction found - Block: ${receipt.blockNumber}, Status: ${receipt.status}`,
      );

      // 4. Check transaction was successful
      if (receipt.status !== 1) {
        throw new BadRequestException('Transaction failed on-chain');
      }

      // 5. Get transaction details
      const tx = await provider.getTransaction(txHash);
      if (!tx) {
        throw new BadRequestException('Transaction details not found');
      }

      // 6. Verify it's a USDC contract interaction
      if (tx.to?.toLowerCase() !== usdcAddress.toLowerCase()) {
        throw new BadRequestException(
          `Transaction is not to USDC contract. Expected: ${usdcAddress}, Got: ${tx.to}`,
        );
      }

      // 7. Decode USDC transfer event from logs
      const usdcInterface = new ethers.Interface([
        'event Transfer(address indexed from, address indexed to, uint256 value)',
      ]);

      let transferEvent: ethers.LogDescription | null = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === usdcAddress.toLowerCase()) {
          try {
            const parsed = usdcInterface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
            if (parsed && parsed.name === 'Transfer') {
              transferEvent = parsed;
              break;
            }
          } catch (e) {
            // Not a Transfer event, continue
          }
        }
      }

      if (!transferEvent) {
        throw new BadRequestException(
          'No USDC Transfer event found in transaction',
        );
      }

      // 8. Extract transfer details
      const from = transferEvent.args[0] as string;
      const to = transferEvent.args[1] as string;
      const value = transferEvent.args[2] as bigint;

      this.logger.log(`📋 Transfer Details:`);
      this.logger.log(`   From: ${from}`);
      this.logger.log(`   To: ${to}`);
      this.logger.log(`   Value: ${value.toString()} (raw)`);

      // 9. Validate recipient
      if (to.toLowerCase() !== recipientAddress.toLowerCase()) {
        throw new BadRequestException(
          `USDC sent to wrong address. Expected: ${recipientAddress}, Got: ${to}`,
        );
      }

      // 10. Convert amount (USDC has 6 decimals)
      const amountInUSDC = Number(ethers.formatUnits(value, 6));
      this.logger.log(`   Amount: ${amountInUSDC} USDC`);

      // 11. Validate amount (allow 1% slippage for rounding)
      const minAcceptable = expectedAmount * 0.99;
      if (amountInUSDC < minAcceptable) {
        throw new BadRequestException(
          `Insufficient payment: ${amountInUSDC} USDC < ${expectedAmount} USDC (required)`,
        );
      }

      // 12. Get block timestamp
      const block = await provider.getBlock(receipt.blockNumber);
      const timestamp = block ? new Date(block.timestamp * 1000) : new Date();

      this.logger.log(`✅ Payment validated successfully`);
      this.logger.log(`   Amount: ${amountInUSDC} USDC`);
      this.logger.log(`   From: ${from}`);
      this.logger.log(`   Block: ${receipt.blockNumber}`);
      this.logger.log(`   Timestamp: ${timestamp.toISOString()}`);

      return {
        valid: true,
        amount: amountInUSDC,
        from,
        to,
        blockNumber: receipt.blockNumber,
        timestamp,
      };
    } catch (error: any) {
      this.logger.error(`❌ USDC validation failed: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to validate USDC payment: ${error.message}`,
      );
    }
  }

  /**
   * Check if transaction has already been used for payment
   * This should be called before validateUSDCPayment to prevent double-spending
   */
  async checkTransactionUsed(txHash: string): Promise<boolean> {
    // This will be implemented when we add the PaymentRepository
    // For now, return false
    return false;
  }

  /**
   * Get USDC contract address for a chain
   */
  getUSDCAddress(chain: 'ethereum' | 'avalanche'): string {
    return chain === 'ethereum' ? this.USDC_SEPOLIA : this.USDC_FUJI;
  }

  /**
   * Expose the configured FallbackProvider for a chain so other services
   * can build signers without duplicating RPC configuration.
   */
  getProvider(chain: 'ethereum' | 'avalanche'): ethers.AbstractProvider {
    return chain === 'ethereum' ? this.ethereumProvider : this.avalancheProvider;
  }

  /**
   * Get platform's USDC receiver address for a chain.
   * Reads USDC_RECEIVER_ETH / USDC_RECEIVER_AVAX env vars first.
   * Falls back to deriving the address from PLATFORM_ETH_PRIVATE_KEY /
   * PLATFORM_AVAX_PRIVATE_KEY so the system is self-healing even if the
   * dedicated receiver vars are not set.
   */
  getPlatformUSDCAddress(chain: 'ethereum' | 'avalanche'): string {
    if (chain === 'ethereum') {
      const explicit = process.env.USDC_RECEIVER_ETH;
      if (explicit?.trim()) return explicit.trim();
      const key = process.env.PLATFORM_ETH_PRIVATE_KEY;
      if (key?.trim()) {
        const normalized = key.trim().startsWith('0x') ? key.trim() : `0x${key.trim()}`;
        return new ethers.Wallet(normalized).address;
      }
      throw new Error('Platform ETH receiver address not configured. Set USDC_RECEIVER_ETH or PLATFORM_ETH_PRIVATE_KEY.');
    } else {
      const explicit = process.env.USDC_RECEIVER_AVAX;
      if (explicit?.trim()) return explicit.trim();
      // AVAX uses same key format as ETH; check dedicated key first then fall back to ETH key
      const key = process.env.PLATFORM_AVAX_PRIVATE_KEY || process.env.PLATFORM_ETH_PRIVATE_KEY;
      if (key?.trim()) {
        const normalized = key.trim().startsWith('0x') ? key.trim() : `0x${key.trim()}`;
        return new ethers.Wallet(normalized).address;
      }
      throw new Error('Platform AVAX receiver address not configured. Set USDC_RECEIVER_AVAX or PLATFORM_AVAX_PRIVATE_KEY.');
    }
  }
}
