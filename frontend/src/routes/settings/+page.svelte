<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { Wallet, Key, Download, Copy, AlertCircle, ArrowLeft, Settings } from 'lucide-svelte';

  let addresses: any = $state(null);
  let secrets: any = $state(null);
  let loading = $state(true);
  let loadingSecrets = $state(false);
  let error = $state<string | null>(null);
  let secretError = $state<string | null>(null);

  async function fetchAddresses() {
    try {
      const token = $authStore.accessToken;
      if (!token) return;
      const res = await fetch(`${PUBLIC_API_URL}/wallet/check`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (body.success) {
        addresses = body.data.addresses;
      }
    } catch (e) {
      console.error('Failed to fetch addresses', e);
      error = 'Unable to load wallet addresses';
    } finally {
      loading = false;
    }
  }

  async function revealSecrets() {
    loadingSecrets = true;
    secretError = null;
    try {
      const token = $authStore.accessToken;
      if (!token) return;
      const res = await fetch(`${PUBLIC_API_URL}/wallet/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (body.success) {
        secrets = body.data;
      } else {
        secretError = body.message || 'Failed to retrieve secrets';
      }
    } catch (e: any) {
      console.error(e);
      secretError = e.message || 'Error fetching secrets';
    } finally {
      loadingSecrets = false;
    }
  }

  function downloadSecrets() {
    if (!secrets) return;
    const blob = new Blob([JSON.stringify(secrets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'liffey-master-wallet.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  onMount(async () => {
    await authStore.verify();
    if (!$authStore.isAuthenticated) {
      goto('/auth');
      return;
    }
    fetchAddresses();
  });
</script>

<svelte:head>
  <title>Settings — Liffey Founders Club</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-3xl">
  <button class="btn btn-ghost mb-6" onclick={() => goto('/profile')}>
    <ArrowLeft size={16} /> Back
  </button>

  <h1 class="text-3xl font-bold mb-4 flex items-center gap-2">
    <Settings size={24} /> Settings
  </h1>

  {#if loading}
    <div class="text-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else}
    {#if error}
      <div class="alert alert-error mb-4">
        <AlertCircle class="w-5 h-5" />
        <span>{error}</span>
      </div>
    {/if}

    <div class="card bg-base-100 shadow-lg mb-6">
      <div class="card-body">
        <h2 class="card-title">Master Wallet Addresses</h2>
        {#if addresses}
          <ul class="space-y-2 mt-3">
            <li>
              <strong>Ethereum:</strong> {addresses.ethAddress || 'N/A'}
            </li>
            <li>
              <strong>Avalanche:</strong> {addresses.avaxAddress || 'N/A'}
            </li>
            <li>
              <strong>Solana:</strong> {addresses.solanaAddress || 'N/A'}
            </li>
            <li>
              <strong>Stellar:</strong> {addresses.stellarAddress || 'N/A'}
            </li>
            <li>
              <strong>Bitcoin:</strong> {addresses.bitcoinAddress || 'N/A'}
            </li>
          </ul>
        {/if}
      </div>
    </div>

    <div class="mb-6">
      <button class="btn btn-primary" onclick={revealSecrets} disabled={loadingSecrets || !!secrets}>
        {#if loadingSecrets}
          <span class="loading loading-spinner loading-xs"></span> Fetching...
        {:else}
          Reveal / Download Wallet Keys
        {/if}
      </button>
    </div>

    {#if secretError}
      <div class="alert alert-error mb-4">
        <span>{secretError}</span>
      </div>
    {/if}

    {#if secrets}
      <div class="card bg-base-100 shadow-lg mb-6">
        <div class="card-body space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="card-title">Secrets</h2>
            <button class="btn btn-ghost btn-sm" onclick={downloadSecrets} title="Download JSON">
              <Download class="w-4 h-4" />
            </button>
          </div>
          <div>
            <p class="text-xs opacity-70">Mnemonic phrase (keep offline):</p>
            <div class="flex gap-2 items-center">
              <code class="break-words w-full p-2 bg-base-200 rounded">{secrets.mnemonic}</code>
              <button class="btn btn-ghost btn-xs" onclick={() => copy(secrets.mnemonic)} title="Copy">
                <Copy class="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <p class="text-xs opacity-70">Ethereum / Avalanche private key:</p>
            <div class="flex gap-2 items-center">
              <code class="break-words w-full p-2 bg-base-200 rounded">{secrets.privateKey}</code>
              <button class="btn btn-ghost btn-xs" onclick={() => copy(secrets.privateKey)} title="Copy">
                <Copy class="w-4 h-4" />
              </button>
            </div>
          </div>
          {#if secrets.avaxPrivateKey && secrets.avaxPrivateKey !== secrets.privateKey}
            <div>
              <p class="text-xs opacity-70">Avalanche private key:</p>
              <div class="flex gap-2 items-center">
                <code class="break-words w-full p-2 bg-base-200 rounded">{secrets.avaxPrivateKey}</code>
                <button class="btn btn-ghost btn-xs" onclick={() => copy(secrets.avaxPrivateKey)} title="Copy">
                  <Copy class="w-4 h-4" />
                </button>
              </div>
            </div>
          {/if}
          {#if secrets.solanaPrivateKey}
            <div>
              <p class="text-xs opacity-70">Solana private key (hex):</p>
              <div class="flex gap-2 items-center">
                <code class="break-words w-full p-2 bg-base-200 rounded">{secrets.solanaPrivateKey}</code>
                <button class="btn btn-ghost btn-xs" onclick={() => copy(secrets.solanaPrivateKey)} title="Copy">
                  <Copy class="w-4 h-4" />
                </button>
              </div>
            </div>
          {/if}
          {#if secrets.stellarPrivateKey}
            <div>
              <p class="text-xs opacity-70">Stellar secret seed:</p>
              <div class="flex gap-2 items-center">
                <code class="break-words w-full p-2 bg-base-200 rounded">{secrets.stellarPrivateKey}</code>
                <button class="btn btn-ghost btn-xs" onclick={() => copy(secrets.stellarPrivateKey)} title="Copy">
                  <Copy class="w-4 h-4" />
                </button>
              </div>
            </div>
          {/if}
          {#if secrets.bitcoinPrivateKey}
            <div>
              <p class="text-xs opacity-70">Bitcoin private key (WIF):</p>
              <div class="flex gap-2 items-center">
                <code class="break-words w-full p-2 bg-base-200 rounded">{secrets.bitcoinPrivateKey}</code>
                <button class="btn btn-ghost btn-xs" onclick={() => copy(secrets.bitcoinPrivateKey)} title="Copy">
                  <Copy class="w-4 h-4" />
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>
