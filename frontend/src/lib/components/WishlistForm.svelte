<script lang="ts">
  import { Plus, X, Target, AlertCircle, Euro, Rocket, Calendar, ChevronRight, ChevronLeft, Check } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { devLog } from '$lib/env';
  import { authStore } from '$lib/stores/auth';
  import { toastStore } from '$lib/stores/toast';
  import { tick } from 'svelte';
  import CreateBountyModalX402 from './CreateBountyModalX402.svelte';

  let {
    companyId,
    companyWallet,
    masterWallet = null,
    onItemAdded = () => {},
    onCreateBounty = null
  }: {
    companyId: string;
    companyWallet?: string;
    masterWallet?: any;
    onItemAdded?: (result?: any) => void;
    onCreateBounty?: ((item: any) => void) | null;
  } = $props();

  // ─── Step management ─────────────────────────────────────────
  let isFormOpen = $state(false);
  let currentStep = $state(1);
  let isSubmitting = $state(false);
  // Steps (escrow enabled):  1 Details → 2 Goal → 3 Campaign → 4 Review
  // Steps (no escrow):       1 Details → 2 Review (submit)

  // ─── Form state ───────────────────────────────────────────────
  let formData = $state({
    title: '',
    description: '',
    value: '',
    category: 'funding',
    priority: 'medium',
    enableEscrow: false,
    selectedChain: '' as '' | 'ethereum' | 'avalanche' | 'solana' | 'stellar',
    durationDays: 30,
  });

  // ─── Chain definitions ────────────────────────────────────────
  const CHAINS = [
    {
      id: 'ethereum' as const,
      name: 'Ethereum',
      network: 'Sepolia Testnet',
      symbol: 'ETH',
      colorClass: 'border-blue-500/40 bg-blue-500/5',
      selectedClass: 'border-blue-500 bg-blue-500/15 ring-2 ring-blue-500/40',
      badgeClass: 'badge-primary',
      icon: '⟠',
      isEvm: true,
      description: 'Smart contract escrow · funds forwarded to owner on success',
    },
    {
      id: 'avalanche' as const,
      name: 'Avalanche',
      network: 'Fuji Testnet',
      symbol: 'AVAX',
      colorClass: 'border-red-500/40 bg-red-500/5',
      selectedClass: 'border-red-500 bg-red-500/15 ring-2 ring-red-500/40',
      badgeClass: 'badge-error',
      icon: '🔺',
      isEvm: true,
      description: 'Smart contract escrow · fast finality, low fees',
    },
    {
      id: 'solana' as const,
      name: 'Solana',
      network: 'Devnet',
      symbol: 'SOL',
      colorClass: 'border-green-500/40 bg-green-500/5',
      selectedClass: 'border-green-500 bg-green-500/15 ring-2 ring-green-500/40',
      badgeClass: 'badge-success',
      icon: '◎',
      isEvm: false,
      description: 'Unique deposit address generated · no gas fees for setup',
    },
    {
      id: 'stellar' as const,
      name: 'Stellar',
      network: 'Testnet',
      symbol: 'XLM',
      colorClass: 'border-yellow-500/40 bg-yellow-500/5',
      selectedClass: 'border-yellow-500 bg-yellow-500/15 ring-2 ring-yellow-500/40',
      badgeClass: 'badge-warning',
      icon: '✦',
      isEvm: false,
      description: 'Unique deposit address generated · micro-transaction friendly',
    },
  ];

  // ─── Crypto prices ────────────────────────────────────────────
  let ethEurRate  = $state(3200);
  let avaxEurRate = $state(35);
  let solEurRate  = $state(150);
  let xlmEurRate  = $state(0.35);
  let isLoadingPrices = $state(false);

  // ─── Wallet balance (EVM only) ────────────────────────────────
  let evmBalance      = $state('...');
  let estimatedGas    = $state('');
  let isLoadingBalance = $state(false);
  let isEstimatingGas  = $state(false);

  // ─── X402 / payment flow ─────────────────────────────────────
  let showPaymentMethodChoice = $state(false);
  let x402ModalOpen           = $state(false);
  let pendingWishlistItem     = $state<any>(null);
  let selectedPaymentMethod   = $state<'traditional' | 'usdc'>('traditional');
  let userUsdcWallet          = $state<string | null>(null);
  let isLoadingUserWallet     = $state(false);

  // ─── Static data ──────────────────────────────────────────────
  const DURATION_PRESETS = [
    { days: 7,  label: '1 Week'   },
    { days: 14, label: '2 Weeks'  },
    { days: 30, label: '1 Month'  },
    { days: 60, label: '2 Months' },
    { days: 90, label: '3 Months' },
  ];

  const categories = [
    { value: 'funding',      label: '💰 Funding'      },
    { value: 'talent',       label: '👥 Talent'        },
    { value: 'mentorship',   label: '🎓 Mentorship'    },
    { value: 'partnerships', label: '🤝 Partnerships'  },
    { value: 'resources',    label: '🛠️ Resources'     },
    { value: 'technology',   label: '⚙️ Technology'    },
    { value: 'marketing',    label: '📢 Marketing'     },
    { value: 'other',        label: '✨ Other'          },
  ];

  const priorities = [
    { value: 'low',      label: 'Low',      color: 'badge-ghost'   },
    { value: 'medium',   label: 'Medium',   color: 'badge-info'    },
    { value: 'high',     label: 'High',     color: 'badge-warning' },
    { value: 'critical', label: 'Critical', color: 'badge-error'   },
  ];

  // ─── Derived helpers ──────────────────────────────────────────
  let selectedChainInfo = $derived(CHAINS.find(c => c.id === formData.selectedChain) ?? null);

  let totalSteps = $derived(formData.enableEscrow ? 4 : 2);

  let stepLabels = $derived(
    formData.enableEscrow
      ? ['Details', 'Goal', 'Campaign', 'Review']
      : ['Details', 'Review']
  );

  let nativeTargetAmount = $derived.by(() => {
    const eur = parseFloat(formData.value || '0');
    if (!eur || !formData.selectedChain) return null;
    switch (formData.selectedChain) {
      case 'ethereum':  return { amount: (eur / ethEurRate ).toFixed(6), symbol: 'ETH'  };
      case 'avalanche': return { amount: (eur / avaxEurRate).toFixed(4), symbol: 'AVAX' };
      case 'solana':    return { amount: (eur / solEurRate ).toFixed(4), symbol: 'SOL'  };
      case 'stellar':   return { amount: (eur / xlmEurRate ).toFixed(2), symbol: 'XLM'  };
      default:          return null;
    }
  });

  // ─── Actions ──────────────────────────────────────────────────
  function resetForm() {
    formData = {
      title: '', description: '', value: '',
      category: 'funding', priority: 'medium',
      enableEscrow: false, selectedChain: '', durationDays: 30,
    };
    currentStep    = 1;
    evmBalance     = '...';
    estimatedGas   = '';
  }

  function toggleForm() {
    isFormOpen = !isFormOpen;
    if (!isFormOpen) resetForm();
  }

  function canAdvance(): boolean {
    if (currentStep === 1) return formData.title.trim().length > 0;
    if (currentStep === 2 && formData.enableEscrow) return !!formData.value && parseFloat(formData.value) > 0;
    if (currentStep === 3) return !!formData.selectedChain;
    return true;
  }

  async function goNext() {
    if (!canAdvance()) return;

    // Step 2 without escrow → submit directly
    if (currentStep === 2 && !formData.enableEscrow) {
      await handleSubmit();
      return;
    }

    // Moving to chain step → load prices
    if (currentStep === 2 && formData.enableEscrow) {
      fetchCryptoPrices();
    }

    // Moving to review step with EVM chain → load balance + gas
    if (currentStep === 3 && selectedChainInfo?.isEvm) {
      await tick();
      await loadEvmBalance();
      await estimateGasCost();
    }

    currentStep = Math.min(currentStep + 1, totalSteps);
  }

  function goBack() {
    currentStep = Math.max(currentStep - 1, 1);
  }

  async function loadUserUsdcWallet() {
    isLoadingUserWallet = true;
    try {
      const token = $authStore.accessToken;
      if (!token) { userUsdcWallet = null; return; }
      const res  = await fetch(`${PUBLIC_API_URL}/users/usdc-wallet`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      userUsdcWallet = data.success ? (data.data?.usdcWalletAddress ?? null) : null;
    } catch { userUsdcWallet = null; }
    finally   { isLoadingUserWallet = false; }
  }

  async function fetchCryptoPrices() {
    isLoadingPrices = true;
    try {
      const res = await fetch(`${PUBLIC_API_URL}/crypto-prices`);
      if (res.ok) {
        const { data } = await res.json();
        if (data) {
          if (data.ethEur)  ethEurRate  = data.ethEur;
          if (data.avaxEur) avaxEurRate = data.avaxEur;
          if (data.solEur)  solEurRate  = data.solEur;
          if (data.xlmEur)  xlmEurRate  = data.xlmEur;
        }
      }
    } catch { /* use defaults */ }
    finally { isLoadingPrices = false; }
  }

  async function loadEvmBalance() {
    const chain  = formData.selectedChain as 'ethereum' | 'avalanche';
    const wallet = masterWallet?.ethAddress || masterWallet?.avaxAddress || companyWallet;
    if (!wallet) return;
    isLoadingBalance = true;
    try {
      const res = await fetch(`${PUBLIC_API_URL}/wallet-balance?address=${wallet}&chain=${chain}`);
      if (res.ok) {
        const d = await res.json();
        evmBalance = chain === 'ethereum' ? (d.balanceEth ?? '0') : (d.balanceAvax ?? '0');
      }
    } catch { evmBalance = '0'; }
    finally { isLoadingBalance = false; }
  }

  async function estimateGasCost() {
    if (!selectedChainInfo?.isEvm) return;
    isEstimatingGas = true;
    try {
      const res = await fetch(`${PUBLIC_API_URL}/escrow/estimate-gas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${$authStore.accessToken}` },
        body: JSON.stringify({
          companyId,
          targetAmountEth: nativeTargetAmount ? parseFloat(nativeTargetAmount.amount) : 0.5,
          durationInDays:  formData.durationDays,
          chains:          [formData.selectedChain],
        }),
      });
      if (res.ok) {
        const { data } = await res.json();
        estimatedGas = data?.[formData.selectedChain]?.estimatedGasEth ?? '';
      }
    } catch { estimatedGas = ''; }
    finally { isEstimatingGas = false; }
  }

  // ─── Main submit ──────────────────────────────────────────────
  async function handleSubmit() {
    if (!formData.title.trim()) {
      toastStore.add({ message: 'Title is required', type: 'error' });
      return;
    }
    if (formData.enableEscrow) {
      if (!formData.selectedChain) {
        toastStore.add({ message: 'Please select a blockchain network', type: 'error' });
        return;
      }
      if (!formData.value || parseFloat(formData.value) <= 0) {
        toastStore.add({ message: 'Target amount must be greater than 0', type: 'error' });
        return;
      }
      if (formData.durationDays < 1 || formData.durationDays > 365) {
        toastStore.add({ message: 'Duration must be between 1 and 365 days', type: 'error' });
        return;
      }
    }

    isSubmitting = true;
    try {
      const verified = await authStore.verify();
      if (!verified) throw new Error('Please log in again');
      const token = $authStore.accessToken;
      if (!token) throw new Error('Not authenticated');

      const payload: any = {
        title:    formData.title.trim(),
        category: formData.category,
        priority: formData.priority,
      };
      if (formData.description.trim()) payload.description = formData.description.trim();
      if (formData.value && !isNaN(parseFloat(formData.value))) payload.value = parseFloat(formData.value);

      const res    = await fetch(`${PUBLIC_API_URL}/companies/${companyId}/wishlist`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message || 'Failed to add wishlist item');

      if (!formData.enableEscrow) {
        toastStore.add({ message: '✨ Wishlist item added!', type: 'success', ttl: 3000 });
        resetForm();
        isFormOpen = false;
        onItemAdded();
        return;
      }

      pendingWishlistItem = {
        id:              result.data.id,
        title:           formData.title,
        description:     formData.description,
        value:           parseFloat(formData.value || '0'),
        targetAmountEth: nativeTargetAmount ? parseFloat(nativeTargetAmount.amount) : 0.5,
        durationDays:    Math.round(formData.durationDays),
        selectedChain:   formData.selectedChain,
        isEvm:           selectedChainInfo?.isEvm ?? false,
      };

      isSubmitting = false;
      await tick();
      await loadUserUsdcWallet();
      showPaymentMethodChoice = true;
    } catch (err: any) {
      toastStore.add({ message: err.message || 'An error occurred', type: 'error' });
    } finally {
      isSubmitting = false;
    }
  }

  async function handleDeployTraditional() {
    if (!pendingWishlistItem) return;
    isSubmitting = true;
    try {
      const token = $authStore.accessToken;
      if (!token) throw new Error('Not authenticated');

      const bountyRes  = await fetch(`${PUBLIC_API_URL}/bounties`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({
          wishlistItemId: pendingWishlistItem.id,
          targetAmountEur: pendingWishlistItem.value,
          durationInDays:  pendingWishlistItem.durationDays,
        }),
      });
      const bountyData = await bountyRes.json();
      if (!bountyData.success) throw new Error(bountyData.message || 'Failed to create bounty record');

      // Non-EVM: backend already generates deposit address — no contract deployment
      if (!pendingWishlistItem.isEvm) {
        const chainLabel = (pendingWishlistItem.selectedChain as string).toUpperCase();
        toastStore.add({
          message: `🎉 Bounty created! A unique ${chainLabel} deposit address has been generated for this item.`,
          type:    'success',
          ttl:     8000,
        });
        resetForm();
        isFormOpen = false;
        showPaymentMethodChoice = false;
        pendingWishlistItem = null;
        setTimeout(() => onItemAdded(), 800);
        return;
      }

      // EVM: deploy escrow contract
      const escrowRes  = await fetch(`${PUBLIC_API_URL}/escrow/create`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({
          wishlistItemId:      pendingWishlistItem.id,
          targetAmountEth:     pendingWishlistItem.targetAmountEth,
          durationInDays:      pendingWishlistItem.durationDays,
          chains:              [pendingWishlistItem.selectedChain],
          campaignName:        pendingWishlistItem.title,
          campaignDescription: pendingWishlistItem.description || '',
        }),
      });
      const escrowData = await escrowRes.json();
      if (!escrowData.success) throw new Error(escrowData.message || 'Failed to deploy escrow contract');

      const deployed  = escrowData.data || {};
      const addresses: Array<{ chain: string; address: string; txHash: string | null }> = [];
      if (deployed.ethereumAddress)  addresses.push({ chain: 'ethereum',  address: deployed.ethereumAddress,  txHash: deployed.ethereumTxHash  ?? null });
      if (deployed.avalancheAddress) addresses.push({ chain: 'avalanche', address: deployed.avalancheAddress, txHash: deployed.avalancheTxHash ?? null });

      if (addresses.length > 0) {
        toastStore.add({
          message: '🎉 Escrow contract deployed',
          type:    'success',
          ttl:     12000,
          group:   'contract_deploy',
          data:    { campaignName: pendingWishlistItem.title, campaignDescription: pendingWishlistItem.description || '', addresses },
        });
        setTimeout(() => onItemAdded({ addresses, campaignName: pendingWishlistItem.title }), 1000);
      } else {
        toastStore.add({ message: '🎉 Bounty deployed!', type: 'success', ttl: 5000 });
        setTimeout(() => onItemAdded(), 1000);
      }

      resetForm();
      isFormOpen            = false;
      showPaymentMethodChoice = false;
      pendingWishlistItem   = null;
    } catch (err: any) {
      toastStore.add({ message: err.message || 'Failed to deploy', type: 'error' });
    } finally {
      isSubmitting = false;
    }
  }

  function handleX402Success(result: any) {
    toastStore.add({ message: '🎉 Contracts deployed via X402 payment!', type: 'success', ttl: 8000 });
    resetForm();
    isFormOpen            = false;
    showPaymentMethodChoice = false;
    x402ModalOpen         = false;
    pendingWishlistItem   = null;
    setTimeout(() => onItemAdded(result), 1000);
  }
