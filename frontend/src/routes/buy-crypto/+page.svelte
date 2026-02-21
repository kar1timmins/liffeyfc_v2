<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { loadStripeOnramp } from '@stripe/crypto';
  import { authStore } from '$lib/stores/auth';
  import { walletStore } from '$lib/stores/walletStore';
  import { PUBLIC_API_URL, PUBLIC_STRIPE_PUBLISHABLE_KEY } from '$env/static/public';
  import { ArrowLeft, CreditCard, RefreshCw } from 'lucide-svelte';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** Selected destination currency (token) */
  let destinationCurrency = $state('usdc');
  /** Fiat amount to spend (in destination currency equivalent) */
  let exchangeAmount = $state('50.00');
  /** Target blockchain network */
  let destinationNetwork = $state('ethereum');

  // Widget lifecycle state
  let sessionState = $state<'idle' | 'loading' | 'mounted' | 'error'>('idle');
  let errorMessage = $state('');
  let statusMessage = $state('');

  // DOM ref for Stripe to mount the iframe into
  let onrampContainer: HTMLDivElement;

  // Reference to the active onramp session (allows cleanup on reconfigure)
  // NonNullable<> strips the `| null` from the awaited return before indexing createSession
  let activeSession: ReturnType<NonNullable<Awaited<ReturnType<typeof loadStripeOnramp>>>['createSession']> | null =
    null;

  // ---------------------------------------------------------------------------
  // Options
  // ---------------------------------------------------------------------------

  const CURRENCY_OPTIONS = [
    { value: 'usdc', label: 'USDC' },
    { value: 'eth', label: 'ETH' },
    { value: 'avax', label: 'AVAX' },
    { value: 'btc', label: 'BTC' },
  ] as const;

  // Values match Stripe's accepted destination_network enum exactly
  const NETWORK_OPTIONS = [
    { value: 'ethereum', label: 'Ethereum' },
    { value: 'avalanche', label: 'Avalanche' },
    { value: 'polygon', label: 'Polygon' },
    { value: 'base', label: 'Base' },
    { value: 'solana', label: 'Solana' },
    { value: 'optimism', label: 'Optimism' },
  ] as const;

  // ---------------------------------------------------------------------------
  // Auth guard
  // ---------------------------------------------------------------------------

  onMount(() => {
    if (!$authStore.isAuthenticated) {
      goto('/auth');
    }
  });

  // ---------------------------------------------------------------------------
  // Main widget initialisation
  // ---------------------------------------------------------------------------

  async function launchOnramp() {
    if (!$authStore.isAuthenticated) {
      goto('/auth');
      return;
    }

    // Clear any previously mounted widget — OnrampSession has no unmount(),
    // so we wipe the container's innerHTML directly.
    if (activeSession) {
      activeSession = null;
    }
    if (onrampContainer) {
      onrampContainer.innerHTML = '';
    }

    sessionState = 'loading';
    errorMessage = '';
    statusMessage = '';

    try {
      // 1. Load the Stripe onramp SDK
      const stripeOnramp = await loadStripeOnramp(PUBLIC_STRIPE_PUBLISHABLE_KEY);
      if (!stripeOnramp) {
        throw new Error('Failed to initialise Stripe Onramp SDK.');
      }

      // 2. Request a session client secret from the NestJS backend
      const res = await fetch(`${PUBLIC_API_URL}/crypto/create-onramp-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${$authStore.accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          transaction_details: {
            destination_currency: destinationCurrency,
            destination_exchange_amount: exchangeAmount,
            destination_network: destinationNetwork,
            // Pre-fill wallet if the user has one connected
            ...(($walletStore.address) && { wallet_address: $walletStore.address }),
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(err?.message ?? `Server error ${res.status}`);
      }

      const { clientSecret } = await res.json();

      // 3. Create and mount the hosted onramp widget
      const session = stripeOnramp.createSession({
        clientSecret,
        appearance: {
          theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
        },
      });

      activeSession = session;
      session.mount(onrampContainer);
      sessionState = 'mounted';

      // 4. React to session state changes
      session.addEventListener('onramp_session_updated', (e: any) => {
        const status: string = e?.payload?.session?.status ?? '';
        const statusLabels: Record<string, string> = {
          initialized: 'Session initialised—complete the form to proceed.',
          rejected: 'Session was declined. You may try again.',
          requires_payment: 'Payment details required.',
          payment_processing: 'Payment is being processed…',
          payment_failed: 'Payment failed. Please try a different method.',
          fulfillment_processing: 'Funds are on their way to your wallet.',
          fulfillment_complete: '🎉 Funds have been delivered to your wallet!',
        };
        statusMessage = statusLabels[status] ?? `Session status: ${status}`;
      });
    } catch (err: any) {
      errorMessage = err?.message ?? 'Something went wrong. Please try again.';
      sessionState = 'error';
    }
  }
</script>

<svelte:head>
  <title>Buy Crypto — Liffey Founders Club</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="min-h-screen pt-4 pb-24 px-4 sm:px-6 flex flex-col items-center">
  <!-- Page header -->
  <div class="w-full max-w-2xl mb-6">
    <button
      class="btn btn-ghost btn-sm gap-2 mb-4 -ml-1"
      onclick={() => history.back()}
      aria-label="Go back"
    >
      <ArrowLeft size={16} />
      Back
    </button>

    <div class="flex items-center gap-3 mb-2">
      <div class="p-2 rounded-xl bg-primary/10">
        <CreditCard size={24} class="text-primary" />
      </div>
      <div>
        <h1 class="text-2xl font-bold">Buy Crypto</h1>
        <p class="text-sm text-base-content/60">Purchase tokens directly with your card or bank</p>
      </div>
    </div>
  </div>

  <!-- Configuration card (hidden once widget is mounted) -->
  {#if sessionState !== 'mounted'}
    <div class="card glass w-full max-w-2xl shadow-lg mb-6">
      <div class="card-body gap-4">
        <h2 class="card-title text-base font-semibold">Configure your purchase</h2>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <!-- Currency -->
          <label class="form-control w-full">
            <div class="label pb-1"><span class="label-text text-xs font-medium">Token</span></div>
            <select
              class="select select-bordered select-sm w-full"
              bind:value={destinationCurrency}
              disabled={sessionState === 'loading'}
            >
              {#each CURRENCY_OPTIONS as opt}
                <option value={opt.value}>{opt.label}</option>
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

          <!-- Network -->
          <label class="form-control w-full">
            <div class="label pb-1"><span class="label-text text-xs font-medium">Network</span></div>
            <select
              class="select select-bordered select-sm w-full"
              bind:value={destinationNetwork}
              disabled={sessionState === 'loading'}
            >
              {#each NETWORK_OPTIONS as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </label>
        </div>

        {#if $walletStore.isConnected}
          <p class="text-xs text-base-content/50">
            Funds will be sent to your connected wallet: <span class="font-mono">{$walletStore.address}</span>
          </p>
        {:else}
          <p class="text-xs text-base-content/50">
            Connect your wallet first to pre-fill the destination address, or enter it manually in the widget.
          </p>
        {/if}

        <!-- Error state -->
        {#if sessionState === 'error'}
          <div class="alert alert-error text-sm py-2">
            <span>{errorMessage}</span>
          </div>
        {/if}

        <div class="card-actions justify-end mt-2">
          <button
            class="btn btn-primary btn-sm gap-2"
            onclick={launchOnramp}
            disabled={sessionState === 'loading' || !exchangeAmount || parseFloat(exchangeAmount) <= 0}
          >
            {#if sessionState === 'loading'}
              <span class="loading loading-spinner loading-xs"></span>
              Loading…
            {:else if sessionState === 'error'}
              <RefreshCw size={14} />
              Try Again
            {:else}
              <CreditCard size={14} />
              Launch Onramp
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Stripe hosted widget container -->
  <div
    class="w-full max-w-2xl"
    class:hidden={sessionState === 'idle' || sessionState === 'loading' || sessionState === 'error'}
  >
    <!-- Reconfigure button shown after mounting -->
    {#if sessionState === 'mounted'}
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm text-base-content/60">
          Complete the form below to purchase crypto.
        </p>
        <button class="btn btn-ghost btn-xs gap-1" onclick={() => { sessionState = 'idle'; }}>
          <RefreshCw size={12} />
          Reconfigure
        </button>
      </div>
    {/if}

    <!-- Status message from session events -->
    {#if statusMessage}
      <div class="alert alert-info text-sm py-2 mb-3">
        <span>{statusMessage}</span>
      </div>
    {/if}

    <!-- Stripe mounts an <iframe> here -->
    <div bind:this={onrampContainer} id="onramp-element" class="rounded-2xl overflow-hidden w-full"></div>
  </div>

  <!-- Disclaimer -->
  <p class="text-center text-xs text-base-content/40 max-w-md mt-8">
    Crypto purchases are powered by <a href="https://stripe.com/crypto" target="_blank" rel="noopener noreferrer" class="underline hover:text-primary">Stripe Crypto Onramp</a>.
    By proceeding you agree to Stripe's Terms of Service. Liffey Founders Club does not custody your funds.
  </p>
</div>
