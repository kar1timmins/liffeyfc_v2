import { writable, derived } from 'svelte/store';
import { API_BASE_URL } from '$lib/config';

export interface WalletState {
  address: string | null;
  chainId: string | null;
  chainName: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  balance: string | null;
  error: string | null;
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

const initialState: WalletState = {
  address: null,
  chainId: null,
  chainName: null,
  isConnected: false,
  isConnecting: false,
  balance: null,
  error: null,
};

// Create the wallet store
function createWalletStore() {
  const { subscribe, set, update } = writable<WalletState>(initialState);

  return {
    subscribe,
    connect: async () => {
      update(state => ({ ...state, isConnecting: true, error: null }));

      try {
        // Check if MetaMask is installed
        if (typeof window === 'undefined' || !(window as any).ethereum) {
          throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
        }

        const ethereum = (window as any).ethereum;

        // Request account access
        const accounts: string[] = await ethereum.request({
          method: 'eth_requestAccounts',
        });

        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts found. Please unlock your wallet.');
        }

        const address = accounts[0];

        // Get current chain ID
        const chainId: string = await ethereum.request({
          method: 'eth_chainId',
        });

        // Send connection info to backend
        const response = await fetch(`${API_BASE_URL}/web3/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ address, chainId }),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || 'Failed to connect wallet');
        }

        // Update store with connection info
        update(state => ({
          ...state,
          address: result.data.address,
          chainId: result.data.chainId,
          chainName: result.data.chainName,
          isConnected: true,
          isConnecting: false,
          error: null,
        }));

        // Fetch balance
        await walletStore.fetchBalance();

        // Setup event listeners
        setupEventListeners(ethereum);

        return result.data;
      } catch (error: any) {
        console.error('Error connecting wallet:', error);
        update(state => ({
          ...state,
          isConnecting: false,
          error: error.message || 'Failed to connect wallet',
        }));
        throw error;
      }
    },

    adoptWallet: async (address: string, chainId: string) => {
      update(state => ({ ...state, isConnecting: true, error: null }));

      try {
        // Send connection info to backend
        const response = await fetch(`${API_BASE_URL}/web3/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ address, chainId }),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || 'Failed to connect wallet');
        }

        // Update store with connection info
        update(state => ({
          ...state,
          address: result.data.address,
          chainId: result.data.chainId,
          chainName: result.data.chainName,
          isConnected: true,
          isConnecting: false,
          error: null,
        }));

        // Fetch balance
        await walletStore.fetchBalance();

        return result.data;
      } catch (error: any) {
        console.error('Error adopting wallet:', error);
        update(state => ({
          ...state,
          isConnecting: false,
          error: error.message || 'Failed to adopt wallet',
        }));
        throw error;
      }
    },

    disconnect: () => {
      set(initialState);
      localStorage.removeItem('walletConnected');
    },

    fetchBalance: async () => {
      let currentAddress: string | null = null;
      let currentChainId: string | null = null;

      // Get current state
      const unsubscribe = subscribe(state => {
        currentAddress = state.address;
        currentChainId = state.chainId;
      });
      unsubscribe();

      if (!currentAddress || !currentChainId) {
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/web3/balance/${currentAddress}?chainId=${currentChainId}`
        );
        const result = await response.json();

        if (result.success) {
          update(state => ({
            ...state,
            balance: result.data.formattedBalance,
          }));
        }
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    },

    switchChain: async (chainId: string) => {
      try {
        if (typeof window === 'undefined' || !(window as any).ethereum) {
          throw new Error('MetaMask is not installed');
        }

        const ethereum = (window as any).ethereum;

        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId }],
        });

        // Update chain info
        const response = await fetch(`${API_BASE_URL}/web3/chains/${chainId}`);
        const result = await response.json();

        if (result.success) {
          update(state => ({
            ...state,
            chainId,
            chainName: result.data.chainName,
          }));

          // Refresh balance
          await walletStore.fetchBalance();
        }
      } catch (error: any) {
        console.error('Error switching chain:', error);
        
        // If chain not added, try to add it
        if (error.code === 4902) {
          // You can implement addChain logic here
          throw new Error('Chain not added to MetaMask');
        }
        throw error;
      }
    },

    reset: () => set(initialState),
  };
}

function setupEventListeners(ethereum: any) {
  // Account changed
  ethereum.on('accountsChanged', (accounts: string[]) => {
    if (accounts.length === 0) {
      walletStore.disconnect();
    } else {
      walletStore.connect();
    }
  });

  // Chain changed
  ethereum.on('chainChanged', (chainId: string) => {
    // Reload to avoid inconsistencies
    window.location.reload();
  });

  // Disconnect
  ethereum.on('disconnect', () => {
    walletStore.disconnect();
  });
}

export const walletStore = createWalletStore();

// Derived stores
export const isConnected = derived(walletStore, $wallet => $wallet.isConnected);
export const walletAddress = derived(walletStore, $wallet => $wallet.address);
export const chainId = derived(walletStore, $wallet => $wallet.chainId);
export const formattedAddress = derived(walletStore, $wallet => {
  if (!$wallet.address) return '';
  return `${$wallet.address.slice(0, 6)}...${$wallet.address.slice(-4)}`;
});