</script>


<div class="w-full">
  {#if !isFormOpen}
    <button class="btn btn-sm btn-outline gap-2 w-full" onclick={toggleForm}>
      <Plus class="w-4 h-4" />
      Add Wishlist Item
    </button>
  {:else}
    <div class="bg-gradient-to-br from-base-100 to-base-200 rounded-xl border border-base-300 shadow-md overflow-hidden">

      <!-- Header -->
      <div class="flex items-center justify-between px-5 pt-5 pb-3">
        <div class="flex items-center gap-2">
          <div class="p-2 bg-primary/20 rounded-lg">
            <Target class="w-4 h-4 text-primary" />
          </div>
          <h4 class="font-bold text-base">Add to Wishlist</h4>
        </div>
        <button class="btn btn-ghost btn-xs btn-circle" onclick={toggleForm} aria-label="Close form">
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Step progress bar -->
      <div class="px-5 pb-4">
        <div class="flex items-center gap-1">
          {#each stepLabels as label, i}
            {@const step = i + 1}
            {@const done = currentStep > step}
            {@const active = currentStep === step}
            <div class="flex items-center gap-1 flex-1 min-w-0">
              <div class="flex items-center gap-1.5 shrink-0">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  {done   ? 'bg-success text-success-content' :
                   active ? 'bg-primary text-primary-content' :
                            'bg-base-300 text-base-content/50'}">
                  {#if done}
                    <Check class="w-3 h-3" />
                  {:else}
                    {step}
                  {/if}
                </div>
                <span class="text-xs font-medium hidden sm:inline truncate
                  {active ? 'text-primary' : done ? 'text-success' : 'opacity-40'}">
                  {label}
                </span>
              </div>
              {#if i < stepLabels.length - 1}
                <div class="flex-1 h-0.5 mx-1 rounded-full transition-all
                  {done ? 'bg-success' : 'bg-base-300'}"></div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="px-5 pb-5 space-y-4">

        <!-- ── STEP 1: Details ─────────────────────────────────── -->
        {#if currentStep === 1}
          <div class="space-y-4">
            <p class="text-xs font-semibold uppercase opacity-50 tracking-wide">Step 1 · What are you looking for?</p>

            <div class="form-control w-full">
              <label class="label px-0 pb-1" for="w-title">
                <span class="label-text font-semibold text-sm">Title *</span>
              </label>
              <input id="w-title" type="text" bind:value={formData.title}
                placeholder="e.g., Seed funding round"
                class="input input-bordered input-sm w-full focus:ring-2 focus:ring-primary"
                disabled={isSubmitting} />
            </div>

            <div class="form-control w-full">
              <label class="label px-0 pb-1" for="w-desc">
                <span class="label-text font-semibold text-sm">Details</span>
                <span class="label-text-alt text-xs opacity-60">Optional context</span>
              </label>
              <textarea id="w-desc" bind:value={formData.description}
                placeholder="Describe what you need..."
                class="textarea textarea-bordered textarea-sm h-20 resize-none w-full focus:ring-2 focus:ring-primary"
                disabled={isSubmitting}></textarea>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="form-control w-full">
                <label class="label px-0 pb-1" for="w-cat">
                  <span class="label-text text-xs font-medium">Category</span>
                </label>
                <select id="w-cat" bind:value={formData.category}
                  class="select select-bordered select-sm w-full" disabled={isSubmitting}>
                  {#each categories as c}
                    <option value={c.value}>{c.label}</option>
                  {/each}
                </select>
              </div>
              <div class="form-control w-full">
                <label class="label px-0 pb-1" for="w-pri">
                  <span class="label-text text-xs font-medium">Priority</span>
                </label>
                <select id="w-pri" bind:value={formData.priority}
                  class="select select-bordered select-sm w-full" disabled={isSubmitting}>
                  {#each priorities as p}
                    <option value={p.value}>{p.label}</option>
                  {/each}
                </select>
              </div>
            </div>
          </div>

        <!-- ── STEP 2: Goal ───────────────────────────────────── -->
        {:else if currentStep === 2}
          <div class="space-y-4">
            <p class="text-xs font-semibold uppercase opacity-50 tracking-wide">Step 2 · Set Your Goal</p>

            <div class="form-control w-full">
              <label class="label px-0 pb-1" for="w-value">
                <span class="label-text font-semibold text-sm flex items-center gap-1">
                  <Euro class="w-4 h-4 text-success" /> Target Value
                </span>
                <span class="label-text-alt text-xs opacity-60">Amount needed in EUR</span>
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-base opacity-60">€</span>
                <input id="w-value" type="number" inputmode="decimal" bind:value={formData.value}
                  placeholder="5000" step="0.01" min="0"
                  class="input input-bordered input-sm pl-8 w-full focus:ring-2 focus:ring-primary"
                  disabled={isSubmitting} />
              </div>
              {#if formData.value && parseFloat(formData.value) > 0}
                <p class="text-xs opacity-60 mt-1">
                  €{parseFloat(formData.value).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              {/if}
            </div>

            <!-- Enable crowdfunding toggle (only shown when a value is entered) -->
            {#if formData.value && parseFloat(formData.value) > 0}
              <div class="form-control">
                <label class="label cursor-pointer justify-start gap-3 px-0 py-2">
                  <input type="checkbox" bind:checked={formData.enableEscrow}
                    class="checkbox checkbox-primary checkbox-sm" disabled={isSubmitting || !companyWallet} />
                  <div class="flex-1">
                    <span class="label-text font-semibold text-sm flex items-center gap-2">
                      <Rocket class="w-4 h-4 text-primary" />
                      Enable Blockchain Crowdfunding
                    </span>
                    <p class="text-xs opacity-60 mt-0.5">
                      Accept contributions on-chain · smart contract or deposit address per chain
                    </p>
                    {#if !companyWallet}
                      <p class="text-xs text-error mt-1">⚠️ Company needs a wallet configured first</p>
                    {/if}
                  </div>
                </label>
              </div>

              {#if formData.enableEscrow}
                <div class="alert alert-info py-2 text-xs">
                  <AlertCircle class="w-4 h-4 shrink-0" />
                  <span>You'll select the blockchain network in the next step.</span>
                </div>
              {/if}
            {/if}
          </div>

        <!-- ── STEP 3: Campaign (chain + duration) ───────────── -->
        {:else if currentStep === 3}
          <div class="space-y-4">
            <p class="text-xs font-semibold uppercase opacity-50 tracking-wide">Step 3 · Choose Network & Duration</p>

            <!-- Chain selection (radio cards) -->
            <div class="space-y-2">
              <p class="text-xs font-semibold opacity-70">Select Blockchain Network</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {#each CHAINS as chain}
                  <label class="cursor-pointer">
                    <input type="radio" class="sr-only" name="chain"
                      value={chain.id}
                      bind:group={formData.selectedChain}
                      disabled={isSubmitting} />
                    <div class="border rounded-lg p-3 transition-all
                      {formData.selectedChain === chain.id ? chain.selectedClass : chain.colorClass + ' hover:opacity-80'}">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-lg">{chain.icon}</span>
                        <div class="flex-1 min-w-0">
                          <p class="font-semibold text-sm leading-tight">{chain.name}</p>
                          <p class="text-xs opacity-60 leading-tight">{chain.network}</p>
                        </div>
                        <span class="badge {chain.badgeClass} badge-xs">{chain.symbol}</span>
                        {#if formData.selectedChain === chain.id}
                          <Check class="w-4 h-4 text-current shrink-0" />
                        {/if}
                      </div>
                      <p class="text-xs opacity-60 leading-snug">{chain.description}</p>
                    </div>
                  </label>
                {/each}
              </div>
            </div>

            <!-- Target in native currency (live preview) -->
            {#if formData.selectedChain && formData.value}
              <div class="bg-base-200 rounded-lg p-3 flex items-center justify-between">
                <span class="text-xs opacity-70">Target in {selectedChainInfo?.symbol}</span>
                {#if isLoadingPrices}
                  <span class="loading loading-spinner loading-xs"></span>
                {:else}
                  <span class="font-bold text-sm">
                    {nativeTargetAmount?.amount ?? '—'} {nativeTargetAmount?.symbol ?? ''}
                    <span class="text-xs font-normal opacity-60 ml-1">≈ €{parseFloat(formData.value).toLocaleString('de-DE', { maximumFractionDigits: 2 })}</span>
                  </span>
                {/if}
              </div>
            {/if}

            <!-- Campaign duration -->
            <div class="form-control w-full">
              <label class="label px-0 pb-1">
                <span class="label-text text-xs font-medium flex items-center gap-1">
                  <Calendar class="w-3 h-3" /> Campaign Duration
                </span>
              </label>
              <div class="grid grid-cols-5 gap-1 mb-2">
                {#each DURATION_PRESETS as p}
                  <button type="button"
                    class="btn btn-xs {formData.durationDays === p.days ? 'btn-primary' : 'btn-ghost'}"
                    onclick={() => (formData.durationDays = p.days)}
                    disabled={isSubmitting}>
                    {p.label}
                  </button>
                {/each}
              </div>
              <input type="number" bind:value={formData.durationDays} min="1" max="365"
                class="input input-bordered input-sm w-full" disabled={isSubmitting} />
              <p class="text-xs opacity-60 mt-1">
                Ends: {new Date(Date.now() + formData.durationDays * 86400000).toLocaleDateString()}
              </p>
            </div>
          </div>

        <!-- ── STEP 4: Review ─────────────────────────────────── -->
        {:else if currentStep === 4}
          <div class="space-y-3">
            <p class="text-xs font-semibold uppercase opacity-50 tracking-wide">Step 4 · Review &amp; Deploy</p>

            <div class="bg-base-200/60 rounded-lg p-4 space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="opacity-60">Title</span>
                <span class="font-semibold truncate max-w-[60%]">{formData.title}</span>
              </div>
              <div class="flex justify-between">
                <span class="opacity-60">Category</span>
                <span>{categories.find(c => c.value === formData.category)?.label ?? formData.category}</span>
              </div>
              <div class="flex justify-between">
                <span class="opacity-60">Priority</span>
                <span>{priorities.find(p => p.value === formData.priority)?.label ?? formData.priority}</span>
              </div>
              <div class="divider my-1"></div>
              <div class="flex justify-between">
                <span class="opacity-60">Target</span>
                <span class="font-semibold">
                  €{parseFloat(formData.value).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  {#if nativeTargetAmount}
                    <span class="text-xs font-normal opacity-60">≈ {nativeTargetAmount.amount} {nativeTargetAmount.symbol}</span>
                  {/if}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="opacity-60">Network</span>
                <span class="flex items-center gap-1">
                  {selectedChainInfo?.icon ?? ''}
                  {selectedChainInfo?.name ?? formData.selectedChain}
                  <span class="badge {selectedChainInfo?.badgeClass} badge-xs">{selectedChainInfo?.network}</span>
                </span>
              </div>
              <div class="flex justify-between">
                <span class="opacity-60">Duration</span>
                <span>{formData.durationDays} days · ends {new Date(Date.now() + formData.durationDays * 86400000).toLocaleDateString()}</span>
              </div>
            </div>

            <!-- EVM: wallet balance + gas info -->
            {#if selectedChainInfo?.isEvm}
              <div class="bg-base-100 rounded-lg p-3 space-y-2 border border-base-300">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold opacity-70">
                    {masterWallet ? '🔐 Master Wallet Balance (gas)' : 'Wallet Balance'}
                  </span>
                  <button type="button" class="btn btn-ghost btn-xs"
                    onclick={async () => { await loadEvmBalance(); await estimateGasCost(); }}
                    disabled={isLoadingBalance}>
                    {#if isLoadingBalance}<span class="loading loading-spinner loading-xs"></span>
                    {:else}Refresh{/if}
                  </button>
                </div>
                <div class="flex items-center gap-2">
                  <div class="flex-1 bg-base-200 rounded p-2">
                    <p class="text-xs opacity-60">{selectedChainInfo.name}</p>
                    <p class="font-semibold text-sm">{evmBalance} {selectedChainInfo.symbol}</p>
                  </div>
                  {#if estimatedGas}
                    <div class="flex-1 bg-warning/10 rounded p-2">
                      <p class="text-xs opacity-60">Est. gas</p>
                      <p class="font-semibold text-sm">{isEstimatingGas ? '…' : `~${estimatedGas} ${selectedChainInfo.symbol}`}</p>
                    </div>
                  {/if}
                </div>
                {#if masterWallet}
                  <div class="alert alert-info py-1.5">
                    <AlertCircle class="w-3 h-3 shrink-0" />
                    <p class="text-xs">Gas fees deducted from your master wallet. Campaign funds forwarded to master wallet on success.</p>
                  </div>
                {/if}
              </div>
            {:else}
              <!-- Non-EVM info -->
              <div class="alert alert-success py-2">
                <Check class="w-4 h-4 shrink-0" />
                <div class="text-xs">
                  <p class="font-semibold">No gas fees required</p>
                  <p class="opacity-80">A unique {selectedChainInfo?.name} deposit address will be generated for this bounty. Contributors send funds directly to that address.</p>
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- ── Navigation buttons ─────────────────────────────── -->
        <div class="flex gap-2 pt-1">
          {#if currentStep > 1}
            <button type="button" class="btn btn-ghost btn-sm gap-1" onclick={goBack} disabled={isSubmitting}>
              <ChevronLeft class="w-4 h-4" /> Back
            </button>
          {:else}
            <button type="button" class="btn btn-ghost btn-sm" onclick={toggleForm} disabled={isSubmitting}>
              Cancel
            </button>
          {/if}

          <div class="flex-1"></div>

          <!-- Step 2 without escrow: submit button -->
          {#if currentStep === 2 && !formData.enableEscrow}
            <button type="button"
              class="btn btn-primary btn-sm gap-1"
              onclick={handleSubmit}
              disabled={isSubmitting || !formData.title.trim()}>
              {#if isSubmitting}
                <span class="loading loading-spinner loading-xs"></span> Adding…
              {:else}
                <Plus class="w-4 h-4" /> Add Item
              {/if}
            </button>

          <!-- Step 4 (review): deploy button -->
          {:else if currentStep === 4}
            <button type="button"
              class="btn btn-primary btn-sm gap-1"
              onclick={handleSubmit}
              disabled={isSubmitting || !formData.title.trim()}>
              {#if isSubmitting}
                <span class="loading loading-spinner loading-xs"></span> Creating…
              {:else}
                <Rocket class="w-4 h-4" /> Deploy Bounty
              {/if}
            </button>

          <!-- All other steps: Next -->
          {:else}
            <button type="button"
              class="btn btn-primary btn-sm gap-1"
              onclick={goNext}
              disabled={isSubmitting || !canAdvance()}>
              Next <ChevronRight class="w-4 h-4" />
            </button>
          {/if}
        </div>

      </div><!-- /px-5 pb-5 -->
    </div>
  {/if}

  <!-- ── Payment Method Choice Modal ─────────────────────────── -->
  {#if showPaymentMethodChoice && pendingWishlistItem}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-base-100 rounded-lg shadow-2xl max-w-md w-full mx-4 border border-base-300">
        <div class="border-b border-base-300 p-6">
          <h2 class="text-xl font-bold">Choose Deployment Method</h2>
          <p class="text-sm opacity-70 mt-1">How would you like to pay for contract deployment?</p>
        </div>
        <div class="p-6 space-y-4">
          <button
            class="w-full p-4 border-2 border-base-300 rounded-lg hover:border-primary hover:bg-primary/5 transition text-left"
            onclick={() => { selectedPaymentMethod = 'traditional'; handleDeployTraditional(); }}
            disabled={isSubmitting}>
            <div class="font-semibold">
              {pendingWishlistItem.isEvm ? 'Direct Deployment' : 'Generate Deposit Address'}
            </div>
            <div class="text-sm opacity-70 mt-1">
              {pendingWishlistItem.isEvm
                ? 'Pay gas fees directly from your wallet'
                : 'Free — a unique address is derived from your master wallet'}
            </div>
            {#if pendingWishlistItem.isEvm}
              <div class="text-xs opacity-60 mt-2">
                Requires {selectedChainInfo?.symbol ?? 'native token'} for gas
              </div>
            {/if}
          </button>

          {#if pendingWishlistItem.isEvm}
            <button
              class="w-full p-4 border-2 border-accent rounded-lg bg-accent/5 hover:border-accent/70 transition text-left"
              onclick={() => { selectedPaymentMethod = 'usdc'; x402ModalOpen = true; }}
              disabled={isSubmitting || (!userUsdcWallet && !isLoadingUserWallet)}>
              <div class="font-semibold flex items-center gap-2">💳 Pay with USDC</div>
              <div class="text-sm opacity-70 mt-1">Use testnet USDC for deployment</div>
              {#if !userUsdcWallet}
                <p class="text-xs text-error mt-2">
                  No USDC wallet found. <a href="/profile" class="link link-primary">Add one in your profile</a>.
                </p>
              {/if}
            </button>
          {/if}
        </div>
        <div class="border-t border-base-300 p-6">
          <button class="btn btn-ghost btn-sm w-full"
            onclick={() => { showPaymentMethodChoice = false; pendingWishlistItem = null; isFormOpen = false; resetForm(); }}
            disabled={isSubmitting}>Cancel</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- ── X402 Modal ───────────────────────────────────────────── -->
  {#if pendingWishlistItem && selectedPaymentMethod === 'usdc'}
    <CreateBountyModalX402
      bind:isOpen={x402ModalOpen}
      wishlistItem={pendingWishlistItem}
      companyName={pendingWishlistItem.companyName || 'Company'}
      companyWallet={companyWallet}
      onSuccess={handleX402Success}
    />
  {/if}
</div>
