import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ethers } from 'ethers';
import {
  WalletConnection,
  WalletBalance,
  SignatureVerification,
  SupportedChain,
  ChainInfo,
} from './interfaces/wallet.interface';
import { ConnectWalletDto, VerifySignatureDto } from './dto/connect-wallet.dto';

@Injectable()
export class Web3Service {
  private readonly chainConfigs: Map<string, ChainInfo>;
  private readonly providers: Map<string, ethers.JsonRpcProvider>;

  constructor() {
    this.chainConfigs = new Map();
    this.providers = new Map();
    this.initializeChains();
  }

  private initializeChains() {
    // Ethereum Mainnet
    this.chainConfigs.set(SupportedChain.ETHEREUM_MAINNET, {
      chainId: SupportedChain.ETHEREUM_MAINNET,
      chainName: 'Ethereum Mainnet',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrls: [
        'https://eth.llamarpc.com',
        'https://ethereum.publicnode.com',
      ],
      blockExplorerUrls: ['https://etherscan.io'],
    });

    // Ethereum Sepolia Testnet
    this.chainConfigs.set(SupportedChain.ETHEREUM_SEPOLIA, {
      chainId: SupportedChain.ETHEREUM_SEPOLIA,
      chainName: 'Ethereum Sepolia Testnet',
      nativeCurrency: {
        name: 'Sepolia Ether',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrls: ['https://rpc.sepolia.org', 'https://ethereum-sepolia.publicnode.com'],
      blockExplorerUrls: ['https://sepolia.etherscan.io'],
    });

    // Avalanche C-Chain Mainnet
    this.chainConfigs.set(SupportedChain.AVALANCHE_MAINNET, {
      chainId: SupportedChain.AVALANCHE_MAINNET,
      chainName: 'Avalanche C-Chain',
      nativeCurrency: {
        name: 'Avalanche',
        symbol: 'AVAX',
        decimals: 18,
      },
      rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
      blockExplorerUrls: ['https://snowtrace.io'],
    });

    // Avalanche Fuji Testnet
    this.chainConfigs.set(SupportedChain.AVALANCHE_FUJI, {
      chainId: SupportedChain.AVALANCHE_FUJI,
      chainName: 'Avalanche Fuji Testnet',
      nativeCurrency: {
        name: 'Avalanche',
        symbol: 'AVAX',
        decimals: 18,
      },
      rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
      blockExplorerUrls: ['https://testnet.snowtrace.io'],
    });

    // Initialize providers
    this.chainConfigs.forEach((config, chainId) => {
      const provider = new ethers.JsonRpcProvider(config.rpcUrls[0]);
      this.providers.set(chainId, provider);
    });
  }

  /**
   * Validate and connect a wallet
   */
  async connectWallet(dto: ConnectWalletDto): Promise<WalletConnection> {
    const { address, chainId } = dto;

    // Validate chain is supported
    if (!this.chainConfigs.has(chainId)) {
      throw new HttpException(
        `Chain ID ${chainId} is not supported`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate address format
    if (!ethers.isAddress(address)) {
      throw new HttpException(
        'Invalid Ethereum address',
        HttpStatus.BAD_REQUEST,
      );
    }

    const chainInfo = this.chainConfigs.get(chainId);
    
    if (!chainInfo) {
      throw new HttpException(
        `Chain configuration not found for ${chainId}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      address: ethers.getAddress(address), // Checksum format
      chainId,
      chainName: chainInfo.chainName,
      connectedAt: new Date(),
    };
  }

  /**
   * Get wallet balance
   */
  async getBalance(address: string, chainId: string): Promise<WalletBalance> {
    if (!ethers.isAddress(address)) {
      throw new HttpException(
        'Invalid Ethereum address',
        HttpStatus.BAD_REQUEST,
      );
    }

    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new HttpException(
        `Chain ID ${chainId} is not supported`,
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const checksumAddress = ethers.getAddress(address);
      const balance = await provider.getBalance(checksumAddress);
      const formattedBalance = ethers.formatEther(balance);

      return {
        address: checksumAddress,
        balance: balance.toString(),
        formattedBalance,
        chainId,
      };
    } catch (error) {
      console.error('Error fetching balance:', error);
      throw new HttpException(
        'Failed to fetch wallet balance',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Verify a signed message
   */
  async verifySignature(dto: VerifySignatureDto): Promise<SignatureVerification> {
    const { address, message, signature } = dto;

    try {
      // Recover the address from the signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      const isValid =
        recoveredAddress.toLowerCase() === address.toLowerCase();

      return {
        isValid,
        address: ethers.getAddress(address),
        message,
      };
    } catch (error) {
      console.error('Error verifying signature:', error);
      return {
        isValid: false,
        address,
        message,
      };
    }
  }

  /**
   * Generate a sign-in message for the user
   */
  generateSignInMessage(address: string): string {
    const timestamp = new Date().toISOString();
    const nonce = Math.floor(Math.random() * 1000000);

    return `Welcome to Liffey Founders Club!

Sign this message to verify your wallet ownership.

Wallet: ${address}
Timestamp: ${timestamp}
Nonce: ${nonce}

This request will not trigger a blockchain transaction or cost any gas fees.`;
  }

  /**
   * Get supported chains
   */
  getSupportedChains(): ChainInfo[] {
    return Array.from(this.chainConfigs.values());
  }

  /**
   * Get chain information
   */
  getChainInfo(chainId: string): ChainInfo | undefined {
    return this.chainConfigs.get(chainId);
  }

  /**
   * Validate if address is valid Ethereum address
   */
  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }
}
