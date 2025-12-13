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

  // RPC providers
  private ethereumProvider: ethers.JsonRpcProvider;
  private avalancheProvider: ethers.JsonRpcProvider;

  // RPC Endpoint fallbacks (same as escrow-contract.service)
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

  constructor() {
    const ethereumRpcUrl = process.env.ETHEREUM_RPC_URL || this.ethereumRPCEndpoints[0];
    const avalancheRpcUrl = process.env.AVALANCHE_RPC_URL || this.avalancheRPCEndpoints[0];

    this.ethereumProvider = new ethers.JsonRpcProvider(ethereumRpcUrl);
    this.avalancheProvider = new ethers.JsonRpcProvider(avalancheRpcUrl);

    this.logger.log(`📡 USDC Validator - Ethereum RPC: ${ethereumRpcUrl}`);
    this.logger.log(`📡 USDC Validator - Avalanche RPC: ${avalancheRpcUrl}`);
  }

  /**
   * Get working Ethereum provider with fallback
   */
  private async getWorkingEthereumProvider(): Promise<ethers.JsonRpcProvider> {
    try {
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
    recipientAddress: string
  ): Promise<{
    valid: boolean;
    amount: number;
    from: string;
    to: string;
    blockNumber: number;
    timestamp: Date;
  }> {
    this.logger.log(`🔍 Validating USDC payment: ${txHash} on ${chain}`);
    this.logger.log(`   Expected: ${expectedAmount} USDC to ${recipientAddress}`);

    try {
      // 1. Get provider for the chain
      const provider = chain === 'ethereum' 
        ? await this.getWorkingEthereumProvider()
        : await this.getWorkingAvalancheProvider();

      // 2. Get USDC contract address for the chain
      const usdcAddress = chain === 'ethereum' 
        ? this.USDC_SEPOLIA 
        : this.USDC_FUJI;

      // 3. Fetch transaction receipt
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new BadRequestException('Transaction not found or not yet confirmed');
      }

      this.logger.log(`✅ Transaction found - Block: ${receipt.blockNumber}, Status: ${receipt.status}`);

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
          `Transaction is not to USDC contract. Expected: ${usdcAddress}, Got: ${tx.to}`
        );
      }

      // 7. Decode USDC transfer event from logs
      const usdcInterface = new ethers.Interface([
        'event Transfer(address indexed from, address indexed to, uint256 value)'
      ]);

      let transferEvent: ethers.LogDescription | null = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === usdcAddress.toLowerCase()) {
          try {
            const parsed = usdcInterface.parseLog({
              topics: log.topics as string[],
              data: log.data
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
        throw new BadRequestException('No USDC Transfer event found in transaction');
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
          `USDC sent to wrong address. Expected: ${recipientAddress}, Got: ${to}`
        );
      }

      // 10. Convert amount (USDC has 6 decimals)
      const amountInUSDC = Number(ethers.formatUnits(value, 6));
      this.logger.log(`   Amount: ${amountInUSDC} USDC`);

      // 11. Validate amount (allow 1% slippage for rounding)
      const minAcceptable = expectedAmount * 0.99;
      if (amountInUSDC < minAcceptable) {
        throw new BadRequestException(
          `Insufficient payment: ${amountInUSDC} USDC < ${expectedAmount} USDC (required)`
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
    } catch (error) {
      this.logger.error(`❌ USDC validation failed: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to validate USDC payment: ${error.message}`);
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
   * Get platform's USDC receiver address for a chain
   */
  getPlatformUSDCAddress(chain: 'ethereum' | 'avalanche'): string {
    const ethAddress = process.env.USDC_RECEIVER_ETH;
    const avaxAddress = process.env.USDC_RECEIVER_AVAX;

    if (chain === 'ethereum') {
      if (!ethAddress) {
        throw new Error('USDC_RECEIVER_ETH not configured in environment variables');
      }
      return ethAddress;
    } else {
      if (!avaxAddress) {
        throw new Error('USDC_RECEIVER_AVAX not configured in environment variables');
      }
      return avaxAddress;
    }
  }
}
