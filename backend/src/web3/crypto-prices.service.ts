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
  
  // Multiple RPC endpoints for Ethereum mainnet (with fallbacks)
  private readonly mainnetRpcs = [
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://cloudflare-eth.com',
    'https://ethereum-rpc.publicnode.com'
  ];

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
   * Fetch prices from Chainlink price feeds with RPC fallback
   */
  private async fetchFromChainlink(): Promise<{ ethEur: number; avaxEur: number }> {
    let lastError: Error | undefined;
    
    // Try each RPC endpoint until one succeeds
    for (const rpcUrl of this.mainnetRpcs) {
      try {
        this.logger.log(`Trying RPC: ${rpcUrl}...`);
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // Test connection
        const blockNumber = await provider.getBlockNumber();
        this.logger.log(`✅ Connected to mainnet (block ${blockNumber}) via ${rpcUrl}`);

        // Get all three prices sequentially to avoid rate limiting
        this.logger.log('Fetching prices from Chainlink feeds...');
        const ethUsd = await this.getPriceFromFeed(provider, this.ETH_USD_FEED);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        
        const avaxUsd = await this.getPriceFromFeed(provider, this.AVAX_USD_FEED);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const eurUsd = await this.getPriceFromFeed(provider, this.EUR_USD_FEED);

        this.logger.log(`Raw prices: ETH/USD=${ethUsd}, AVAX/USD=${avaxUsd}, EUR/USD=${eurUsd}`);

        // Convert to EUR
        const ethEur = Math.round(ethUsd / eurUsd);
        const avaxEur = Math.round((avaxUsd / eurUsd) * 100) / 100;

        this.logger.log(`✅ Success! ETH=${ethEur} EUR, AVAX=${avaxEur} EUR`);
        return { ethEur, avaxEur };
        
      } catch (error) {
        this.logger.warn(`⚠️  RPC ${rpcUrl} failed: ${error.message}`);
        lastError = error;
        continue; // Try next RPC
      }
    }
    
    // All RPCs failed
    this.logger.error('❌ All RPC endpoints failed');
    throw lastError || new Error('All RPC endpoints failed');
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

      // Convert BigInt values to Number for calculation
      const decimalsNum = Number(decimals);
      const answerNum = Number(roundData.answer);
      const price = answerNum / Math.pow(10, decimalsNum);
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
  // ---------------------------------------------------------------------------
  // Non-EVM price helpers (SOL, XLM, BTC) via CoinGecko free API
  // ---------------------------------------------------------------------------

  private readonly COINGECKO_ID: Record<string, string> = {
    SOL: 'solana',
    XLM: 'stellar',
    BTC: 'bitcoin',
  };

  /** In-process cache for CoinGecko prices (symbol → { price, ts }) */
  private cgCache = new Map<string, { price: number; ts: number }>();
  private readonly CG_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Returns the EUR price for any supported symbol:
   * ETH and AVAX come from Chainlink; SOL, XLM, BTC come from CoinGecko.
   */
  async getPriceEur(symbol: string): Promise<number> {
    const s = symbol.toUpperCase();
    if (s === 'ETH' || s === 'AVAX') {
      const prices = await this.getPrices();
      return s === 'ETH' ? prices.ethEur : prices.avaxEur;
    }
    return this.fetchCoinGeckoEurPrice(s);
  }

  /** Convert an amount of any supported crypto to EUR. */
  async toEur(symbol: string, amount: number): Promise<number> {
    if (amount <= 0) return 0;
    const price = await this.getPriceEur(symbol);
    return amount * price;
  }

  private async fetchCoinGeckoEurPrice(symbol: string): Promise<number> {
    const cached = this.cgCache.get(symbol);
    if (cached && Date.now() - cached.ts < this.CG_TTL) return cached.price;

    const id = this.COINGECKO_ID[symbol];
    if (!id) return 0;

    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=eur`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const data: Record<string, { eur?: number }> = await res.json();
      const price = data[id]?.eur ?? 0;
      this.cgCache.set(symbol, { price, ts: Date.now() });
      this.logger.log(`💰 CoinGecko ${symbol}/EUR = ${price}`);
      return price;
    } catch (err) {
      this.logger.warn(`⚠️ CoinGecko ${symbol} fetch failed, using fallback`, String(err));
      const FALLBACK: Record<string, number> = { SOL: 150, XLM: 0.10, BTC: 80000 };
      return this.cgCache.get(symbol)?.price ?? (FALLBACK[symbol] ?? 0);
    }
  }

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
      rpcUrls: this.mainnetRpcs,
      feeds: {
        ethUsd: this.ETH_USD_FEED,
        avaxUsd: this.AVAX_USD_FEED,
        eurUsd: this.EUR_USD_FEED
      },
      rpcAttempts: []
    };

    let lastError: Error | undefined;
    
    for (const rpcUrl of this.mainnetRpcs) {
      const attempt: any = { rpcUrl, steps: [] };
      
      try {
        attempt.steps.push('Creating provider...');
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        attempt.steps.push('Getting block number...');
        const blockNumber = await provider.getBlockNumber();
        attempt.blockNumber = blockNumber;
        attempt.steps.push(`Connected! Block: ${blockNumber}`);

        attempt.steps.push('Fetching ETH/USD...');
        const ethUsd = await this.getPriceFromFeed(provider, this.ETH_USD_FEED);
        attempt.ethUsd = ethUsd;
        attempt.steps.push(`ETH/USD: ${ethUsd}`);
        await new Promise(resolve => setTimeout(resolve, 100));

        attempt.steps.push('Fetching AVAX/USD...');
        const avaxUsd = await this.getPriceFromFeed(provider, this.AVAX_USD_FEED);
        attempt.avaxUsd = avaxUsd;
        attempt.steps.push(`AVAX/USD: ${avaxUsd}`);
        await new Promise(resolve => setTimeout(resolve, 100));

        attempt.steps.push('Fetching EUR/USD...');
        const eurUsd = await this.getPriceFromFeed(provider, this.EUR_USD_FEED);
        attempt.eurUsd = eurUsd;
        attempt.steps.push(`EUR/USD: ${eurUsd}`);

        const ethEur = Math.round(ethUsd / eurUsd);
        const avaxEur = Math.round((avaxUsd / eurUsd) * 100) / 100;
        
        attempt.ethEur = ethEur;
        attempt.avaxEur = avaxEur;
        attempt.steps.push(`Final: ETH=${ethEur} EUR, AVAX=${avaxEur} EUR`);
        attempt.success = true;
        
        debug.rpcAttempts.push(attempt);
        debug.successfulRpc = rpcUrl;
        
        return { ethEur, avaxEur, debug };
        
      } catch (error) {
        attempt.error = {
          message: error.message,
          code: error.code,
          name: error.name
        };
        attempt.success = false;
        debug.rpcAttempts.push(attempt);
        lastError = error;
        continue;
      }
    }
    
    // All RPCs failed
    const errorMsg = lastError?.message || 'Unknown error';
    throw new Error(`All RPC endpoints failed. Last error: ${errorMsg}. Debug info: ${JSON.stringify(debug, null, 2)}`);
  }
}
