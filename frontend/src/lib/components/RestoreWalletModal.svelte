<script lang="ts">
  import { AlertCircle, Copy, Eye, EyeOff, Wallet, Lock, Check } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { authStore } from '$lib/stores/auth';
  import { toastStore } from '$lib/stores/toast';

  let { 
    isOpen = $bindable(false),
    onWalletRestored = () => {}
  }: {
    isOpen: boolean;
    onWalletRestored: () => void;
  } = $props();

  let input = $state('');
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);
  let restoredWallet = $state<any>(null);
  let showInput = $state(false);
  let step = $state<'input' | 'confirm' | 'success'>('input');
  let agreedToWarning = $state(false);

  const isMnemonic = $derived.by(() => {
    const trimmed = input.trim();
    const wordCount = trimmed.split(/\s+/).length;
    return (wordCount === 12 || wordCount === 24) && !trimmed.startsWith('0x');
  });

  const isPrivateKey = $derived.by(() => {
    const trimmed = input.trim();
    return trimmed.startsWith('0x') && trimmed.length === 66;
  });

  const isValidInput = $derived.by(() => {
    return input.trim().length > 0 && (isMnemonic || isPrivateKey);
  });

  const inputType = $derived.by(() => {
    if (isMnemonic) return 'mnemonic';
    if (isPrivateKey) return 'privateKey';
    return 'invalid';
  });

  async function handleRestore() {
    if (!isValidInput) {
      error = 'Please enter a valid mnemonic phrase or private key';
      return;
    }

    if (!agreedToWarning) {
      error = 'You must acknowledge the warning to proceed';
      return;
    }

    isSubmitting = true;
    error = null;

    try {
      const token = $authStore.accessToken;
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${PUBLIC_API_URL}/wallet/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ input: input.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to restore wallet');
      }

      restoredWallet = data.data;
      step = 'confirm';
    } catch (err: any) {
      error = err.message || 'Failed to restore wallet';
      toastStore.add({ message: error, type: 'error' });
    } finally {
      isSubmitting = false;
    }
  }

  async function confirmRestore() {
    step = 'success';
    toastStore.add({ message: '✅ Wallet restored successfully!', type: 'success' });
    
    setTimeout(() => {
      closeModal();
      onWalletRestored();
    }, 2000);
  }

  function closeModal() {
    isOpen = false;
    resetForm();
  }

  function resetForm() {
    input = '';
    error = null;
    restoredWallet = null;
    showInput = false;
    step = 'input';
    agreedToWarning = false;
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toastStore.add({ message: `${label} copied to clipboard`, type: 'success' });
  }
</script>

