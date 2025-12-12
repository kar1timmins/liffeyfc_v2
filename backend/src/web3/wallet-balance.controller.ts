import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';

@Controller('wallet-balance')
export class WalletBalanceController {
  private readonly sepoliaRpcEndpoints = [
    'https://rpc.sepolia.org',
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://rpc2.sepolia.org'
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
      const rpcUrl = chain === 'ethereum' 
        ? this.sepoliaRpcEndpoints[0] 
        : this.fujiRpc;

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

      const data = await response.json();

      if (data.result) {
        const gasPriceWei = BigInt(data.result);
        const gasPriceGwei = Number(gasPriceWei) / 1e9;
        
        return {
          chain,
          gasPriceWei: gasPriceWei.toString(),
          gasPriceGwei: gasPriceGwei.toFixed(2)
        };
      } else if (data.error) {
        throw new HttpException(
          `RPC error: ${data.error.message}`,
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
    } catch (err) {
      console.error('Failed to fetch gas price:', err);
      throw new HttpException(
        'Failed to fetch gas price',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}
