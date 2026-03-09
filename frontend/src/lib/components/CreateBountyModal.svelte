<script lang="ts">
  import { X, Target, Loader, CheckCircle, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { toastStore } from '$lib/stores/toast';
  import { authStore } from '$lib/stores/auth';

  interface WishlistItem {
    id: string;
    title: string;
    description?: string;
    value?: number;
    category?: string;
  }

  let {
    isOpen = $bindable(false),
    wishlistItem,
    companyName,
    companyWallet,
    onSuccess = (..._args: unknown[]) => {},
  }: {
    isOpen: boolean;
    wishlistItem: WishlistItem;
    companyName: string;
    companyWallet?: string;
    onSuccess?: (...args: unknown[]) => void;
  } = $props();

  // Form state
  let ethEurRate = $state<number | null>(null);
  let avaxEurRate = $state<number | null>(null);
  let pricesLoading = $state(false);

  async function fetchPrices() {
    pricesLoading = true;
    try {
      const res = await fetch(`${PUBLIC_API_URL}/crypto-prices`);
      const json = await res.json();
      if (json.success) {
        ethEurRate = json.data.ethEur;
        avaxEurRate = json.data.avaxEur;
      }
    } catch {
      // keep null — UI will show fallback label
    } finally {
      pricesLoading = false;
    }
  }

  $effect(() => {
    if (isOpen && ethEurRate === null) fetchPrices();
  });

  let targetAmountEur = $state(wishlistItem.value || 10000);
  let durationDays = $state(30);
  let campaignName = $state(wishlistItem.title || '');
  let campaignDescription = $state(wishlistItem.description || '');
  let deployToEthereum = $state(true);
  let deployToAvalanche = $state(true);

  // Derived
  const targetAmountEth = $derived(
    ethEurRate ? Math.round((targetAmountEur / ethEurRate) * 10000) / 10000 : null,
  );
  const targetAmountAvax = $derived(
    avaxEurRate ? Math.round((targetAmountEur / avaxEurRate) * 100) / 100 : null,
  );
  const campaignDeadline = $derived(
    new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-IE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
  );

  // UI state
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);
  let deploymentResult = $state<any>(null);

  // Step tracking — 3 configure sub-steps + deploying + success
  type Step = 'campaign' | 'goal' | 'networks' | 'deploying' | 'success';
  let currentStep = $state<Step>('campaign');

  const CONFIGURE_STEPS: Step[] = ['campaign', 'goal', 'networks'];
  const CONFIGURE_LABELS = ['Campaign', 'Goal', 'Networks'];

  const configureStepIndex = $derived(CONFIGURE_STEPS.indexOf(currentStep as Step));

  // Dialog ref for top-layer rendering (bypasses backdrop-filter stacking context)
  let dialogEl: HTMLDialogElement | null = $state(null);
  $effect(() => {
    if (isOpen) {
      if (dialogEl && !dialogEl.open) dialogEl.showModal();
    } else {
      if (dialogEl?.open) dialogEl.close();
    }
  });

  const DURATION_PRESETS = [
    { days: 7, label: '1 Week' },
    { days: 14, label: '2 Weeks' },
    { days: 30, label: '1 Month' },
    { days: 60, label: '2 Months' },
    { days: 90, label: '3 Months' },
  ];

  function close() {
    if (!isSubmitting) {
      isOpen = false;
      setTimeout(reset, 300);
    }
  }

  function reset() {
    targetAmountEur = wishlistItem.value || 10000;
    durationDays = 30;
    campaignName = wishlistItem.title || '';
    campaignDescription = wishlistItem.description || '';
    deployToEthereum = true;
    deployToAvalanche = true;
    isSubmitting = false;
    error = null;
    deploymentResult = null;
    currentStep = 'campaign';
    // Reset prices so they are re-fetched on next open
    ethEurRate = null;
    avaxEurRate = null;
  }

  function nextStep() {
    error = null;
    if (currentStep === 'campaign') {
      currentStep = 'goal';
    } else if (currentStep === 'goal') {
      if (targetAmountEur <= 0) { error = 'Target amount must be greater than 0'; return; }
      if (durationDays < 1 || durationDays > 365) { error = 'Duration must be between 1 and 365 days'; return; }
      currentStep = 'networks';
    }
  }

  function prevStep() {
    error = null;
    if (currentStep === 'goal') currentStep = 'campaign';
    else if (currentStep === 'networks') currentStep = 'goal';
  }

  async function handleSubmit() {
    error = null;

    if (!deployToEthereum && !deployToAvalanche) {
      error = 'Please select at least one blockchain network';
      return;
    }
    if (!companyWallet) {
      error = 'Company must have a wallet address configured';
      return;
    }

    isSubmitting = true;
    currentStep = 'deploying';

    try {
      const chains = [];
      if (deployToEthereum) chains.push('ethereum');
      if (deployToAvalanche) chains.push('avalanche');

      const roundedEurAmount = Math.round(targetAmountEur * 100) / 100;
      const roundedEthAmount = targetAmountEth !== null
        ? Math.round(targetAmountEth * 10000) / 10000
        : 0;
      const roundedDurationDays = Math.round(durationDays);

      // Step 1: Create bounty record
      const bountyResponse = await fetch(`${PUBLIC_API_URL}/bounties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${$authStore.accessToken}`,
        },
        body: JSON.stringify({
          wishlistItemId: wishlistItem.id,
          targetAmountEur: roundedEurAmount,
          durationInDays: roundedDurationDays,
          campaignName,
          campaignDescription,
        }),
      });

      const bountyData = await bountyResponse.json();
      if (!bountyData.success) {
        throw new Error(bountyData.message || 'Failed to create bounty record');
      }

      // Step 2: Deploy escrow contracts
      const escrowResponse = await fetch(`${PUBLIC_API_URL}/escrow/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${$authStore.accessToken}`,
        },
        body: JSON.stringify({
          wishlistItemId: wishlistItem.id,
          targetAmountEth: roundedEthAmount,
          durationInDays: roundedDurationDays,
          chains,
          campaignName,
          campaignDescription,
        }),
      });

      const escrowData = await escrowResponse.json();
      if (!escrowData.success) {
        throw new Error(escrowData.message || 'Failed to deploy escrow contracts');
      }

      deploymentResult = escrowData.data;
      currentStep = 'success';

      const deployed = escrowData.data || {};
      const addrs = [];
      if (deployed.ethereumAddress) addrs.push({ chain: 'ethereum', address: deployed.ethereumAddress });
      if (deployed.avalancheAddress) addrs.push({ chain: 'avalanche', address: deployed.avalancheAddress });
      if (addrs.length > 0) {
        toastStore.add({
          message: `🎉 Escrow contract${addrs.length > 1 ? 's' : ''} deployed`,
          type: 'success',
          ttl: 12000,
          group: 'contract_deploy',
          data: { campaignName, campaignDescription, addresses: addrs },
        });
      }

      const deployedAddresses = deploymentResult || {};
      setTimeout(() => {
        try {
          onSuccess(deployedAddresses);
        } catch (_e) {
          onSuccess();
        }
        close();
      }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to create bounty and deploy contracts';
      currentStep = 'networks';
    } finally {
      isSubmitting = false;
    }
  }

  function viewOnExplorer(chain: 'ethereum' | 'avalanche', address: string) {
    const baseUrl =
      chain === 'ethereum'
        ? 'https://sepolia.etherscan.io/address/'
        : 'https://testnet.snowtrace.io/address/';
    window.open(baseUrl + address, '_blank');
  }
