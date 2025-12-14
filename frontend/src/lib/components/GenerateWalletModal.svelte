<script lang="ts">
  import { onMount } from 'svelte';
  import { Download, Copy, AlertTriangle, Check, X, Wallet } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { authStore } from '$lib/stores/auth';

  let { 
    isOpen = $bindable(false),
    onWalletGenerated = () => {}
  }: { 
    isOpen: boolean;
    onWalletGenerated?: () => void;
  } = $props();

  let isGenerating = $state(false);
  let walletData = $state<any>(null);
  let copied = $state(false);
  let error = $state<string | null>(null);
  let hasAcknowledged = $state(false);
  let hasExistingWallet = $state(false);
  let isCheckingWallet = $state(false);

  onMount(async () => {
    await checkExistingWallet();
  });

  async function checkExistingWallet() {
    isCheckingWallet = true;
    try {
      const verified = await authStore.verify();
      if (!verified) return;

      const token = $authStore.accessToken;
      if (!token) return;

      const response = await fetch(`${PUBLIC_API_URL}/wallet/check`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        hasExistingWallet = result.data.hasWallet;
      }
    } catch (err) {
      console.error('Failed to check wallet:', err);
    } finally {
      isCheckingWallet = false;
    }
  }

  async function generateWallet() {
    isGenerating = true;
    error = null;

    try {
      // Verify authentication first
      const verified = await authStore.verify();
      if (!verified) {
        throw new Error('Please log in again to generate a wallet');
      }

      const token = $authStore.accessToken;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${PUBLIC_API_URL}/wallet/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        walletData = result.data;
        onWalletGenerated(walletData); // Notify parent component with generated data
      } else {
        error = result.message || 'Failed to generate wallet';
      }
    } catch (err: any) {
      error = err.message || 'An error occurred';
    } finally {
      isGenerating = false;
    }
  }

  function downloadWallet() {
    if (!walletData) return;

    const content = `LIFFEY FOUNDERS CLUB - MASTER WALLET
========================================

⚠️  CRITICAL WARNING ⚠️
${walletData.warning}

Generated: ${new Date(walletData.createdAt).toLocaleString()}

========================================
ETHEREUM ADDRESS:
${walletData.ethAddress}

AVALANCHE ADDRESS:
${walletData.avaxAddress}

========================================
RECOVERY PHRASE (12 Words):
${walletData.mnemonic}

========================================
PRIVATE KEY:
${walletData.privateKey}

========================================
DERIVATION PATH:
${walletData.derivationPath}

========================================
SECURITY REMINDERS:
- NEVER share your private key or recovery phrase with anyone
- Store this file in a secure, encrypted location
- Consider using a hardware wallet for maximum security
- Make multiple backups in different secure locations
- Delete this file from unsecured devices after backing up
========================================
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lfc-master-wallet-${walletData.ethAddress.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyMnemonic() {
    if (!walletData) return;
    navigator.clipboard.writeText(walletData.mnemonic);
    copied = true;
    setTimeout(() => copied = false, 2000);
  }

  function closeModal() {
    isOpen = false;
    walletData = null;
    error = null;
    hasAcknowledged = false;
  }
</script>

<dialog class="modal" class:modal-open={isOpen}>
  <div class="modal-box max-w-2xl max-h-[90vh] overflow-y-auto">
    <h3 class="font-bold text-2xl flex items-center gap-2 mb-4">
      <Wallet class="w-6 h-6 text-primary" />
      Generate Master Wallet
    </h3>

    {#if !walletData}
      <!-- Warning & Generation -->
      <div class="space-y-4">
        {#if isCheckingWallet}
          <div class="flex justify-center py-6">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        {:else if hasExistingWallet}
          <div class="alert alert-info">
            <AlertTriangle class="w-5 h-5 flex-shrink-0" />
            <div class="flex-1">
              <p class="font-semibold">Wallet Already Generated</p>
              <p class="text-sm mt-1">You have already generated a master wallet for your account. Each account can only have one master wallet for security reasons.</p>
            </div>
          </div>
        {:else}
          <div class="alert alert-warning">
            <AlertTriangle class="w-5 h-5 flex-shrink-0" />
            <div class="flex-1">
              <p class="font-semibold mb-3">Important Security Information</p>
              <ul class="text-sm space-y-2 list-none">
                <li class="flex items-start gap-2">
                  <span class="flex-shrink-0 text-lg">🔒</span>
                  <span class="break-words">You can only generate ONE master wallet<br class="hidden sm:inline"/> per account</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="flex-shrink-0 text-lg">👁️</span>
                  <span class="break-words">Your recovery phrase and private key<br class="hidden sm:inline"/> will be shown ONCE</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="flex-shrink-0 text-lg">💾</span>
                  <span class="break-words">You must download and securely store<br class="hidden sm:inline"/> this information</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="flex-shrink-0 text-lg">🚨</span>
                  <span class="break-words">Loss of this data means permanent loss<br class="hidden sm:inline"/> of access to funds</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="flex-shrink-0 text-lg">🏢</span>
                  <span class="break-words">Company wallets will be derived<br class="hidden sm:inline"/> from this master wallet</span>
                </li>
              </ul>
            </div>
          </div>
        {/if}

        {#if !hasExistingWallet}
          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-3">
              <input 
                type="checkbox" 
                class="checkbox checkbox-primary"
                bind:checked={hasAcknowledged}
                disabled={isCheckingWallet}
              />
              <span class="label-text break-words">
                I understand that I must securely store my wallet information<br class="hidden sm:inline"/> and that it cannot be recovered if lost.
              </span>
            </label>
          </div>
        {/if}

        {#if error}
          <div class="alert alert-error">
            <span>{error}</span>
          </div>
        {/if}

        <div class="modal-action">
          <button class="btn btn-ghost" onclick={closeModal}>
            {hasExistingWallet ? 'Close' : 'Cancel'}
          </button>
          {#if !hasExistingWallet}
            <button 
              class="btn btn-primary"
              disabled={!hasAcknowledged || isGenerating || isCheckingWallet}
              onclick={generateWallet}
            >
              {#if isGenerating}
                <span class="loading loading-spinner loading-sm"></span>
              {/if}
              Generate Wallet
            </button>
          {/if}
        </div>
      </div>
    {:else}
      <!-- Wallet Generated - Show Details -->
      <div class="space-y-4">
        <div class="alert alert-success">
          <Check class="w-5 h-5" />
          <span>Wallet generated successfully! Please download and store securely.</span>
        </div>

        <div class="alert alert-error">
          <AlertTriangle class="w-5 h-5" />
          <div>
            <p class="font-semibold">⚠️ CRITICAL: This information will only be shown once!</p>
            <p class="text-sm mt-1">Download your wallet file immediately. You will not be able to access this information again.</p>
          </div>
        </div>

        <!-- Addresses -->
        <div class="space-y-2">
          <h4 class="font-semibold">Your Wallet Addresses:</h4>
          <div class="bg-base-200 p-3 rounded">
            <p class="text-xs opacity-70 mb-1">Ethereum (ETH)</p>
            <div class="flex items-center justify-between">
              <code class="text-sm break-all">{walletData.ethAddress}</code>
              <button class="btn btn-ghost btn-xs" onclick={() => { navigator.clipboard.writeText(walletData.ethAddress); }} title="Copy">
                <Copy class="w-4 h-4" />
              </button>
            </div>
          </div>
          <div class="bg-base-200 p-3 rounded">
            <p class="text-xs opacity-70 mb-1">Avalanche (AVAX)</p>
            <div class="flex items-center justify-between">
              <code class="text-sm break-all">{walletData.avaxAddress}</code>
              <button class="btn btn-ghost btn-xs" onclick={() => { navigator.clipboard.writeText(walletData.avaxAddress); }} title="Copy">
                <Copy class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- USDC Wallet Hint -->
          <div class="alert alert-success mt-3">
            <div class="flex-1">
              <p class="font-semibold">Your USDC wallet has been set</p>
              <p class="text-sm">Your USDC payment address has been set to your new Ethereum address: <code class="font-mono">{walletData.ethAddress}</code></p>
            </div>
            <div class="flex flex-col gap-2">
              <button class="btn btn-ghost btn-xs" onclick={() => { navigator.clipboard.writeText(walletData.ethAddress); }} title="Copy">
                <Copy class="w-4 h-4" />
              </button>
              <a class="btn btn-sm btn-outline" href="/profile#usdc" onclick={() => { /* no-op, same page */ }}>
                Manage USDC
              </a>
            </div>
          </div>
        </div>

        <!-- Recovery Phrase -->
        <div class="space-y-2">
          <h4 class="font-semibold">Recovery Phrase (12 Words):</h4>
          <p class="text-xs text-base-content/70">Save this phrase. It's the ONLY way to recover your wallet and all derived company wallets.</p>
          <div class="bg-base-200 p-4 rounded relative">
            <div class="grid grid-cols-3 gap-2 mb-3">
              {#each walletData.mnemonic.split(' ') as word, i}
                <div class="badge badge-lg badge-outline">
                  <span class="text-xs opacity-50 mr-1">{i + 1}.</span>
                  {word}
                </div>
              {/each}
            </div>
            <button
              class="btn btn-xs btn-ghost absolute top-2 right-2"
              onclick={copyMnemonic}
            >
              {#if copied}
                <Check class="w-3 h-3" />
              {:else}
                <Copy class="w-3 h-3" />
              {/if}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <!-- Download Button -->
        <div class="card bg-primary text-primary-content">
          <div class="card-body">
            <h5 class="card-title text-sm">Download Your Wallet</h5>
            <p class="text-xs opacity-90">
              Click below to download a text file containing all your wallet information.
              Store this file in a secure, encrypted location.
            </p>
            <button class="btn btn-sm btn-neutral" onclick={downloadWallet}>
              <Download class="w-4 h-4" />
              Download Wallet File
            </button>
          </div>
        </div>

        <!-- Child Wallet Derivation Info -->
        <div class="alert alert-info">
          <AlertTriangle class="w-5 h-5" />
          <div class="text-sm space-y-2">
            <p class="font-semibold">✅ Child Wallet Derivation Enabled</p>
            <p>You can now create multiple companies. Each company gets a unique child wallet address derived from your recovery phrase.</p>
            <ul class="list-disc list-inside space-y-1 text-xs">
              <li><strong>Each company = unique wallet</strong> (Company A: 0x1234..., Company B: 0x5678...)</li>
              <li><strong>Deterministic derivation:</strong> Same addresses if wallet is restored from this phrase</li>
              <li><strong>All funds forward to master wallet</strong> when bounties complete (secure!)</li>
              <li><strong>Important:</strong> Keep your recovery phrase safe - losing it means losing ability to recover all wallets</li>
            </ul>
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-primary" onclick={closeModal}>
            I've Downloaded My Wallet
          </button>
        </div>
      </div>
    {/if}
  </div>
  <form method="dialog" class="modal-backdrop">
    <button onclick={closeModal}>close</button>
  </form>
</dialog>
