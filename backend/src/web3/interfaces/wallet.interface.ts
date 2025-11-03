export interface WalletConnection {
  address: string;
  chainId: string;
  chainName: string;
  connectedAt: Date;
}

export interface WalletBalance {
  address: string;
  balance: string;
  formattedBalance: string;
  chainId: string;
}

export interface SignatureVerification {
  isValid: boolean;
  address: string;
  message: string;
}

export enum SupportedChain {
  ETHEREUM_MAINNET = '0x1',
  ETHEREUM_SEPOLIA = '0xaa36a7',
  AVALANCHE_MAINNET = '0xa86a',
  AVALANCHE_FUJI = '0xa869',
}

export interface ChainInfo {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}
