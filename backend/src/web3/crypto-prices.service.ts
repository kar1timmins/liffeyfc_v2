import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { ethers } from 'ethers';

// Chainlink Price Feed ABI (only the functions we need)
const PRICE_FEED_ABI = [
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() external view returns (uint8)'
];

@Injectable()
export class CryptoPricesService implements OnModuleInit {
  private readonly logger = new Logger(CryptoPricesService.name);
  private readonly CACHE_TTL = 300; // 5 minutes in seconds
  private readonly CACHE_KEY = 'crypto:prices:eur';
  private redis: Redis | null = null;

  // Chainlink Price Feed Addresses (Ethereum Mainnet)
  private readonly ETH_USD_FEED = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
  private readonly AVAX_USD_FEED = '0xFF3EEb22B5E3dE6e705b44749C2559d704923FD7';
  private readonly EUR_USD_FEED = '0xb49f677943BC038e9857d61E7d053CaA2C1734C1';
  
  // RPC endpoint for Ethereum mainnet (for Chainlink price feeds)
  private readonly mainnetRpc = 'https://eth.llamarpc.com'; // Free, reliable RPC

  constructor() {
    const url = process.env.REDIS_URL;
    if (url) {
      this.redis = new Redis(url);
    }
  }

  async onModuleInit() {
    if (!this.redis) {
      this.logger.warn('Redis not configured, will not cache crypto prices');
      return;
    }
    try {
      await this.redis.ping();
      this.logger.log('Connected to Redis for crypto price caching');
    } catch (err) {
      this.logger.warn('Failed to connect to Redis for price caching', String(err));
      this.redis = null;
    }
  }

  /**
   * Get cached crypto prices or fetch fresh data from Chainlink
   */
  async getPrices(): Promise<{ ethEur: number; avaxEur: number }> {
    try {
      // Try to get from cache first
      if (this.redis) {
        const cached = await this.redis.get(this.CACHE_KEY);
        if (cached) {
          this.logger.log('✅ Returning cached crypto prices');
          return JSON.parse(cached);
        }
        this.logger.log('No cached prices found, fetching from Chainlink...');
      } else {
        this.logger.warn('Redis not available, fetching fresh prices...');
      }

      // Fetch fresh data from Chainlink
      this.logger.log('🔗 Fetching fresh prices from Chainlink...');
      const prices = await this.fetchFromChainlink();

      // Cache for 5 minutes
      if (this.redis) {
        await this.redis.setex(this.CACHE_KEY, this.CACHE_TTL, JSON.stringify(prices));
        this.logger.log('💾 Cached prices for 5 minutes');
      }

      return prices;
    } catch (error) {
      this.logger.error('❌ Failed to get crypto prices:', error);
      this.logger.warn('⚠️  Returning fallback prices');
      
      // Return fallback prices if everything fails
      return {
        ethEur: 3200,
        avaxEur: 35
      };
    }
  }

  /**
   * Fetch prices from Chainlink price feeds
   */
  private async fetchFromChainlink(): Promise<{ ethEur: number; avaxEur: number }> {
    try {
      this.logger.log(`Connecting to Ethereum mainnet via ${this.mainnetRpc}...`);
      const provider = new ethers.JsonRpcProvider(this.mainnetRpc);

      // Test connection
      const blockNumber = await provider.getBlockNumber();
      this.logger.log(`Connected to mainnet, current block: ${blockNumber}`);

      // Get all three prices in parallel
      this.logger.log('Fetching prices from Chainlink feeds...');
      const [ethUsd, avaxUsd, eurUsd] = await Promise.all([
        this.getPriceFromFeed(provider, this.ETH_USD_FEED),
        this.getPriceFromFeed(provider, this.AVAX_USD_FEED),
        this.getPriceFromFeed(provider, this.EUR_USD_FEED),
      ]);

      this.logger.log(`Raw prices from Chainlink: ETH/USD=${ethUsd}, AVAX/USD=${avaxUsd}, EUR/USD=${eurUsd}`);

      // Convert to EUR (divide by EUR/USD rate)
      const ethEur = Math.round(ethUsd / eurUsd);
      const avaxEur = Math.round((avaxUsd / eurUsd) * 100) / 100;

      this.logger.log(`✅ Calculated EUR prices: ETH=${ethEur} EUR, AVAX=${avaxEur} EUR`);

      return { ethEur, avaxEur };
    } catch (error) {
      this.logger.error('❌ Failed to fetch from Chainlink:', error);
      this.logger.error('Error details:', error.message, error.stack);
      throw error;
    }
  }

