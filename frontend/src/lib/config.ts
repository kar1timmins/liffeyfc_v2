// API Configuration
import { 
  PUBLIC_API_URL, 
  PUBLIC_APP_ENV, 
  PUBLIC_DEBUG_LOGS 
} from '$env/static/public';

export const API_BASE_URL = PUBLIC_API_URL || 'http://localhost:3000';

// Environment Configuration
export const APP_ENV = PUBLIC_APP_ENV || 'development';
export const IS_PRODUCTION = APP_ENV === 'production';
export const IS_DEVELOPMENT = APP_ENV === 'development';
export const DEBUG_ENABLED = PUBLIC_DEBUG_LOGS === '1';

// Environment Info (for debugging)
export const ENV_INFO = {
  APP_ENV,
  API_BASE_URL,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  DEBUG_ENABLED,
  NODE_ENV: typeof process !== 'undefined' ? process.env.NODE_ENV : 'unknown'
};

// Log environment info in development
if (IS_DEVELOPMENT && typeof console !== 'undefined') {
  console.log('🌍 Environment Info:', ENV_INFO);
}

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
