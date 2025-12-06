<script lang="ts">
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

  async function generateWallet() {
    isGenerating = true;
    error = null;

    try {
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
        onWalletGenerated(); // Notify parent component
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
  <div class="modal-box max-w-2xl">
    <h3 class="font-bold text-2xl flex items-center gap-2 mb-4">
      <Wallet class="w-6 h-6 text-primary" />
      Generate Master Wallet
    </h3>

    {#if !walletData}
      <!-- Warning & Generation -->
      <div class="space-y-4">
        <div class="alert alert-warning">
          <AlertTriangle class="w-5 h-5" />
          <div class="flex-1">
            <p class="font-semibold">Important Security Information</p>
            <ul class="text-sm mt-2 space-y-1 list-disc list-inside">
              <li>You can only generate ONE master wallet per account</li>
              <li>Your recovery phrase and private key will be shown ONCE</li>
              <li>You must download and securely store this information</li>
              <li>Loss of this data means permanent loss of access to funds</li>
              <li>Company wallets will be derived from this master wallet</li>
            </ul>
          </div>
        </div>

        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-3">
            <input 
              type="checkbox" 
              class="checkbox checkbox-primary"
              bind:checked={hasAcknowledged}
            />
            <span class="label-text">
              I understand that I must securely store my wallet information and that it cannot be recovered if lost.
            </span>
          </label>
        </div>

        {#if error}
          <div class="alert alert-error">
            <span>{error}</span>
          </div>
        {/if}

        <div class="modal-action">
          <button class="btn btn-ghost" onclick={closeModal}>Cancel</button>
          <button 
            class="btn btn-primary"
            disabled={!hasAcknowledged || isGenerating}
            onclick={generateWallet}
          >
            {#if isGenerating}
              <span class="loading loading-spinner loading-sm"></span>
            {/if}
            Generate Wallet
          </button>
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
            <code class="text-sm break-all">{walletData.ethAddress}</code>
          </div>
          <div class="bg-base-200 p-3 rounded">
            <p class="text-xs opacity-70 mb-1">Avalanche (AVAX)</p>
            <code class="text-sm break-all">{walletData.avaxAddress}</code>
          </div>
        </div>

        <!-- Recovery Phrase -->
        <div class="space-y-2">
          <h4 class="font-semibold">Recovery Phrase (12 Words):</h4>
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