  /**
   * Get price from a Chainlink price feed contract
   */
  private async getPriceFromFeed(provider: ethers.JsonRpcProvider, feedAddress: string): Promise<number> {
    try {
      this.logger.log(`Fetching price from feed: ${feedAddress}`);
      const priceFeed = new ethers.Contract(feedAddress, PRICE_FEED_ABI, provider);
      
      const [decimals, roundData] = await Promise.all([
        priceFeed.decimals(),
        priceFeed.latestRoundData()
      ]);

      this.logger.log(`Feed ${feedAddress}: decimals=${decimals}, answer=${roundData.answer.toString()}`);

      const price = Number(roundData.answer) / Math.pow(10, decimals);
      this.logger.log(`Calculated price: ${price}`);
      
      return price;
    } catch (error) {
      this.logger.error(`Failed to get price from feed ${feedAddress}:`, error);
      throw error;
    }
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  async clearCache(): Promise<void> {
    if (this.redis) {
      await this.redis.del(this.CACHE_KEY);
      this.logger.log('Crypto price cache cleared');
    }
  }

  /**
   * Test Chainlink connection without fallback - throws errors for diagnostics
   */
  async testChainlinkRaw(): Promise<{ ethEur: number; avaxEur: number; debug: any }> {
    const debug: any = {
      rpcUrl: this.mainnetRpc,
      feeds: {
        ethUsd: this.ETH_USD_FEED,
        avaxUsd: this.AVAX_USD_FEED,
        eurUsd: this.EUR_USD_FEED
      },
      steps: []
    };

    try {
      debug.steps.push('Creating provider...');
      const provider = new ethers.JsonRpcProvider(this.mainnetRpc);
      
      debug.steps.push('Getting block number...');
      const blockNumber = await provider.getBlockNumber();
      debug.blockNumber = blockNumber;
      debug.steps.push(`Connected! Block: ${blockNumber}`);

      debug.steps.push('Fetching ETH/USD...');
      const ethUsd = await this.getPriceFromFeed(provider, this.ETH_USD_FEED);
      debug.ethUsd = ethUsd;
      debug.steps.push(`ETH/USD: ${ethUsd}`);

      debug.steps.push('Fetching AVAX/USD...');
      const avaxUsd = await this.getPriceFromFeed(provider, this.AVAX_USD_FEED);
      debug.avaxUsd = avaxUsd;
      debug.steps.push(`AVAX/USD: ${avaxUsd}`);

      debug.steps.push('Fetching EUR/USD...');
      const eurUsd = await this.getPriceFromFeed(provider, this.EUR_USD_FEED);
      debug.eurUsd = eurUsd;
      debug.steps.push(`EUR/USD: ${eurUsd}`);

      const ethEur = Math.round(ethUsd / eurUsd);
      const avaxEur = Math.round((avaxUsd / eurUsd) * 100) / 100;
      
      debug.ethEur = ethEur;
      debug.avaxEur = avaxEur;
      debug.steps.push(`Final: ETH=${ethEur} EUR, AVAX=${avaxEur} EUR`);

      return { ethEur, avaxEur, debug };
    } catch (error) {
      debug.error = {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name
      };
      throw new Error(`Chainlink test failed: ${error.message}. Debug info: ${JSON.stringify(debug, null, 2)}`);
    }
  }
}