</script>

{#if isOpen}<dialog
  class="modal"
  bind:this={dialogEl}
  onclose={() => { if (isOpen) { isOpen = false; setTimeout(reset, 300); } }}
>
  <div class="modal-box max-w-3xl p-0 overflow-hidden">

    <!-- ── Header ── -->
    <div class="bg-gradient-to-br from-primary/10 via-base-200/60 to-secondary/10 px-8 py-6 border-b border-base-300">
      <div class="flex justify-between items-start mb-5">
        <div>
          <h3 class="text-2xl font-bold flex items-center gap-2">
            <Target class="w-6 h-6 text-primary" />
            Create Bounty
          </h3>
          <p class="text-sm opacity-60 mt-0.5">
            Crowdfunding escrow for <span class="font-semibold opacity-80">{companyName}</span>
          </p>
        </div>
        <button class="btn btn-sm btn-circle btn-ghost" onclick={close} disabled={isSubmitting}>
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Step tracker (visible during configure steps only) -->
      {#if currentStep === 'campaign' || currentStep === 'goal' || currentStep === 'networks'}
        <div class="flex items-center pb-1">
          {#each CONFIGURE_LABELS as label, i}
            {@const isDone = i < configureStepIndex}
            {@const isActive = i === configureStepIndex}
            <div class="flex items-center {i < 2 ? 'flex-1' : ''}">
              <div class="relative shrink-0 flex flex-col items-center gap-1">
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200
                    {isDone ? 'bg-success text-success-content' : isActive ? 'bg-primary text-primary-content shadow-lg shadow-primary/30 scale-110' : 'bg-base-300 text-base-content/40'}"
                >
                  {isDone ? '✓' : i + 1}
                </div>
                <span class="text-xs font-medium transition-colors duration-200
                  {isActive ? 'text-primary' : isDone ? 'text-success' : 'opacity-40'}">
                  {label}
                </span>
              </div>
              {#if i < 2}
                <div class="flex-1 h-px mx-3 mb-4 transition-colors duration-300 {isDone ? 'bg-success' : 'bg-base-300/60'}"></div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- ── Content ── -->
    <div class="px-8 py-7 min-h-[320px]">

      <!-- ── Step 1: Campaign ── -->
      {#if currentStep === 'campaign'}
        <div>
          <!-- Context chip -->
          <div class="flex items-center gap-3 p-3 rounded-xl bg-base-200/70 mb-6">
            <div class="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Target class="w-4 h-4 text-primary" />
            </div>
            <div class="min-w-0">
              <p class="font-semibold text-sm leading-tight truncate">{wishlistItem.title}</p>
              <p class="text-xs opacity-55 capitalize">{wishlistItem.category || 'Wishlist item'}</p>
            </div>
          </div>

          <div class="grid gap-5">
            <div class="form-control">
              <label class="label pb-1" for="campaign-name">
                <span class="label-text font-semibold">Campaign Name</span>
              </label>
              <input
                id="campaign-name"
                type="text"
                class="input input-bordered w-full"
                placeholder="e.g. Q2 Marketing Campaign Fund"
                bind:value={campaignName}
                maxlength={255}
              />
              <div class="label pt-1">
                <span class="label-text-alt opacity-55">Public-facing title shown on the bounties page</span>
              </div>
            </div>

            <div class="form-control">
              <label class="label pb-1" for="campaign-description">
                <span class="label-text font-semibold">What will the funds be used for?</span>
              </label>
              <textarea
                id="campaign-description"
                class="textarea textarea-bordered w-full resize-none"
                rows={4}
                placeholder="Describe what this campaign funds and why investors should contribute…"
                bind:value={campaignDescription}
              ></textarea>
            </div>
          </div>

          <div class="flex justify-end mt-8">
            <button class="btn btn-primary gap-2" onclick={nextStep}>
              Next: Set Goal
              <ArrowRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      {/if}

      <!-- ── Step 2: Goal & Duration ── -->
      {#if currentStep === 'goal'}
        <div>
          <!-- Funding target -->
          <div class="mb-7">
            <label class="label pb-1" for="target-eur">
              <span class="label-text font-semibold text-base">Funding Target</span>
            </label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold opacity-40 select-none">€</span>
              <input
                id="target-eur"
                type="number"
                class="input input-bordered w-full text-2xl font-bold pl-10 h-16"
                bind:value={targetAmountEur}
                min="100"
                step="100"
              />
            </div>
            <div class="flex flex-wrap gap-x-5 gap-y-1 mt-2">
              {#if pricesLoading}
                <span class="text-sm opacity-50 flex items-center gap-1">
                  <span class="loading loading-spinner loading-xs"></span>
                  Fetching live rates…
                </span>
              {:else}
                {#if targetAmountEth !== null}
                  <p class="text-sm opacity-70">
                    ≈ <span class="font-semibold text-primary">{targetAmountEth} ETH</span>
                    <span class="opacity-40 ml-1 text-xs">(1 ETH ≈ €{ethEurRate?.toLocaleString() ?? '…'})</span>
                  </p>
                {:else}
                  <p class="text-sm opacity-40">ETH rate unavailable</p>
                {/if}
                {#if targetAmountAvax !== null}
                  <p class="text-sm opacity-70">
                    ≈ <span class="font-semibold text-error">{targetAmountAvax} AVAX</span>
                    <span class="opacity-40 ml-1 text-xs">(1 AVAX ≈ €{avaxEurRate?.toLocaleString() ?? '…'})</span>
                  </p>
                {:else}
                  <p class="text-sm opacity-40">AVAX rate unavailable</p>
                {/if}
              {/if}
            </div>
          </div>

          <!-- Duration presets -->
          <div class="mb-2">
            <p class="label-text font-semibold text-base mb-3">Campaign Duration</p>
            <div class="grid grid-cols-5 gap-2 mb-4">
              {#each DURATION_PRESETS as preset}
                {@const [num, unit] = preset.label.split(' ')}
                <button
                  type="button"
                  class="btn flex-col h-auto py-3 gap-0 text-sm transition-all
                    {durationDays === preset.days ? 'btn-primary shadow-md' : 'btn-outline hover:btn-primary/20'}"
                  onclick={() => (durationDays = preset.days)}
                >
                  <span class="font-bold text-base leading-none">{num}</span>
                  <span class="text-xs opacity-70 leading-tight">{unit}</span>
                </button>
              {/each}
            </div>
            <div class="flex items-center gap-3 mt-1">
              <span class="text-sm opacity-60 shrink-0">Custom:</span>
              <input
                type="number"
                class="input input-bordered input-sm w-24"
                bind:value={durationDays}
                min="1"
                max="365"
              />
              <span class="text-sm opacity-60">days</span>
              <span class="text-sm ml-1">→ ends <span class="font-medium">{campaignDeadline}</span></span>
            </div>
          </div>

          {#if error}
            <div class="alert alert-error mt-5">
              <AlertCircle class="w-4 h-4 shrink-0" />
              <span class="text-sm">{error}</span>
            </div>
          {/if}

          <div class="flex justify-between mt-8">
            <button class="btn btn-ghost gap-2" onclick={prevStep}>
              <ArrowLeft class="w-4 h-4" />
              Back
            </button>
            <button class="btn btn-primary gap-2" onclick={nextStep}>
              Next: Choose Networks
              <ArrowRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      {/if}

      <!-- ── Step 3: Networks + Review ── -->
      {#if currentStep === 'networks'}
        <div>
          <p class="label-text font-semibold text-base mb-3">Choose deployment networks</p>

          <!-- Network toggle cards -->
          <div class="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              class="relative rounded-xl border-2 p-4 text-left transition-all
                {deployToEthereum ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' : 'border-base-300 hover:border-base-300/80'}"
              onclick={() => (deployToEthereum = !deployToEthereum)}
            >
              {#if deployToEthereum}
                <span class="absolute top-3 right-3 text-primary">
                  <CheckCircle class="w-4 h-4" />
                </span>
              {/if}
              <div class="text-3xl mb-2 leading-none">⟠</div>
              <p class="font-bold text-sm">Ethereum</p>
              <p class="text-xs opacity-55 mt-0.5">Sepolia Testnet</p>
              <p class="text-xs opacity-40 mt-1">Gas paid in test ETH</p>
            </button>

            <button
              type="button"
              class="relative rounded-xl border-2 p-4 text-left transition-all
                {deployToAvalanche ? 'border-error bg-error/5 shadow-md shadow-error/10' : 'border-base-300 hover:border-base-300/80'}"
              onclick={() => (deployToAvalanche = !deployToAvalanche)}
            >
              {#if deployToAvalanche}
                <span class="absolute top-3 right-3 text-error">
                  <CheckCircle class="w-4 h-4" />
                </span>
              {/if}
              <div class="text-3xl mb-2 leading-none">▲</div>
              <p class="font-bold text-sm">Avalanche</p>
              <p class="text-xs opacity-55 mt-0.5">Fuji Testnet</p>
              <p class="text-xs opacity-40 mt-1">Gas paid in test AVAX</p>
            </button>
          </div>

          <!-- Summary review -->
          <div class="rounded-xl bg-base-200/60 border border-base-300/50 p-4 mb-4 text-sm space-y-2">
            <p class="text-xs font-semibold opacity-50 uppercase tracking-wider mb-3">Review</p>
            <div class="flex justify-between gap-4">
              <span class="opacity-60 shrink-0">Campaign</span>
              <span class="font-medium truncate text-right">{campaignName}</span>
            </div>
            <div class="flex justify-between gap-4 items-start">
              <span class="opacity-60 shrink-0">€ Target</span>
              <span class="font-medium text-right">€{targetAmountEur.toLocaleString()}</span>
            </div>
            {#if targetAmountEth !== null || targetAmountAvax !== null}
            <div class="flex justify-between gap-4">
              <span class="opacity-60 shrink-0">Chain amounts</span>
              <span class="text-xs text-right space-x-3">
                {#if targetAmountEth !== null}<span class="text-primary font-mono">{targetAmountEth} ETH</span>{/if}
                {#if targetAmountAvax !== null}<span class="text-error font-mono">{targetAmountAvax} AVAX</span>{/if}
              </span>
            </div>
            {/if}
            <div class="flex justify-between gap-4">
              <span class="opacity-60 shrink-0">Duration</span>
              <span class="font-medium">{durationDays} days · ends {campaignDeadline}</span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="opacity-60 shrink-0">Receiving wallet</span>
              <code class="text-xs font-mono">{companyWallet ? `${companyWallet.slice(0, 8)}…${companyWallet.slice(-6)}` : 'Not configured'}</code>
            </div>
          </div>

          <!-- Warning (compact) -->
          <div class="alert alert-warning py-2.5 mb-4">
            <AlertCircle class="w-4 h-4 shrink-0" />
            <p class="text-xs">
              Once deployed, the target and deadline <strong>cannot be changed</strong>.
              Unmet campaigns refund contributors minus proportional gas fees.
            </p>
          </div>

          {#if error}
            <div class="alert alert-error mb-4">
              <AlertCircle class="w-4 h-4 shrink-0" />
              <span class="text-sm">{error}</span>
            </div>
          {/if}

          <div class="flex justify-between">
            <button class="btn btn-ghost gap-2" onclick={prevStep}>
              <ArrowLeft class="w-4 h-4" />
              Back
            </button>
            <button
              class="btn btn-primary gap-2"
              onclick={handleSubmit}
              disabled={isSubmitting || (!deployToEthereum && !deployToAvalanche) || !companyWallet}
            >
              <Target class="w-4 h-4" />
              Deploy Contracts
            </button>
          </div>
        </div>
      {/if}

      <!-- ── Deploying ── -->
      {#if currentStep === 'deploying'}
        <div class="flex flex-col items-center justify-center py-10">
          <div class="relative mb-6">
            <div class="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            <Target class="absolute inset-0 m-auto w-8 h-8 text-primary" />
          </div>
          <h4 class="text-xl font-bold mb-2">Deploying Smart Contracts</h4>
          <p class="text-sm opacity-60 text-center max-w-sm mb-8">
            Creating your bounty and deploying escrow contracts on-chain. This typically takes 30–60 seconds.
          </p>
          <div class="space-y-3 w-full max-w-xs">
            <div class="flex items-center gap-3 text-sm">
              <Loader class="w-4 h-4 animate-spin text-primary shrink-0" />
              <span>Creating bounty record…</span>
            </div>
            {#if deployToEthereum}
              <div class="flex items-center gap-3 text-sm">
                <Loader class="w-4 h-4 animate-spin text-primary shrink-0" />
                <span>Deploying to Ethereum Sepolia…</span>
              </div>
            {/if}
            {#if deployToAvalanche}
              <div class="flex items-center gap-3 text-sm">
                <Loader class="w-4 h-4 animate-spin text-error shrink-0" />
                <span>Deploying to Avalanche Fuji…</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- ── Success ── -->
      {#if currentStep === 'success'}
        <div class="flex flex-col items-center py-6">
          <div class="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mb-4">
            <CheckCircle class="w-10 h-10 text-success" />
          </div>
          <h4 class="text-2xl font-bold mb-1">Bounty Created! 🎉</h4>
          <p class="text-sm opacity-60 text-center mb-6 max-w-sm">
            Smart contracts deployed. Investors can now contribute to
            <strong class="opacity-80">{campaignName}</strong>.
          </p>

          <div class="w-full space-y-3">
            {#if deploymentResult?.ethereumAddress}
              <div class="rounded-xl border border-primary/25 bg-primary/5 p-4">
                <div class="flex items-center gap-2 mb-2">
                  <span class="badge badge-primary badge-sm">⟠ Ethereum Sepolia</span>
                </div>
                <code class="text-xs font-mono block opacity-65 mb-3 break-all">{deploymentResult.ethereumAddress}</code>
                <div class="flex gap-2">
                  <button class="btn btn-xs btn-outline" onclick={() => navigator.clipboard?.writeText(deploymentResult.ethereumAddress)}>Copy</button>
                  <button class="btn btn-xs btn-ghost" onclick={() => viewOnExplorer('ethereum', deploymentResult.ethereumAddress)}>View on Etherscan ↗</button>
                </div>
              </div>
            {/if}
            {#if deploymentResult?.avalancheAddress}
              <div class="rounded-xl border border-error/25 bg-error/5 p-4">
                <div class="flex items-center gap-2 mb-2">
                  <span class="badge badge-error badge-sm">▲ Avalanche Fuji</span>
                </div>
                <code class="text-xs font-mono block opacity-65 mb-3 break-all">{deploymentResult.avalancheAddress}</code>
                <div class="flex gap-2">
                  <button class="btn btn-xs btn-outline" onclick={() => navigator.clipboard?.writeText(deploymentResult.avalancheAddress)}>Copy</button>
                  <button class="btn btn-xs btn-ghost" onclick={() => viewOnExplorer('avalanche', deploymentResult.avalancheAddress)}>View on Snowtrace ↗</button>
                </div>
              </div>
            {/if}
          </div>

          <p class="text-xs opacity-40 mt-6">Closing automatically…</p>
        </div>
      {/if}

    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>
{/if}
