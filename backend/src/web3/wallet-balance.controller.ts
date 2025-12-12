import { Controller, Get, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Controller('wallet-balance')
export class WalletBalanceController {
  private readonly logger = new Logger(WalletBalanceController.name);
  private readonly sepoliaRpcEndpoints = [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://rpc-sepolia.rockx.com',
    'https://sepolia.drpc.org',
    'https://sepolia-rpc.nightlynode.com'
  ];
  private readonly fujiRpc = 'https://api.avax-test.network/ext/bc/C/rpc';

  @Get()
  async getBalance(@Query('address') address: string, @Query('chain') chain: string) {
    if (!address || !chain) {
      throw new HttpException('Address and chain are required', HttpStatus.BAD_REQUEST);
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new HttpException('Invalid Ethereum address format', HttpStatus.BAD_REQUEST);
    }

    try {
      if (chain === 'ethereum') {
        return await this.getEthereumBalance(address);
      } else if (chain === 'avalanche') {
        return await this.getAvalancheBalance(address);
      } else {
        throw new HttpException('Invalid chain specified', HttpStatus.BAD_REQUEST);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
      throw new HttpException('Failed to fetch balance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async getEthereumBalance(address: string) {
    let lastError: any;

    for (const rpcUrl of this.sepoliaRpcEndpoints) {
      try {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getBalance',
            params: [address, 'latest'],
            id: 1
          })
        });

        const data = await response.json();

        if (data.result) {
          const balanceWei = BigInt(data.result);
          const balanceEth = Number(balanceWei) / 1e18;
          
          return {
            chain: 'ethereum',
            address,
            balanceWei: balanceWei.toString(),
            balanceEth: balanceEth.toFixed(6),
            rpcEndpoint: rpcUrl
          };
        } else if (data.error) {
          console.error(`RPC error from ${rpcUrl}:`, data.error);
          lastError = data.error;
          continue;
        }
      } catch (err) {
        console.error(`Failed to fetch from ${rpcUrl}:`, err);
        lastError = err;
        continue;
      }
    }

    throw new HttpException(
      `Failed to fetch Ethereum balance from all RPC endpoints: ${lastError?.message || 'Unknown error'}`,
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }

  private async getAvalancheBalance(address: string) {
    try {
      const response = await fetch(this.fujiRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [address, 'latest'],
          id: 1
        })
      });

      const data = await response.json();

      if (data.result) {
        const balanceWei = BigInt(data.result);
        const balanceAvax = Number(balanceWei) / 1e18;
        
        return {
          chain: 'avalanche',
          address,
          balanceWei: balanceWei.toString(),
          balanceAvax: balanceAvax.toFixed(6),
          rpcEndpoint: this.fujiRpc
        };
      } else if (data.error) {
        throw new HttpException(
          `RPC error: ${data.error.message}`,
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
    } catch (err) {
      console.error('Failed to fetch Avalanche balance:', err);
      throw new HttpException(
        'Failed to fetch Avalanche balance',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  @Get('gas-price')
  async getGasPrice(@Query('chain') chain: string) {
    if (!chain) {
      throw new HttpException('Chain is required', HttpStatus.BAD_REQUEST);
    }

    try {
      let rpcUrl: string;
      let rpcEndpoints: string[];
      
      if (chain === 'ethereum') {
        rpcEndpoints = this.sepoliaRpcEndpoints;
      } else if (chain === 'avalanche') {
        rpcEndpoints = [this.fujiRpc];
      } else {
        throw new HttpException('Invalid chain specified', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Fetching gas price for ${chain}...`);

      // Try each RPC endpoint
      let lastError: any;
      for (const rpcUrl of rpcEndpoints) {
        try {
          this.logger.log(`Trying RPC: ${rpcUrl}`);

          const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_gasPrice',
              params: [],
              id: 1
            })
          });

          if (!response.ok) {
            this.logger.warn(`RPC ${rpcUrl} returned ${response.status}`);
            continue;
          }

          const data = await response.json();
          this.logger.log(`Gas price response for ${chain}:`, JSON.stringify(data));

          if (data.result) {
            const gasPriceWei = BigInt(data.result);
            const gasPriceGwei = Number(gasPriceWei) / 1e9;
            
            // Validate gas price is reasonable (not 0 or suspiciously low)
            if (gasPriceGwei < 0.001) {
              this.logger.warn(`Gas price too low (${gasPriceGwei} Gwei), trying next RPC...`);
              continue;
            }
            
            const result = {
              chain,
              gasPriceWei: gasPriceWei.toString(),
              gasPriceGwei: gasPriceGwei.toFixed(2)
            };
            
            this.logger.log(`✅ Returning gas price for ${chain}:`, JSON.stringify(result));
            return result;
          } else if (data.error) {
            this.logger.error(`RPC error for ${chain}:`, data.error);
            lastError = new Error(data.error.message);
            continue;
          }
        } catch (err) {
          this.logger.warn(`RPC ${rpcUrl} failed:`, err.message);
          lastError = err;
          continue;
        }
      }

      // All RPCs failed, return reasonable fallback
      this.logger.warn(`All RPCs failed for ${chain}, using fallback gas price`);
      const fallbackGwei = chain === 'ethereum' ? 20 : 25; // Reasonable testnet defaults
      const fallbackWei = BigInt(fallbackGwei * 1e9);
      
      return {
        chain,
        gasPriceWei: fallbackWei.toString(),
        gasPriceGwei: fallbackGwei.toFixed(2)
      };
    } catch (err) {
      this.logger.error(`Failed to fetch gas price for ${chain}:`, err);
      throw new HttpException(
        'Failed to fetch gas price',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}
