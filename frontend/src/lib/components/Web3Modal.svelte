<script lang="ts">
  import { walletStore, formattedAddress } from '$lib/stores/walletStore';
  import { X, Wallet, CheckCircle, AlertCircle, ExternalLink } from 'lucide-svelte';
  
  let { isOpen = $bindable(false) } = $props();
  
  let isConnecting = $state(false);
  let error = $state<string | null>(null);
  
  async function connectMetaMask() {
    isConnecting = true;
    error = null;
    
    try {
      await walletStore.connect();
      // Close modal after successful connection
      setTimeout(() => {
        isOpen = false;
      }, 1500);
    } catch (err: any) {
      error = err.message || 'Failed to connect wallet';
      isConnecting = false;
    }
  }
  
  function closeModal() {
    if (!isConnecting) {
      isOpen = false;
      error = null;
    }
  }
  
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  }
  
  // Get MetaMask installation link based on browser
  function getMetaMaskLink() {
    const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    const isChrome = navigator.userAgent.toLowerCase().indexOf('chrome') > -1;
    
    if (isFirefox) {
      return 'https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/';
    } else if (isChrome) {
      return 'https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn';
    }
    return 'https://metamask.io/download/';
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
    aria-labelledby="wallet-modal-title"
    tabindex="-1"
  >
    <div class="glass-subtle rounded-3xl p-6 md:p-8 max-w-md w-full mx-4 relative animate-fade-in">
      <!-- Close button -->
      <button
        class="absolute top-4 right-4 btn btn-ghost btn-sm btn-circle"
        onclick={closeModal}
        aria-label="Close modal"
        disabled={isConnecting}
      >
        <X class="w-5 h-5" />
      </button>
      
      <!-- Title -->
      <h2 id="wallet-modal-title" class="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-3">
        <Wallet class="w-7 h-7 text-primary" />
        Connect Wallet
      </h2>
      <p class="text-sm opacity-80 mb-6">Connect your wallet to access Web3 features</p>
      
      {#if $walletStore.isConnected}
        <!-- Connected State -->
        <div class="bg-success/20 border border-success/40 rounded-2xl p-4 mb-4">
          <div class="flex items-center gap-3 mb-2">
            <CheckCircle class="w-5 h-5 text-success" />
            <span class="font-semibold text-success">Wallet Connected</span>
          </div>
          <div class="text-sm opacity-90">
            <p class="mb-1">
              <span class="opacity-70">Address:</span> 
              <span class="font-mono">{$formattedAddress}</span>
            </p>
            {#if $walletStore.chainName}
              <p class="mb-1">
                <span class="opacity-70">Network:</span> 
                <span>{$walletStore.chainName}</span>
              </p>
            {/if}
            {#if $walletStore.balance}
              <p>
                <span class="opacity-70">Balance:</span> 
                <span>{parseFloat($walletStore.balance).toFixed(4)} {$walletStore.chainId === '0xa86a' || $walletStore.chainId === '0xa869' ? 'AVAX' : 'ETH'}</span>
              </p>
            {/if}
          </div>
        </div>
        
        <button
          class="btn btn-outline w-full"
          onclick={() => walletStore.disconnect()}
        >
          Disconnect Wallet
        </button>
      {:else}
                <!-- Connect Options -->
        <div class="space-y-3">
          <!-- MetaMask -->
          <button
            class="btn btn-lg w-full glass-subtle hover:glass border-primary/30 hover:border-primary hover:scale-[1.02] transition-all"
            onclick={connectMetaMask}
            disabled={isConnecting}
          >
            <div class="flex items-center justify-between w-full">
              <div class="flex items-center gap-3">
                <img 
                  src="/img/logo/metamask-logo.svg" 
                  alt="MetaMask" 
                  class="w-8 h-8"
                  onerror={(e) => { const img = e.target as HTMLImageElement; img.style.display = 'none'; }}
                />
                <div class="text-left">
                  <div class="font-semibold">MetaMask</div>
                  <div class="text-xs opacity-70">Connect to MetaMask Wallet</div>
                </div>
              </div>
              {#if isConnecting}
                <span class="loading loading-spinner loading-sm"></span>
              {/if}
            </div>
          </button>
          
          <!-- Core Wallet (Coming Soon) -->
          <div class="btn btn-lg w-full glass-subtle opacity-50 cursor-not-allowed">
            <div class="flex items-center justify-between w-full">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                  <span class="text-white font-bold text-sm">C</span>
                </div>
                <div class="text-left">
                  <div class="font-semibold">Core Wallet</div>
                  <div class="text-xs opacity-70">Coming Soon - Avalanche</div>
                </div>
              </div>
              <span class="badge badge-sm">Soon</span>
            </div>
          </div>
        </div>
        
        <!-- Error Message -->
        
        <!-- Error Message -->
        {#if error}
          <div class="alert alert-error mt-4">
            <AlertCircle class="w-5 h-5" />
            <span class="text-sm">{error}</span>
          </div>
        {/if}
        
        <!-- Install MetaMask -->
        {#if typeof window !== 'undefined' && !(window as any).ethereum}
          <div class="mt-6 p-4 bg-warning/20 border border-warning/40 rounded-2xl">
            <p class="text-sm mb-3 opacity-90">
              MetaMask is not installed. Install MetaMask to connect your wallet.
            </p>
            <a
              href={getMetaMaskLink()}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-warning btn-sm w-full"
            >
              Install MetaMask
              <ExternalLink class="w-4 h-4" />
            </a>
          </div>
        {/if}
        
        <!-- Info -->
        <div class="mt-6 text-xs opacity-70 text-center">
          <p>By connecting your wallet, you agree to our Terms of Service.</p>
          <p class="mt-1">Your wallet address will be used for authentication.</p>
        </div>
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
