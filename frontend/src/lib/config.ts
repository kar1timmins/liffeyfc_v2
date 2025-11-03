// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Web3 Configuration
export const SUPPORTED_CHAINS = {
  ETHEREUM_MAINNET: '0x1',
  ETHEREUM_SEPOLIA: '0xaa36a7',
  AVALANCHE_MAINNET: '0xa86a',
  AVALANCHE_FUJI: '0xa869',
} as const;

export const CHAIN_NAMES: Record<string, string> = {
  '0x1': 'Ethereum Mainnet',
  '0xaa36a7': 'Ethereum Sepolia',
  '0xa86a': 'Avalanche C-Chain',
  '0xa869': 'Avalanche Fuji',
};

export const DEFAULT_CHAIN = SUPPORTED_CHAINS.ETHEREUM_MAINNET;
