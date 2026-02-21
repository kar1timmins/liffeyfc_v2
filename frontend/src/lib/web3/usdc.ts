// USDC Token Integration for X402 Payments
// Provides utilities for USDC transfers and payment verification

import { ethers } from 'ethers';

// USDC Contract Addresses (Testnet)
export const USDC_CONTRACTS = {
  ethereum: {
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia USDC
    decimals: 6,
    symbol: 'USDC',
    chainId: 11155111, // Sepolia
    chainName: 'Ethereum Sepolia',
  },
  avalanche: {
    address: '0x5425890298aed601595a70AB815c96711a31Bc65', // Fuji USDC
    decimals: 6,
    symbol: 'USDC',
    chainId: 43113, // Fuji
    chainName: 'Avalanche Fuji',
  },
} as const;

// Minimal ERC20 ABI for USDC transfers
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

export interface USDCBalance {
  raw: string; // In smallest unit (6 decimals)
  formatted: string; // Human readable
  decimals: number;
}

export interface TransferResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Get user's USDC balance on specified chain
 */
export async function getUSDCBalance(
  chain: 'ethereum' | 'avalanche',
  userAddress: string
): Promise<USDCBalance> {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  const config = USDC_CONTRACTS[chain];
  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(config.address, ERC20_ABI, provider);

  try {
    const balance = await contract.balanceOf(userAddress);
    const decimals = await contract.decimals();

    return {
      raw: balance.toString(),
      formatted: ethers.formatUnits(balance, decimals),
      decimals: Number(decimals),
    };
  } catch (error: any) {
    console.error('Failed to get USDC balance:', error);
    throw new Error(`Failed to get USDC balance: ${error.message}`);
  }
}

/**
 * Transfer USDC to platform receiver address
 */
export async function transferUSDC(
  chain: 'ethereum' | 'avalanche',
  toAddress: string,
  amount: number // In USDC (e.g., 10.5 USDC)
): Promise<TransferResult> {
  if (!window.ethereum) {
    return { success: false, error: 'MetaMask not installed' };
  }

  const config = USDC_CONTRACTS[chain];
  
  try {
    // Switch to correct network first
    await switchToNetwork(chain);

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(config.address, ERC20_ABI, signer);

    // Convert amount to smallest unit (6 decimals for USDC)
    const amountInSmallestUnit = ethers.parseUnits(amount.toString(), config.decimals);

    console.log('📤 Transferring USDC:', {
      chain,
      to: toAddress,
      amount: amount,
      amountInSmallestUnit: amountInSmallestUnit.toString(),
    });

    // Execute transfer
    const tx = await contract.transfer(toAddress, amountInSmallestUnit);
    
    console.log('⏳ Waiting for transaction confirmation:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log('✅ Transfer successful:', tx.hash);
      return {
        success: true,
        txHash: tx.hash,
      };
    } else {
      return {
        success: false,
        error: 'Transaction failed',
      };
    }
  } catch (error: any) {
    console.error('❌ Transfer failed:', error);
    
    // User-friendly error messages
    if (error.code === 'ACTION_REJECTED') {
      return { success: false, error: 'Transaction rejected by user' };
    }
    
    if (error.message?.includes('insufficient funds')) {
      return { success: false, error: 'Insufficient USDC balance' };
    }

    return {
      success: false,
      error: error.message || 'Transfer failed',
    };
  }
}

/**
 * Switch MetaMask to correct network
 */
export async function switchToNetwork(chain: 'ethereum' | 'avalanche'): Promise<void> {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  const config = USDC_CONTRACTS[chain];
  const chainIdHex = '0x' + config.chainId.toString(16);

  try {
    // Try to switch to the chain
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError: any) {
    // Chain not added, try to add it
    if (switchError.code === 4902) {
      await addNetwork(chain);
    } else {
      throw switchError;
    }
  }
}

/**
 * Add network to MetaMask
 */
async function addNetwork(chain: 'ethereum' | 'avalanche'): Promise<void> {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  const networks = {
    ethereum: {
      chainId: '0xaa36a7', // 11155111 in hex
      chainName: 'Ethereum Sepolia Testnet',
      nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://sepolia.drpc.org'],
      blockExplorerUrls: ['https://sepolia.etherscan.io'],
    },
    avalanche: {
      chainId: '0xa869', // 43113 in hex
      chainName: 'Avalanche Fuji Testnet',
      nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
      rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
      blockExplorerUrls: ['https://testnet.snowtrace.io'],
    },
  };

  await window.ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [networks[chain]],
  });
}

/**
 * Format USDC amount for display (2 decimal places)
 */
export function formatUSDC(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toFixed(2);
}

/**
 * Get current network from MetaMask
 */
export async function getCurrentNetwork(): Promise<{ chainId: number; name: string } | null> {
  if (!window.ethereum) {
    return null;
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    
    // Map chainId to our chain names
    if (Number(network.chainId) === USDC_CONTRACTS.ethereum.chainId) {
      return { chainId: Number(network.chainId), name: 'ethereum' };
    } else if (Number(network.chainId) === USDC_CONTRACTS.avalanche.chainId) {
      return { chainId: Number(network.chainId), name: 'avalanche' };
    }
    
    return { chainId: Number(network.chainId), name: 'unknown' };
  } catch (error) {
    console.error('Failed to get network:', error);
    return null;
  }
}

/**
 * Verify transaction on blockchain (basic check)
 */
export async function verifyTransaction(
  chain: 'ethereum' | 'avalanche',
  txHash: string
): Promise<{ confirmed: boolean; blockNumber?: number }> {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  try {
    await switchToNetwork(chain);
    const provider = new ethers.BrowserProvider(window.ethereum);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return { confirmed: false };
    }

    return {
      confirmed: receipt.status === 1,
      blockNumber: receipt.blockNumber,
    };
  } catch (error: any) {
    console.error('Failed to verify transaction:', error);
    throw new Error(`Failed to verify transaction: ${error.message}`);
  }
}

/**
 * Listen for account changes in MetaMask
 */
export function onAccountsChanged(callback: (accounts: string[]) => void): () => void {
  if (!window.ethereum) {
    return () => {};
  }

  const handler = (accounts: string[]) => callback(accounts);
  window.ethereum.on('accountsChanged', handler);

  // Return cleanup function
  return () => {
    if (window.ethereum?.removeListener) {
      window.ethereum.removeListener('accountsChanged', handler);
    }
  };
}

/**
 * Listen for network changes in MetaMask
 */
export function onChainChanged(callback: (chainId: string) => void): () => void {
  if (!window.ethereum) {
    return () => {};
  }

  const handler = (chainId: string) => callback(chainId);
  window.ethereum.on('chainChanged', handler);

  // Return cleanup function
  return () => {
    if (window.ethereum?.removeListener) {
      window.ethereum.removeListener('chainChanged', handler);
    }
  };
}