{#if isOpen}
  <div class="modal modal-open">
    <div class="modal-box max-w-2xl">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <Wallet class="w-6 h-6 text-primary" />
        <h2 class="text-2xl font-bold">Restore Wallet</h2>
      </div>

      {#if step === 'input'}
        <div class="space-y-6">
          <!-- Warning Alert -->
          <div class="alert alert-warning">
            <AlertCircle class="w-5 h-5" />
            <div class="text-sm">
              <strong>⚠️ Important:</strong> Only restore a wallet if you have previously generated one or have backed up your mnemonic/private key. Never use a wallet controlled by someone else.
            </div>
          </div>

          <!-- Input Type Info -->
          <div class="bg-base-200 rounded-lg p-4">
            <p class="text-sm font-semibold mb-2">You can restore using:</p>
            <ul class="text-xs space-y-2 opacity-80">
              <li>✓ <strong>12-word mnemonic phrase</strong> (most common)</li>
              <li>✓ <strong>24-word mnemonic phrase</strong> (for older wallets)</li>
              <li>✓ <strong>Private key</strong> (hex format starting with 0x)</li>
            </ul>
          </div>

          <!-- Input Field -->
          <div class="form-control">
            <label class="label" for="restore-input">
              <span class="label-text font-semibold">Mnemonic Phrase or Private Key</span>
              {#if isValidInput}
                <span class="badge badge-success badge-sm">
                  {inputType === 'mnemonic' ? '12/24 Word Mnemonic' : 'Private Key'}
                </span>
              {/if}
            </label>
            <div class="relative">
              <textarea
                id="restore-input"
                class="textarea textarea-bordered textarea-sm font-mono text-xs w-full"
                placeholder="Paste your mnemonic phrase or private key here..."
                bind:value={input}
                rows={4}
                class:textarea-error={error && input.length > 0 && !isValidInput}
              ></textarea>
            </div>
            {#if input.length > 0 && !isValidInput}
              <label class="label" for="restore-input">
                <span class="label-text-alt text-error">Invalid format. Please check your input.</span>
              </label>
            {/if}
          </div>

          <!-- Security Checkpoint -->
          <div class="bg-base-100 border-2 border-warning/30 rounded-lg p-4">
            <label class="label cursor-pointer gap-3">
              <input 
                type="checkbox" 
                class="checkbox checkbox-warning" 
                bind:checked={agreedToWarning}
              />
              <span class="label-text text-sm">
                ✓ I understand that this wallet will have full access to all funds and smart contracts. I have securely backed up my recovery phrase.
              </span>
            </label>
          </div>

          <!-- Private Key Specific Warning -->
          {#if inputType === 'privateKey'}
            <div class="alert alert-error border-2">
              <AlertCircle class="w-5 h-5" />
              <div class="text-sm space-y-2">
                <p class="font-bold">⚠️ CRITICAL: Private Key Restoration Limitation</p>
                <p>You are restoring from a <strong>private key only</strong>. This means:</p>
                <ul class="list-disc list-inside space-y-1 ml-2 text-xs">
                  <li><strong>✓ Good:</strong> Master wallet can always be restored</li>
                  <li><strong>✓ Safe:</strong> All bounty funds auto-forward to master wallet</li>
                  <li><strong>✗ Important:</strong> Child wallet addresses CANNOT be derived in the future</li>
                  <li><strong>✗ Action Required:</strong> After creating companies, save their wallet addresses (copy them to password manager or backup)</li>
                </ul>
                <p class="font-semibold mt-2">💡 Recommendation: Restore from your 24-word seed phrase instead for full recovery.</p>
              </div>
            </div>
          {/if}

          {#if error}
            <div class="alert alert-error">
              <AlertCircle class="w-5 h-5" />
              <span>{error}</span>
            </div>
          {/if}

          <!-- Action Buttons -->
          <div class="flex gap-3 pt-4">
            <button
              class="btn btn-ghost flex-1"
              onclick={closeModal}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              class="btn btn-primary flex-1"
              onclick={handleRestore}
              disabled={!isValidInput || !agreedToWarning || isSubmitting}
            >
              {#if isSubmitting}
                <span class="loading loading-spinner loading-sm"></span>
              {/if}
              Restore Wallet
            </button>
          </div>
        </div>

      {:else if step === 'confirm'}
        <div class="space-y-6">
          <!-- Restored Wallet Info -->
          <div class="bg-success/10 border-2 border-success/50 rounded-lg p-4">
            <div class="flex items-start gap-3">
              <Check class="w-6 h-6 text-success flex-shrink-0 mt-0.5" />
              <div>
                <p class="font-semibold text-success mb-2">Wallet Restored Successfully!</p>
                <p class="text-sm opacity-80">
                  Your wallet has been imported. All previously derived company wallets will regenerate with the same addresses.
                </p>
              </div>
            </div>
          </div>

          <!-- Wallet Details -->
          <div class="bg-base-200 rounded-lg p-4 space-y-3">
            <h3 class="font-semibold text-sm flex items-center gap-2">
              <Lock class="w-4 h-4" />
              Master Wallet Address
            </h3>
            
            <div class="bg-base-100 p-3 rounded font-mono text-sm break-all">
              {restoredWallet.address}
            </div>

            <button
              class="btn btn-ghost btn-sm w-full gap-2"
              onclick={() => copyToClipboard(restoredWallet.address, 'Address')}
            >
              <Copy class="w-4 h-4" />
              Copy Address
            </button>
          </div>

          <!-- Derivation Path Info -->
          <div class="bg-base-100 rounded-lg p-4 text-sm space-y-2">
            <p class="font-semibold">Derivation Details:</p>
            <div class="space-y-1 opacity-80 text-xs">
              <p>Path: <code class="bg-base-200 px-1 rounded">{restoredWallet.derivationPath}</code></p>
              <p>Ethereum Address: <code class="bg-base-200 px-1 rounded break-all">{restoredWallet.ethAddress}</code></p>
              <p>Avalanche Address: <code class="bg-base-200 px-1 rounded break-all">{restoredWallet.avaxAddress}</code></p>
            </div>
          </div>

          <!-- Info Box -->
          <div class="bg-info/10 border-l-4 border-info p-4 text-sm">
            <p class="font-semibold mb-2">📋 What happens next?</p>
            <ul class="space-y-1 text-xs opacity-80">
              <li>✓ Your wallet is now restored and encrypted</li>
              <li>✓ All company wallets will regenerate with original addresses</li>
              <li>✓ You can now create new companies or continue with existing ones</li>
            </ul>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-3 pt-4">
            <button
              class="btn btn-ghost flex-1"
              onclick={closeModal}
            >
              Close
            </button>
            <button
              class="btn btn-primary flex-1"
              onclick={confirmRestore}
            >
              Continue to Profile
            </button>
          </div>
        </div>

      {:else if step === 'success'}
        <div class="text-center py-8 space-y-4">
          <div class="flex justify-center">
            <div class="rounded-full bg-success/20 p-4">
              <Check class="w-12 h-12 text-success" />
            </div>
          </div>
          <h3 class="text-2xl font-bold">Wallet Restored!</h3>
          <p class="opacity-80">Redirecting you back to your profile...</p>
        </div>
      {/if}
    </div>

    <!-- Backdrop -->
    <div 
      class="modal-backdrop" 
      onclick={closeModal}
      onkeydown={(e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
          closeModal();
        }
      }}
      role="button"
      tabindex="0"
    ></div>
  </div>
{/if}

<style>
  .modal-open {
    display: flex;
  }
</style>
