<script lang="ts">
  import { AlertCircle, Copy, Trash2, Plus, Loader, ExternalLink } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { authStore } from '$lib/stores/auth';
  import { toastStore } from '$lib/stores/toast';

  let { 
    usdcWallet = null,
    masterWallet = null,
    onUpdate = () => {}
  }: {
    usdcWallet: string | null;
    masterWallet?: {
      ethAddress?: string;
      avaxAddress?: string;
      solanaAddress?: string | null;
      stellarAddress?: string | null;
      bitcoinAddress?: string | null;
    } | null;
    onUpdate?: () => void;
  } = $props();

  let isEditing = $state(false);
  let isLoading = $state(false);
  let walletAddress = $state(usdcWallet || '');

  // display wallet string (updates automatically with selected chain)
  let displayWallet = $state('');

  // update walletAddress and displayWallet when chain or props change
  $effect(() => {
    if (selectedChain === 'ethereum' || selectedChain === 'avalanche') {
      walletAddress = usdcWallet || '';
      displayWallet = usdcWallet || '';
    } else if (selectedChain === 'solana') {
      walletAddress = masterWallet?.solanaAddress || '';
      displayWallet = masterWallet?.solanaAddress || '';
    } else if (selectedChain === 'stellar') {
      walletAddress = masterWallet?.stellarAddress || '';
      displayWallet = masterWallet?.stellarAddress || '';
    } else {
      displayWallet = '';
    }
  });

  let showRemoveConfirm = $state(false);
  // allow selecting any of the wallet chains (balance only available for EVM)
  let selectedChain = $state<'ethereum' | 'avalanche' | 'solana' | 'stellar'>('ethereum');
  let balance = $state<string | null>(null);
  let isLoadingBalance = $state(false);

  async function handleSaveWallet() {
    // only allow editing for EVM networks
    if (selectedChain !== 'ethereum' && selectedChain !== 'avalanche') {
      toastStore.add({ message: 'Cannot set USDC wallet for this network', type: 'error' });
      return;
    }
    if (!walletAddress.trim()) {
      toastStore.add({ message: 'Wallet address is required', type: 'error' });
      return;
    }

    // Basic validation for Ethereum/Avalanche address formats only;
    // for other chains we accept any non-empty string (frontend can't verify).
    if (selectedChain === 'ethereum' || selectedChain === 'avalanche') {
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        toastStore.add({ 
          message: 'Invalid wallet address. Must be a valid Ethereum/Avalanche address (0x...)', 
          type: 'error' 
        });
        return;
      }
    } else {
      // for Solana/Stellar we simply display master wallet address and editing is disabled
      // no validation required here
    }

    isLoading = true;
    try {
      const response = await fetch(`${PUBLIC_API_URL}/users/usdc-wallet`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${$authStore.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ walletAddress: walletAddress.trim() })
      });

      const data = await response.json();

      if (data.success) {
        toastStore.add({ 
          message: '✅ USDC wallet address saved!', 
          type: 'success',
          ttl: 3000
        });
        isEditing = false;
        usdcWallet = data.data.usdcWalletAddress;
        // refresh auth store so user object is re-fetched with new wallet address
        authStore.verify();
        onUpdate();
      } else {
        toastStore.add({ 
          message: data.message || 'Failed to save wallet', 
          type: 'error' 
        });
      }
    } catch (err) {
      console.error('Error saving USDC wallet:', err);
      toastStore.add({ 
        message: 'Error saving USDC wallet', 
        type: 'error' 
      });
    } finally {
      isLoading = false;
    }
  }

  async function handleRemoveWallet() {
    isLoading = true;
    try {
      const response = await fetch(`${PUBLIC_API_URL}/users/usdc-wallet/remove`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${$authStore.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        toastStore.add({ 
          message: '✅ USDC wallet removed', 
          type: 'success',
          ttl: 3000
        });
        usdcWallet = null;
        walletAddress = '';
        showRemoveConfirm = false;
        onUpdate();
      } else {
        toastStore.add({ 
          message: data.message || 'Failed to remove wallet', 
          type: 'error' 
        });
      }
    } catch (err) {
      console.error('Error removing USDC wallet:', err);
      toastStore.add({ 
        message: 'Error removing USDC wallet', 
        type: 'error' 
      });
    } finally {
      isLoading = false;
    }
  }

  async function fetchBalance() {
    // determine address based on selected chain (usdcWallet for EVM, displayWallet otherwise)
    const addr = (selectedChain === 'ethereum' || selectedChain === 'avalanche')
      ? usdcWallet
      : displayWallet;
    if (!addr) return;

    isLoadingBalance = true;
    try {
      const response = await fetch(`${PUBLIC_API_URL}/wallet-balance?address=${addr}&chain=${selectedChain}`);
      const data = await response.json();

      if (data.balanceEth !== undefined) {
        balance = `${parseFloat(data.balanceEth).toFixed(4)} ${selectedChain === 'ethereum' ? 'ETH' : 'AVAX'}`;
      } else if (data.balanceAvax !== undefined) {
        balance = `${parseFloat(data.balanceAvax).toFixed(4)} AVAX`;
      } else if (data.balanceSol !== undefined) {
        balance = `${parseFloat(data.balanceSol).toFixed(4)} SOL`;
      } else if (data.balanceXlm !== undefined) {
        balance = `${parseFloat(data.balanceXlm).toFixed(4)} XLM`;
      } else {
        balance = 'Unable to fetch balance';
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
      balance = 'Error fetching balance';
    } finally {
      isLoadingBalance = false;
    }
  }

  function copyToClipboard() {
    if (displayWallet) {
      navigator.clipboard.writeText(displayWallet);
      toastStore.add({ 
        message: '📋 Copied to clipboard', 
        type: 'success',
        ttl: 2000
      });
    }
  }

  function getBlockExplorerUrl(address: string, chain: string) {
    if (chain === 'ethereum') {
      return `https://sepolia.etherscan.io/address/${address}`;
    } else if (chain === 'avalanche') {
      return `https://testnet.snowtrace.io/address/${address}`;
    } else if (chain === 'solana') {
      return `https://explorer.solana.com/address/${address}`;
    } else if (chain === 'stellar') {
      return `https://stellar.expert/explorer/public/account/${address}`;
    }
    return '#';
  }

  function getTestnetFaucetUrls(chain: string) {
    if (chain === 'ethereum') {
      return [
        { name: 'Sepolia Faucet', url: 'https://faucets.chain.link/sepolia' },
        { name: 'Alchemy Faucet', url: 'https://www.alchemy.com/faucets/ethereum-sepolia' },
        { name: 'QuickNode Faucet', url: 'https://faucet.quicknode.com/ethereum/sepolia' },
      ];
    } else if (chain === 'avalanche') {
      return [
        { name: 'Avalanche Faucet', url: 'https://faucets.avax.network/' },
        { name: 'QuickNode Faucet', url: 'https://faucet.quicknode.com/avalanche/fuji' },
      ];
    }
    return [];
  }
</script>

<div class="card bg-base-100 shadow-lg border border-base-300 mb-6">
  <div class="card-body">
    <h3 class="card-title text-lg flex items-center gap-2">
      💳 USDC Payment Wallet
    </h3>
    <p class="text-sm opacity-70 mb-4">
      Connect a wallet address to pay for contract deployments with testnet USDC
    </p>

    {#if !isEditing && displayWallet}
      <div class="bg-base-200 rounded-lg p-4 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs opacity-60 mb-1">Wallet Address</p>
            <p class="font-mono text-sm break-all">{displayWallet}</p>
          </div>
          <button
            class="btn btn-ghost btn-sm"
            onclick={copyToClipboard}
            title="Copy address"
          >
            <Copy class="w-4 h-4" />
          </button>
        </div>
        
        <!-- Chain Selection & Balance -->
        <div class="space-y-2">
          <div class="flex gap-2 items-center">
            <select 
              bind:value={selectedChain}
              class="select select-sm select-bordered flex-1"
              onchange={() => {
                balance = null;
                fetchBalance();
              }}
            >
              <option value="ethereum">🔷 Ethereum Sepolia</option>
              <option value="avalanche">🔺 Avalanche Fuji</option>
              <option value="solana">◎ Solana</option>
              <option value="stellar">✧ Stellar</option>
            </select>  
            <button
              class="btn btn-sm btn-outline gap-1"
              onclick={fetchBalance}
              disabled={isLoadingBalance}
            >
              {#if isLoadingBalance}
                <Loader class="w-4 h-4 animate-spin" />
              {/if}
              Refresh
            </button>
          </div>
          
          {#if balance !== null}
            <div class="bg-base-100 rounded p-3 border border-base-300">
              <p class="text-xs opacity-60">Balance</p>
              <p class="text-lg font-semibold">{balance}</p>
            </div>
          {/if}
        </div>

        <!-- Block Explorer Link -->
        <a 
          href={getBlockExplorerUrl(displayWallet, selectedChain)}
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-sm btn-outline gap-2 w-full"
        >
          <ExternalLink class="w-4 h-4" />
          View on Block Explorer
        </a>

        <!-- Testnet Faucet Links -->
        <div class="bg-info/10 border border-info rounded-lg p-3">
          <p class="text-xs font-semibold mb-2 text-info">Get Testnet Tokens</p>
          <div class="space-y-1">
            {#each getTestnetFaucetUrls(selectedChain) as faucet}
              <a 
                href={faucet.url}
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs link link-primary flex items-center gap-1 hover:underline"
              >
                {faucet.name}
                <ExternalLink class="w-3 h-3" />
              </a>
            {/each}
          </div>
          <p class="text-xs opacity-70 mt-2">
            Use these faucets to get free testnet {selectedChain === 'ethereum' ? 'Sepolia ETH' : 'Fuji AVAX'} tokens for gas fees
          </p>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-2">
          <button
            class="btn btn-sm btn-primary gap-2 flex-1"
            onclick={() => {
              isEditing = true;
              walletAddress = usdcWallet || '';
            }}
            disabled={isLoading}
          >
            <Plus class="w-4 h-4" />
            Change Address
          </button>
          <button
            class="btn btn-sm btn-error btn-outline gap-2"
            onclick={() => showRemoveConfirm = true}
            disabled={isLoading}
          >
            <Trash2 class="w-4 h-4" />
            Remove
          </button>
        </div>
      </div>
    {:else if isEditing}
      <div class="space-y-3">
        <div class="form-control">
          <label class="label" for="usdc-wallet-input">
            <span class="label-text text-sm">Enter wallet address</span>
            <span class="label-text-alt text-xs opacity-60">
              {selectedChain === 'ethereum' || selectedChain === 'avalanche'
                ? '0x...'
                : selectedChain === 'solana'
                  ? 'Solana public key'
                  : selectedChain === 'stellar'
                    ? 'G...'
                    : selectedChain === 'bitcoin'
                      ? 'bc1...' : ''}
            </span>
          </label>
          <input
            id="usdc-wallet-input"
            type="text"
            bind:value={walletAddress}
            placeholder={
              selectedChain === 'ethereum' || selectedChain === 'avalanche'
                ? '0x1234567890abcdef...'
                : selectedChain === 'solana'
                  ? 'Enter Solana address'
                  : selectedChain === 'stellar'
                    ? 'Enter Stellar address'
                    : selectedChain === 'bitcoin'
                      ? 'Enter Bitcoin address' : ''
            }
            class="input input-bordered focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
          <p class="text-xs opacity-60 mt-1">
            {selectedChain === 'ethereum' || selectedChain === 'avalanche'
              ? 'Must be a valid Ethereum or Avalanche address format'
              : 'Any valid address for the selected network'}
          </p>
        </div>

        <div class="flex gap-2">
          <button
            class="btn btn-primary btn-sm gap-2 flex-1"
            onclick={handleSaveWallet}
            disabled={isLoading || !walletAddress.trim()}
          >
            {#if isLoading}
              <span class="loading loading-spinner loading-xs"></span>
              Saving...
            {:else}
              Save Address
            {/if}
          </button>
          <button
            class="btn btn-ghost btn-sm"
            onclick={() => {
              isEditing = false;
              walletAddress = usdcWallet || '';
            }}
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </div>
    {:else}
      <div class="alert alert-info py-2 mb-4">
        <AlertCircle class="w-5 h-5" />
        <div class="text-sm">
          <p class="font-semibold">No USDC wallet connected</p>
          <p class="text-xs opacity-80">Add a wallet to pay for contract deployments</p>
        </div>
      </div>
      
      <button
        class="btn btn-primary btn-sm gap-2 w-full mb-4"
        onclick={() => isEditing = true}
        disabled={isLoading}
      >
        <Plus class="w-4 h-4" />
        Add USDC Wallet
      </button>

      <!-- Getting Started Info -->
      <div class="bg-warning/10 border border-warning rounded-lg p-3">
        <p class="text-xs font-semibold mb-3 text-warning">Getting Started with Testnet USDC</p>
        <div class="space-y-2 text-xs">
          <div>
            <p class="font-semibold mb-1">Step 1: Choose Your Network</p>
            <p class="opacity-70">We support Ethereum Sepolia and Avalanche Fuji testnets</p>
          </div>
          <div>
            <p class="font-semibold mb-1">Step 2: Get Test Tokens</p>
            <p class="opacity-70 mb-2">Visit a faucet to receive free testnet ETH or AVAX:</p>
            <div class="pl-2 space-y-1">
              <a href="https://faucets.chain.link/sepolia" target="_blank" rel="noopener noreferrer" class="text-primary link flex items-center gap-1 hover:underline text-xs">
                Ethereum Sepolia Faucet <ExternalLink class="w-3 h-3" />
              </a>
              <a href="https://faucets.avax.network/" target="_blank" rel="noopener noreferrer" class="text-primary link flex items-center gap-1 hover:underline text-xs">
                Avalanche Fuji Faucet <ExternalLink class="w-3 h-3" />
              </a>
            </div>
          </div>
          <div>
            <p class="font-semibold mb-1">Step 3: Add Your Wallet</p>
            <p class="opacity-70">Click "Add USDC Wallet" above to register your wallet address</p>
          </div>
        </div>
      </div>
    {/if}

    {#if showRemoveConfirm}
      <div class="alert alert-warning py-2 mt-4">
        <AlertCircle class="w-5 h-5" />
        <div class="flex-1">
          <p class="text-sm font-semibold">Remove USDC wallet?</p>
          <p class="text-xs opacity-80">You won't be able to pay with USDC until you add a new wallet</p>
        </div>
        <div class="flex gap-2">
          <button
            class="btn btn-error btn-xs gap-1"
            onclick={handleRemoveWallet}
            disabled={isLoading}
          >
            {#if isLoading}
              <span class="loading loading-spinner loading-xs"></span>
            {/if}
            Remove
          </button>
          <button
            class="btn btn-ghost btn-xs"
            onclick={() => showRemoveConfirm = false}
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
