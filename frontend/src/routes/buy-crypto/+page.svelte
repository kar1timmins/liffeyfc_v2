<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { loadStripeOnramp } from '@stripe/crypto';
  import { authStore } from '$lib/stores/auth';
  import { PUBLIC_API_URL, PUBLIC_STRIPE_PUBLISHABLE_KEY } from '$env/static/public';
  import { ArrowLeft, CreditCard, RefreshCw, Wallet, AlertCircle, ExternalLink, Zap } from 'lucide-svelte';
  import GenerateWalletModal from '$lib/components/GenerateWalletModal.svelte';

  // ---------------------------------------------------------------------------
  // Purchase options
  //
  // addressKey maps to the field in masterWallet that holds the destination address.
  // USDC/Ethereum and USDC/Avalanche are unavailable when the user's IP is flagged
  // as EU-origin — the non-EVM options (SOL, XLM, BTC) are broadly available.
  // ---------------------------------------------------------------------------
  type AddressKey = 'ethAddress' | 'solanaAddress' | 'stellarAddress' | 'bitcoinAddress';

  type PurchaseOption = {
    label: string;
    currency: string;
    network: string;
    addressKey: AddressKey;
    addressLabel: string;
    note?: string;
  };

  const PURCHASE_OPTIONS: PurchaseOption[] = [
    {
      label: 'USDC — Ethereum',
      currency: 'usdc',
      network: 'ethereum',
      addressKey: 'ethAddress',
      addressLabel: 'EVM wallet (Ethereum)',
    },
    {
      label: 'USDC — Avalanche',
      currency: 'usdc',
      network: 'avalanche',
      addressKey: 'ethAddress',
      addressLabel: 'EVM wallet (Avalanche)',
    },
    {
      label: 'USDC — Solana',
      currency: 'usdc',
      network: 'solana',
      addressKey: 'solanaAddress',
      addressLabel: 'Solana wallet',
      note: 'Available for EUR purchases',
    },
    {
      label: 'SOL — Solana',
      currency: 'sol',
      network: 'solana',
      addressKey: 'solanaAddress',
      addressLabel: 'Solana wallet',
      note: 'Available for EUR purchases',
    },
    {
      label: 'XLM — Stellar',
      currency: 'xlm',
      network: 'stellar',
      addressKey: 'stellarAddress',
      addressLabel: 'Stellar wallet (G...)',
      note: 'Available for EUR purchases',
    },
    {
      label: 'BTC — Bitcoin',
      currency: 'btc',
      network: 'bitcoin',
      addressKey: 'bitcoinAddress',
      addressLabel: 'Bitcoin wallet (bc1q...)',
      note: 'Available for EUR purchases',
    },
  ];

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let selectedOptionIndex = $state(0);
  let exchangeAmount = $state('50.00');

  type MasterWallet = {
    ethAddress: string;
    avaxAddress: string;
    solanaAddress: string | null;
    stellarAddress: string | null;
    bitcoinAddress: string | null;
  };

  // DB master wallet
  let masterWallet = $state<MasterWallet | null>(null);
  let walletLoading = $state(true);
  let showGenerateModal = $state(false);
  let isUpgradingWallet = $state(false);
  let upgradeError = $state('');

  // Widget lifecycle
  let sessionState = $state<'idle' | 'loading' | 'mounted' | 'error'>('idle');
  let errorMessage = $state('');
  let statusMessage = $state('');

  let onrampContainer: HTMLDivElement;
  let activeSession: ReturnType<
    NonNullable<Awaited<ReturnType<typeof loadStripeOnramp>>>['createSession']
  > | null = null;

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  let selectedOption = $derived(PURCHASE_OPTIONS[selectedOptionIndex]);

  /** The destination address for the currently selected option */
  let resolvedAddress = $derived(
    masterWallet ? (masterWallet[selectedOption.addressKey] ?? null) : null
  );

  /** True when the user has a wallet but it lacks the new-chain addresses */
  let needsUpgrade = $derived(
    !!masterWallet &&
    !masterWallet.solanaAddress &&
    !masterWallet.stellarAddress &&
    !masterWallet.bitcoinAddress
  );

  /** True when the selected option needs a non-EVM address that hasn't been derived yet */
  let selectedNeedsUpgrade = $derived(
    !!masterWallet && resolvedAddress === null && selectedOption.addressKey !== 'ethAddress'
  );

  let hasWallet = $derived(!!masterWallet?.ethAddress);
  let canLaunch = $derived(
    hasWallet &&
    !!resolvedAddress &&
    !!exchangeAmount &&
    parseFloat(exchangeAmount) > 0 &&
    sessionState !== 'loading'
  );

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  onMount(async () => {
    if (!$authStore.isAuthenticated) { goto('/auth'); return; }
    await loadMasterWallet();
  });

  async function loadMasterWallet() {
    walletLoading = true;
    try {
      const res = await fetch(`${PUBLIC_API_URL}/wallet/addresses`, {
        headers: { Authorization: `Bearer ${$authStore.accessToken}` },
        credentials: 'include',
      });
      if (res.ok) {
        const body = await res.json();
        if (body.success && body.data) masterWallet = body.data;
      }
    } catch (_) { /* wallet not yet generated */ }
    walletLoading = false;
  }

  /** Call the backend to derive Solana, Stellar and Bitcoin addresses on-the-fly */
  async function upgradeWallet() {
    isUpgradingWallet = true;
    upgradeError = '';
    try {
      const res = await fetch(`${PUBLIC_API_URL}/wallet/derive-multichain`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${$authStore.accessToken}` },
        credentials: 'include',
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message ?? 'Upgrade failed');
      await loadMasterWallet(); // reload with new addresses
    } catch (err: any) {
      upgradeError = err.message ?? 'Could not upgrade wallet. Please try again.';
    }
    isUpgradingWallet = false;
  }

  // ---------------------------------------------------------------------------
  // Widget
  // ---------------------------------------------------------------------------

  async function launchOnramp() {
    if (!$authStore.isAuthenticated) { goto('/auth'); return; }

    activeSession = null;
    if (onrampContainer) onrampContainer.innerHTML = '';

    sessionState = 'loading';
    errorMessage = '';
    statusMessage = '';

    try {
      const stripeOnramp = await loadStripeOnramp(PUBLIC_STRIPE_PUBLISHABLE_KEY);
      if (!stripeOnramp) throw new Error('Failed to initialise Stripe Onramp SDK.');

      const res = await fetch(`${PUBLIC_API_URL}/crypto/create-onramp-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${$authStore.accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          transaction_details: {
            destination_currency: selectedOption.currency,
            destination_exchange_amount: exchangeAmount,
            destination_network: selectedOption.network,
            wallet_address: resolvedAddress,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(err?.message ?? `Server error ${res.status}`);
      }

      const { clientSecret } = await res.json();

      const session = stripeOnramp.createSession({
        clientSecret,
        appearance: {
          theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
        },
      });

      activeSession = session;
      session.mount(onrampContainer);
      sessionState = 'mounted';

      session.addEventListener('onramp_session_updated', (e: any) => {
        const STATUS_LABELS: Record<string, string> = {
          initialized:            'Session initialised — complete the form to proceed.',
          rejected:               'Session was declined. You may try again.',
          requires_payment:       'Payment details required.',
          payment_processing:     'Processing payment…',
          payment_failed:         'Payment failed. Please try a different method.',
          fulfillment_processing: 'Funds are on their way to your wallet.',
          fulfillment_complete:   '🎉 Crypto has been delivered to your wallet!',
        };
        const status: string = e?.payload?.session?.status ?? '';
        statusMessage = STATUS_LABELS[status] ?? `Session status: ${status}`;
      });
    } catch (err: any) {
      errorMessage = err?.message ?? 'Something went wrong. Please try again.';
      sessionState = 'error';
    }
  }

  function reconfigure() {
    sessionState = 'idle';
    activeSession = null;
    if (onrampContainer) onrampContainer.innerHTML = '';
  }

  function onWalletGenerated(_data: any) {
    showGenerateModal = false;
    loadMasterWallet();
  }
</script>

<svelte:head>
  <title>Buy Crypto — Liffey Founders Club</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="min-h-screen pt-4 pb-24 px-4 sm:px-6 flex flex-col items-center">
  <!-- Page header -->
  <div class="w-full max-w-2xl mb-6">
    <button class="btn btn-ghost btn-sm gap-2 mb-4 -ml-1" onclick={() => goto('/dashboard')} aria-label="Go back">
      <ArrowLeft size={16} /> Back
    </button>
    <div class="flex items-center gap-3 mb-1">
      <div class="p-2 rounded-xl bg-primary/10">
        <CreditCard size={24} class="text-primary" />
      </div>
      <div>
        <h1 class="text-2xl font-bold">Buy Crypto</h1>
        <p class="text-sm text-base-content/60">Purchase crypto directly with your card or bank</p>
      </div>
    </div>
  </div>

  <!-- Configuration card — hidden while widget is mounted -->
  {#if sessionState !== 'mounted'}
    <div class="card glass w-full max-w-2xl shadow-lg mb-6">
      <div class="card-body gap-5">
        <h2 class="card-title text-base font-semibold">Configure your purchase</h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Token / Network -->
          <label class="form-control w-full">
            <div class="label pb-1"><span class="label-text text-xs font-medium">Token &amp; Network</span></div>
            <select
              class="select select-bordered select-sm w-full"
              bind:value={selectedOptionIndex}
              disabled={sessionState === 'loading'}
            >
              {#each PURCHASE_OPTIONS as opt, i}
                <option value={i}>
                  {opt.label}{opt.note ? ` (${opt.note})` : ''}
                </option>
              {/each}
            </select>
          </label>

          <!-- Amount -->
          <label class="form-control w-full">
            <div class="label pb-1"><span class="label-text text-xs font-medium">Amount (USD)</span></div>
            <input
              type="number"
              min="1"
              step="0.01"
              class="input input-bordered input-sm w-full"
              bind:value={exchangeAmount}
              placeholder="50.00"
              disabled={sessionState === 'loading'}
            />
          </label>
        </div>

        <!-- Wallet address section -->
        {#if walletLoading}
          <div class="flex items-center gap-2 text-sm text-base-content/60">
            <span class="loading loading-spinner loading-xs"></span> Loading wallet…
          </div>

        {:else if !hasWallet}
          <!-- No wallet at all -->
          <div class="rounded-lg border border-warning/40 bg-warning/5 p-3 flex items-start gap-3">
            <AlertCircle size={16} class="text-warning mt-0.5 flex-shrink-0" />
            <div>
              <p class="text-xs font-medium text-warning">No wallet found</p>
              <p class="text-xs text-base-content/60 mt-0.5">
                Generate a wallet to pre-fill the destination address.
              </p>
              <button class="btn btn-warning btn-xs mt-2 gap-1" onclick={() => { showGenerateModal = true; }}>
                <Wallet size={12} /> Generate Wallet
              </button>
            </div>
          </div>

        {:else if selectedNeedsUpgrade}
          <!-- Wallet exists but multi-chain addresses not yet derived -->
          <div class="rounded-lg border border-info/40 bg-info/5 p-3 flex items-start gap-3">
            <Zap size={16} class="text-info mt-0.5 flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-info">Multi-chain support needed</p>
              <p class="text-xs text-base-content/60 mt-0.5">
                Your wallet was created before Solana, Stellar and Bitcoin support was added.
                Click below to derive these addresses from your existing mnemonic (instant, no new seed phrase).
              </p>
              {#if upgradeError}
                <p class="text-xs text-error mt-1">{upgradeError}</p>
              {/if}
              <button
                class="btn btn-info btn-xs mt-2 gap-1"
                onclick={upgradeWallet}
                disabled={isUpgradingWallet}
              >
                {#if isUpgradingWallet}
                  <span class="loading loading-spinner loading-xs"></span> Deriving…
                {:else}
                  <Zap size={12} /> Enable Multi-Chain
                {/if}
              </button>
            </div>
          </div>

        {:else if resolvedAddress}
          <!-- Good — show the destination address -->
          <div class="rounded-lg border border-success/30 bg-success/5 p-3 flex items-start gap-3">
            <Wallet size={16} class="text-success mt-0.5 flex-shrink-0" />
            <div class="min-w-0">
              <p class="text-xs font-medium text-success mb-0.5">
                Destination wallet — {selectedOption.addressLabel}
              </p>
              <p class="text-xs font-mono break-all text-base-content/70">{resolvedAddress}</p>
              {#if needsUpgrade}
                <p class="text-[11px] text-base-content/40 mt-1">
                  <button class="underline hover:text-primary" onclick={upgradeWallet}>
                    Also derive Solana, Stellar &amp; Bitcoin addresses
                  </button>
                </p>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Error -->
        {#if sessionState === 'error'}
          <div class="alert alert-error text-sm py-2 gap-2">
            <AlertCircle size={14} />
            <span>{errorMessage}</span>
          </div>
        {/if}

        <div class="card-actions justify-end">
          <button class="btn btn-primary btn-sm gap-2" onclick={launchOnramp} disabled={!canLaunch}>
            {#if sessionState === 'loading'}
              <span class="loading loading-spinner loading-xs"></span> Loading…
            {:else if sessionState === 'error'}
              <RefreshCw size={14} /> Try Again
            {:else}
              <CreditCard size={14} /> Launch Onramp
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Stripe hosted widget -->
  <div
    class="w-full max-w-2xl"
    class:hidden={sessionState === 'idle' || sessionState === 'loading' || sessionState === 'error'}
  >
    {#if sessionState === 'mounted'}
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm text-base-content/60">Purchasing <strong>{selectedOption?.label}</strong>.</p>
        <button class="btn btn-ghost btn-xs gap-1" onclick={reconfigure}>
          <RefreshCw size={12} /> Reconfigure
        </button>
      </div>
    {/if}

    {#if statusMessage}
      <div class="alert alert-info text-sm py-2 mb-3">
        <span>{statusMessage}</span>
      </div>
    {/if}

    <!-- Stripe injects an iframe here -->
    <div bind:this={onrampContainer} id="onramp-element" class="rounded-2xl overflow-hidden w-full"></div>
  </div>

  <p class="text-center text-xs text-base-content/40 max-w-md mt-8">
    Powered by
    <a href="https://stripe.com/crypto" target="_blank" rel="noopener noreferrer" class="underline hover:text-primary inline-flex items-center gap-0.5">
      Stripe Crypto Onramp <ExternalLink size={10} />
    </a>.
    Liffey Founders Club does not custody your funds.
  </p>
</div>

<!-- Wallet generation modal -->
<GenerateWalletModal bind:isOpen={showGenerateModal} {onWalletGenerated} />
