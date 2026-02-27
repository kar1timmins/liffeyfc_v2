import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Controller('wallet-balance')
export class WalletBalanceController {
  private readonly logger = new Logger(WalletBalanceController.name);
  private readonly sepoliaRpcEndpoints = [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://rpc-sepolia.rockx.com',
    'https://sepolia.drpc.org',
    'https://sepolia-rpc.nightlynode.com',
  ];
  private readonly fujiRpc = 'https://api.avax-test.network/ext/bc/C/rpc';

  @Get()
  async getBalance(
    @Query('address') address: string,
    @Query('chain') chain: string,
  ) {
    if (!address || !chain) {
      throw new HttpException(
        'Address and chain are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Basic validation depends on chain
    if (chain === 'ethereum' || chain === 'avalanche') {
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new HttpException(
          'Invalid Ethereum/Avalanche address format',
          HttpStatus.BAD_REQUEST,
        );
      }
    } else if (chain === 'solana') {
      // Solana base58 public keys are 32-44 chars
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
        throw new HttpException(
          'Invalid Solana address format',
          HttpStatus.BAD_REQUEST,
        );
      }
    } else if (chain === 'stellar') {
      if (!/^G[A-Z0-9]{55}$/.test(address)) {
        throw new HttpException(
          'Invalid Stellar address format',
          HttpStatus.BAD_REQUEST,
        );
      }
    } else if (chain === 'bitcoin') {
      // mainnet P2WPKH bech32 (bc1q...)
      if (!/^bc1[a-z0-9]{25,80}$/.test(address)) {
        throw new HttpException(
          'Invalid Bitcoin address format (expected mainnet bc1... address)',
          HttpStatus.BAD_REQUEST,
        );
      }
    } else {
      throw new HttpException(
        'Invalid chain specified',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      if (chain === 'ethereum') {
        return await this.getEthereumBalance(address);
      } else if (chain === 'avalanche') {
        return await this.getAvalancheBalance(address);
      } else if (chain === 'solana') {
        return await this.getSolanaBalance(address);
      } else if (chain === 'stellar') {
        return await this.getStellarBalance(address);
      } else if (chain === 'bitcoin') {
        return await this.getBitcoinBalance(address);
      }
      // unreachable
      throw new HttpException('Unsupported chain', HttpStatus.BAD_REQUEST);
    } catch (error) {
      console.error('Error fetching balance:', error);
      throw new HttpException(
        'Failed to fetch balance',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
            id: 1,
          }),
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
            rpcEndpoint: rpcUrl,
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
      HttpStatus.SERVICE_UNAVAILABLE,
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
          id: 1,
        }),
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
          rpcEndpoint: this.fujiRpc,
        };
      } else if (data.error) {
        throw new HttpException(
          `RPC error: ${data.error.message}`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    } catch (err) {
      console.error('Failed to fetch Avalanche balance:', err);
      throw new HttpException(
        'Failed to fetch Avalanche balance',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // --------------------------------------------------------------------
  // Solana / Stellar Balances
  // --------------------------------------------------------------------
  private readonly solanaRpc = 'https://api.devnet.solana.com';
  private readonly stellarHorizon = 'https://horizon-testnet.stellar.org';

  private async getSolanaBalance(address: string) {
    try {
      const response = await fetch(this.solanaRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address, { commitment: 'final' }],
        }),
      });
      const data = await response.json();
      const lamports = data.result?.value ?? 0;
      const balanceSol = Number(lamports) / 1e9;
      return {
        chain: 'solana',
        address,
        balanceLamports: lamports.toString(),
        balanceSol: balanceSol.toFixed(6),
      };
    } catch (err) {
      console.error('Failed to fetch Solana balance:', err);
      throw new HttpException(
        'Failed to fetch Solana balance',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async getStellarBalance(address: string) {
    try {
      const res = await fetch(`${this.stellarHorizon}/accounts/${address}`);
      // Horizon returns 404 for accounts that have never been funded; treat as zero balance
      if (res.status === 404) {
        return {
          chain: 'stellar',
          address,
          balanceXlm: '0.000000',
        };
      }
      if (!res.ok) {
        throw new Error(`Horizon returned ${res.status}`);
      }
      const data = await res.json();
      const native = (data.balances || []).find(
        (b: any) => b.asset_type === 'native',
      );
      const balanceXlm = native ? parseFloat(native.balance) : 0;
      return {
        chain: 'stellar',
        address,
        balanceXlm: balanceXlm.toFixed(6),
      };
    } catch (err) {
      console.error('Failed to fetch Stellar balance:', err);
      throw new HttpException(
        'Failed to fetch Stellar balance',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async getBitcoinBalance(address: string) {
    try {
      // addresses are mainnet bc1q (P2WPKH); use mainnet Blockstream API
      const resp = await fetch(
        `https://blockstream.info/api/address/${address}/utxo`,
      );
      if (!resp.ok) {
        throw new Error(`Blockstream returned ${resp.status}`);
      }
      const utxos: Array<{ value: number }> = await resp.json();
      const totalSats = utxos.reduce((sum, u) => sum + (u.value || 0), 0);
      const balanceBtc = totalSats / 1e8;
      return {
        chain: 'bitcoin',
        address,
        balanceBtc: balanceBtc.toFixed(8),
      };
    } catch (err) {
      console.error('Failed to fetch Bitcoin balance:', err);
      throw new HttpException(
        'Failed to fetch Bitcoin balance',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get('usdc')
  async getUsdcBalance(
    @Query('address') address: string,
    @Query('chain') chain: string,
  ) {
    if (!address || !chain) {
      throw new HttpException(
        'Address and chain are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const supportedChains = ['ethereum', 'avalanche', 'solana', 'stellar'];
    if (!supportedChains.includes(chain)) {
      throw new HttpException(
        'USDC balance is only available for ethereum, avalanche, solana, and stellar',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (chain === 'solana') {
      return await this.getSolanaUsdcBalance(address);
    }

    if (chain === 'stellar') {
      return await this.getStellarUsdcBalance(address);
    }

    // EVM chains (ethereum / avalanche)
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new HttpException(
        'Invalid EVM address format',
        HttpStatus.BAD_REQUEST,
      );
    }

    const usdcContracts: Record<string, string> = {
      ethereum: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
      avalanche: '0x5425890298aed601595a70AB815c96711a31Bc65', // Fuji
    };
    const contractAddress = usdcContracts[chain];

    // Encode balanceOf(address): selector 0x70a08231 + address padded to 32 bytes
    const paddedAddress = address.toLowerCase().replace('0x', '').padStart(64, '0');
    const callData = `0x70a08231${paddedAddress}`;

    const rpcEndpoints =
      chain === 'ethereum' ? this.sepoliaRpcEndpoints : [this.fujiRpc];
    let lastError: any;

    for (const rpcUrl of rpcEndpoints) {
      try {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{ to: contractAddress, data: callData }, 'latest'],
            id: 1,
          }),
        });
        const data = await response.json();
        if (data.result) {
          const rawBalance = BigInt(data.result);
          const balanceUsdc = Number(rawBalance) / 1e6;
          return {
            chain,
            address,
            contractAddress,
            balanceRaw: rawBalance.toString(),
            balanceUsdc: balanceUsdc.toFixed(2),
          };
        } else if (data.error) {
          lastError = data.error;
          continue;
        }
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    throw new HttpException(
      `Failed to fetch USDC balance: ${lastError?.message ?? 'Unknown error'}`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private async getSolanaUsdcBalance(address: string) {
    // Mainnet USDC SPL token mint (Circle)
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    try {
      const response = await fetch(this.solanaRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [
            address,
            { mint: USDC_MINT },
            { encoding: 'jsonParsed' },
          ],
        }),
      });
      const data = await response.json();
      const accounts: any[] = data.result?.value ?? [];
      let totalUsdc = 0;
      for (const account of accounts) {
        const uiAmount =
          account.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
        if (uiAmount) totalUsdc += Number(uiAmount);
      }
      return {
        chain: 'solana',
        address,
        balanceUsdc: totalUsdc.toFixed(2),
      };
    } catch (err) {
      console.error('Failed to fetch Solana USDC balance:', err);
      throw new HttpException(
        'Failed to fetch Solana USDC balance',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async getStellarUsdcBalance(address: string) {
    // Centre/Circle USDC on Stellar mainnet
    const USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
    try {
      const res = await fetch(`${this.stellarHorizon}/accounts/${address}`);
      if (!res.ok) {
        // Account not yet funded on Stellar – return zero balance gracefully
        if (res.status === 404) {
          return { chain: 'stellar', address, balanceUsdc: '0.00' };
        }
        throw new Error(`Horizon returned ${res.status}`);
      }
      const data = await res.json();
      const usdcEntry = (data.balances ?? []).find(
        (b: any) => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER,
      );
      const balanceUsdc = usdcEntry ? parseFloat(usdcEntry.balance) : 0;
      return {
        chain: 'stellar',
        address,
        balanceUsdc: balanceUsdc.toFixed(2),
      };
    } catch (err) {
      console.error('Failed to fetch Stellar USDC balance:', err);
      throw new HttpException(
        'Failed to fetch Stellar USDC balance',
        HttpStatus.SERVICE_UNAVAILABLE,
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
        throw new HttpException(
          'Invalid chain specified',
          HttpStatus.BAD_REQUEST,
        );
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
              id: 1,
            }),
          });

          if (!response.ok) {
            this.logger.warn(`RPC ${rpcUrl} returned ${response.status}`);
            continue;
          }

          const data = await response.json();
          this.logger.log(
            `Gas price response for ${chain}:`,
            JSON.stringify(data),
          );

          if (data.result) {
            const gasPriceWei = BigInt(data.result);
            // Compute Gwei with higher precision (6 decimals) to avoid rounding to 0 for low testnet prices
            const gasPriceGwei = Number(gasPriceWei) / 1e9;

            // Validate gas price is reasonable (not 0 or suspiciously low)
            if (gasPriceGwei < 0.001) {
              this.logger.warn(
                `Gas price too low (${gasPriceGwei} Gwei), trying next RPC...`,
              );
              continue;
            }

            const result = {
              chain,
              gasPriceWei: gasPriceWei.toString(),
              gasPriceGwei: gasPriceGwei.toFixed(6),
            };

            this.logger.log(
              `✅ Returning gas price for ${chain}:`,
              JSON.stringify(result),
            );
            return result;
          } else if (data.error) {
            this.logger.error(`RPC error for ${chain}:`, data.error);
            lastError = new Error(data.error.message);
            continue;
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.logger.warn(`RPC ${rpcUrl} failed:`, errorMessage);
          lastError = err;
          continue;
        }
      }

      // All RPCs failed, return reasonable fallback
      this.logger.warn(
        `All RPCs failed for ${chain}, using fallback gas price`,
      );
      const fallbackGwei = chain === 'ethereum' ? 20 : 25; // Reasonable testnet defaults
      const fallbackWei = BigInt(fallbackGwei * 1e9);

      return {
        chain,
        gasPriceWei: fallbackWei.toString(),
        gasPriceGwei: fallbackGwei.toFixed(6),
      };
    } catch (err) {
      this.logger.error(`Failed to fetch gas price for ${chain}:`, err);
      throw new HttpException(
        'Failed to fetch gas price',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
