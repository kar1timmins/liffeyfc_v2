<script lang="ts">
  import { walletStore } from '$lib/stores/walletStore';
  import { authStore } from '$lib/stores/auth';
  import { X, Wallet, Download, CheckCircle, AlertCircle, RefreshCw } from 'lucide-svelte';
  import { Wallet as EthersWallet } from 'ethers';
  import { PUBLIC_API_URL } from '$env/static/public';
  
  let { isOpen = $bindable(false) } = $props();
  
  let isGenerating = $state(false);
  let error = $state<string | null>(null);
  let generatedWallet = $state<{
    address: string;
    privateKey: string;
    mnemonic: string;
    chainName: string;
    symbol: string;
    chainId: string;
  } | null>(null);
  
  const generationChains = [
    {
      chainId: '0x1',
      chainName: 'Ethereum Mainnet',
      symbol: 'ETH',
      description: 'Securely generate an ETH wallet',
    },
    {
      chainId: '0xa86a',
      chainName: 'Avalanche C-Chain',
      symbol: 'AVAX',
      description: 'Native Avalanche C-Chain address',
    },
  ];

  let selectedChainId = $state(generationChains[0].chainId);

  async function generateWallet() {
    isGenerating = true;
    error = null;
    generatedWallet = null;

    try {
      const chain = generationChains.find(c => c.chainId === selectedChainId) || generationChains[0];
      
      // Create random wallet
      const wallet = EthersWallet.createRandom();
      
      generatedWallet = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic?.phrase || '',
        chainName: chain.chainName,
        symbol: chain.symbol,
        chainId: chain.chainId
      };
      
      // Automatically download keys
      downloadKeys();
      
      // Store wallet address in backend database
      await saveWalletToBackend(wallet.address, chain.chainId);
      
      // Adopt the wallet in the store
      await walletStore.adoptWallet(wallet.address, chain.chainId);
      
    } catch (err: any) {
      console.error('Wallet generation failed', err);
      error = err.message || 'Failed to generate wallet';
    } finally {
      isGenerating = false;
    }
  }

  async function saveWalletToBackend(address: string, chainId: string) {
    try {
      const token = $authStore.accessToken;
      if (!token) {
        console.warn('No access token available, wallet not saved to database');
        return;
      }

      const response = await fetch(`${PUBLIC_API_URL}/users/attach-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ address, chainId })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save wallet');
      }

      console.log('Wallet successfully saved to database');
    } catch (err: any) {
      console.error('Failed to save wallet to backend:', err);
      // Don't throw - wallet generation succeeded, just database save failed
      // User can still use the wallet
    }
  }

  function downloadKeys() {
    if (!generatedWallet) return;
    
    const content = `Liffey Founders Club Web Wallet - ${generatedWallet.chainName}
    
Address: ${generatedWallet.address}
Private Key: ${generatedWallet.privateKey}
Mnemonic: ${generatedWallet.mnemonic}

IMPORTANT: Store this file in a secure location. Do not share your private keys with anyone.
These keys give full access to your funds on the ${generatedWallet.chainName}.
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `liffeyfc-${generatedWallet.symbol.toLowerCase()}-keys.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
  
  function closeModal() {
    isOpen = false;
    // Reset state after closing (optional, maybe keep it if they want to see it again?)
    // For security, maybe better to clear sensitive data
    if (!isOpen) {
        setTimeout(() => {
            generatedWallet = null;
            error = null;
        }, 500);
    }
  }
  
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div 
    class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    onclick={handleBackdropClick}
    role="dialog"
    aria-modal="true"
    aria-labelledby="generate-wallet-title"
    tabindex="-1"
  >
    <div class="glass-subtle rounded-3xl p-6 md:p-8 max-w-md w-full mx-4 relative animate-fade-in border border-white/10">
      <!-- Close button -->
      <button
        class="absolute top-4 right-4 btn btn-ghost btn-sm btn-circle"
        onclick={closeModal}
        aria-label="Close modal"
      >
        <X class="w-5 h-5" />
      </button>
      
      <!-- Title -->
      <h2 id="generate-wallet-title" class="text-2xl font-bold mb-2 flex items-center gap-3">
        <Wallet class="w-7 h-7 text-primary" />
        Generate Wallet
      </h2>
      <p class="text-sm opacity-80 mb-6">Create a new secure wallet for Web3 access</p>
      
      {#if generatedWallet}
        <!-- Success State -->
        <div class="bg-success/10 border border-success/30 rounded-2xl p-5 mb-6">
          <div class="flex items-center gap-3 mb-3">
            <CheckCircle class="w-6 h-6 text-success" />
            <span class="font-bold text-success text-lg">Wallet Generated!</span>
          </div>
          <p class="text-sm opacity-90 mb-4">
            Your keys have been downloaded. Please keep them safe!
          </p>
          
          <div class="bg-base-300/50 rounded-xl p-3 mb-4">
            <div class="text-xs opacity-60 mb-1">Address</div>
            <div class="font-mono text-sm break-all">{generatedWallet.address}</div>
          </div>
          
          <button 
            class="btn btn-outline btn-sm w-full gap-2"
            onclick={downloadKeys}
          >
            <Download class="w-4 h-4" />
            Download Keys Again
          </button>
        </div>
        
        <button
          class="btn btn-primary w-full"
          onclick={closeModal}
        >
          Done
        </button>
      {:else}
        <!-- Generation Form -->
        <div class="space-y-4">
          <div class="form-control">
            <label class="label" for="chain-select">
              <span class="label-text">Select Blockchain</span>
            </label>
            <select 
              id="chain-select"
              class="select select-bordered w-full"
              bind:value={selectedChainId}
              disabled={isGenerating}
            >
              {#each generationChains as chain}
                <option value={chain.chainId}>{chain.chainName} ({chain.symbol})</option>
              {/each}
            </select>
          </div>
          
          <div class="alert alert-info text-xs">
            <AlertCircle class="w-4 h-4" />
            <span>A text file with your private keys will be downloaded automatically.</span>
          </div>
          
          <button
            class="btn btn-primary w-full btn-lg mt-2"
            onclick={generateWallet}
            disabled={isGenerating}
          >
            {#if isGenerating}
              <span class="loading loading-spinner"></span>
              Generating...
            {:else}
              <RefreshCw class="w-5 h-5 mr-2" />
              Generate Wallet
            {/if}
          </button>
        </div>
        
        {#if error}
          <div class="alert alert-error mt-4 text-sm">
            <AlertCircle class="w-4 h-4" />
            <span>{error}</span>
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .animate-fade-in {
    animation: fadeIn 0.2s ease-out;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
