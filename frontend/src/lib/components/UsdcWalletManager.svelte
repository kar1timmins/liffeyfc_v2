<script lang="ts">
  import { AlertCircle, Copy, Trash2, Plus, Loader } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { authStore } from '$lib/stores/auth';
  import { toastStore } from '$lib/stores/toast';

  let { 
    usdcWallet = null,
    onUpdate = () => {}
  }: {
    usdcWallet: string | null;
    onUpdate?: () => void;
  } = $props();

  let isEditing = $state(false);
  let isLoading = $state(false);
  let walletAddress = $state(usdcWallet || '');
  let showRemoveConfirm = $state(false);

  async function handleSaveWallet() {
    if (!walletAddress.trim()) {
      toastStore.add({ message: 'Wallet address is required', type: 'error' });
      return;
    }

    // Basic validation for Ethereum/Avalanche address
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      toastStore.add({ 
        message: 'Invalid wallet address. Must be a valid Ethereum/Avalanche address (0x...)', 
        type: 'error' 
      });
      return;
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

  function copyToClipboard() {
    if (usdcWallet) {
      navigator.clipboard.writeText(usdcWallet);
      toastStore.add({ 
        message: '📋 Copied to clipboard', 
        type: 'success',
        ttl: 2000
      });
    }
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

    {#if !isEditing && usdcWallet}
      <div class="bg-base-200 rounded-lg p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs opacity-60 mb-1">Wallet Address</p>
            <p class="font-mono text-sm break-all">{usdcWallet}</p>
          </div>
          <button
            class="btn btn-ghost btn-sm"
            onclick={copyToClipboard}
            title="Copy address"
          >
            <Copy class="w-4 h-4" />
          </button>
        </div>
        
        <div class="flex gap-2">
          <button
            class="btn btn-sm btn-primary gap-2"
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
            <span class="label-text-alt text-xs opacity-60">0x...</span>
          </label>
          <input
            id="usdc-wallet-input"
            type="text"
            bind:value={walletAddress}
            placeholder="0x1234567890abcdef..."
            class="input input-bordered focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
          <p class="text-xs opacity-60 mt-1">
            Must be a valid Ethereum or Avalanche address format
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
        class="btn btn-primary btn-sm gap-2 w-full"
        onclick={() => isEditing = true}
        disabled={isLoading}
      >
        <Plus class="w-4 h-4" />
        Add USDC Wallet
      </button>
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
