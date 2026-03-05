<script lang="ts">
  import {
    X,
    Target,
    CreditCard,
    CheckCircle,
    AlertCircle,
    Loader,
    Copy,
    ChevronLeft,
    ArrowRight,
    ExternalLink,
  } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { toastStore } from '$lib/stores/toast';
  import { authStore } from '$lib/stores/auth';


  // ─── Props ─────────────────────────────────────────────────────────────────
  interface WishlistItem {
    id: string;
    title: string;
    description?: string;
    value?: number;
    category?: string;
    selectedChain?: 'ethereum' | 'avalanche' | 'solana' | 'stellar';
    isEvm?: boolean;
    targetAmountEth?: number;
    durationDays?: number;
    companyName?: string;
  }

  let {
    isOpen = $bindable(false),
    wishlistItem,
    companyName,
    companyWallet,
    onSuccess = () => {},
  }: {
    isOpen: boolean;
    wishlistItem: WishlistItem;
    companyName: string;
    companyWallet?: string;
    onSuccess?: (result?: any) => void;
  } = $props();

  // ─── Payment chain definitions ─────────────────────────────────────────────
  type PaymentChain = 'ethereum' | 'avalanche' | 'solana' | 'stellar';
  type Step = 'review' | 'payment' | 'processing' | 'success';

  interface PaymentChainDef {
    id: PaymentChain;
    label: string;
    network: string;
    symbol: string;
    isEvm: boolean;
    icon: string;
    borderClass: string;
    selectedClass: string;
    walletHint: string;
    explorer?: { baseUrl: string; label: string };
  }

  const PAYMENT_CHAINS: PaymentChainDef[] = [
    {
      id: 'ethereum',
      label: 'Ethereum',
      network: 'Sepolia',
      symbol: 'USDC',
      isEvm: true,
      icon: '🔵',
      borderClass: 'border-blue-500/40 hover:border-blue-500',
      selectedClass: 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30',
      walletHint: 'Any Ethereum wallet (e.g. your platform wallet)',
      explorer: { baseUrl: 'https://sepolia.etherscan.io/tx/', label: 'Etherscan' },
    },
    {
      id: 'avalanche',
      label: 'Avalanche',
      network: 'Fuji',
      symbol: 'USDC',
      isEvm: true,
      icon: '🔴',
      borderClass: 'border-red-500/40 hover:border-red-500',
      selectedClass: 'border-red-500 bg-red-500/10 ring-1 ring-red-500/30',
      walletHint: 'Any Avalanche wallet (e.g. your platform wallet)',
      explorer: { baseUrl: 'https://testnet.snowtrace.io/tx/', label: 'Snowtrace' },
    },
    {
      id: 'solana',
      label: 'Solana',
      network: 'Devnet',
      symbol: 'USDC',
      isEvm: false,
      icon: '🟣',
      borderClass: 'border-purple-500/40 hover:border-purple-500',
      selectedClass: 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/30',
      walletHint: 'Phantom / any Solana wallet',
      explorer: { baseUrl: 'https://explorer.solana.com/tx/', label: 'Solana Explorer' },
    },
    {
      id: 'stellar',
      label: 'Stellar',
      network: 'Testnet',
      symbol: 'USDC',
      isEvm: false,
      icon: '⭐',
      borderClass: 'border-yellow-500/40 hover:border-yellow-500',
      selectedClass: 'border-yellow-500 bg-yellow-500/10 ring-1 ring-yellow-500/30',
      walletHint: 'Lobstr / Freighter',
      explorer: { baseUrl: 'https://stellar.expert/explorer/testnet/tx/', label: 'Stellar Expert' },
    },
  ];

  // Chains on which escrow contracts will be deployed — always EVM only.
  // If the wishlist item has a specific EVM chain set use that; otherwise deploy on both.
  function resolveDeploymentChains(): ('ethereum' | 'avalanche')[] {
    const chain = wishlistItem.selectedChain;
    if (chain === 'ethereum' || chain === 'avalanche') return [chain];
    // solana / stellar / undefined → deploy on both EVM chains
    return ['ethereum', 'avalanche'];
  }

  const BOUNTY_CHAIN_LABELS: Record<string, string> = {
    avalanche: 'Avalanche Fuji (escrow contract)',
    solana: 'Solana (deposit address)',
    stellar: 'Stellar (deposit address)',
  };

  const PLATFORM_FEE_USDC = 10;

  // ─── State ─────────────────────────────────────────────────────────────────
  let currentStep = $state<Step>('review');

  let selectedPaymentChain = $state<PaymentChain>(
    PAYMENT_CHAINS.some((c) => c.id === wishlistItem.selectedChain)
      ? (wishlistItem.selectedChain as PaymentChain)
      : 'ethereum',
  );

  let selectedChainDef = $derived(PAYMENT_CHAINS.find((c) => c.id === selectedPaymentChain)!);

  let isLoadingBalance = $state(false);
  let manualTxHash = $state('');
  let platformAddress = $state('');
  let userWalletAddress = $state('');
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);
  let deploymentResult = $state<any>(null);
  let paymentTxHash = $state<string | null>(null);
  let pollingStatus = $state<string>('Queuing deployment…');

  const STEP_DISPLAY = ['Review', 'Pay', 'Processing', 'Done'];
  const STEP_KEYS: Step[] = ['review', 'payment', 'processing', 'success'];
  let stepIndex = $derived(STEP_KEYS.indexOf(currentStep) + 1);

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function close() {
    if (!isSubmitting) {
      isOpen = false;
      setTimeout(reset, 300);
    }
  }

  function reset() {
    currentStep = 'review';
    selectedPaymentChain = PAYMENT_CHAINS.some((c) => c.id === wishlistItem.selectedChain)
      ? (wishlistItem.selectedChain as PaymentChain)
      : 'ethereum';
    isLoadingBalance = false;
    manualTxHash = '';
    platformAddress = '';
    userWalletAddress = '';
    isSubmitting = false;
    error = null;
    deploymentResult = null;
    paymentTxHash = null;
    pollingStatus = 'Queuing deployment…';
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    toastStore.add({ message: 'Copied!', type: 'success', ttl: 2000 });
  }

  // ─── Payment flow ──────────────────────────────────────────────────────────
  async function goToPayment() {
    error = null;
    currentStep = 'payment';
    await loadPaymentInfo();
  }

  async function loadPaymentInfo() {
    isLoadingBalance = true;
    error = null;
    try {
      // Fetch platform USDC receiver address
      const res = await fetch(`${PUBLIC_API_URL}/payments/info/${selectedPaymentChain}`);
      const data = await res.json();
      if (data.success && data.data?.platformReceiver) {
        platformAddress = data.data.platformReceiver;
      } else if (data.data?.address) {
        platformAddress = data.data.address;
      }

      // Fetch user's platform wallet address for the selected chain
      if ($authStore.accessToken) {
        const walletRes = await fetch(`${PUBLIC_API_URL}/wallet/addresses`, {
          headers: { Authorization: `Bearer ${$authStore.accessToken}` },
        });
        const walletData = await walletRes.json();
        if (walletData.success && walletData.data) {
          const addressMap: Record<string, string | null> = {
            ethereum: walletData.data.ethAddress ?? null,
            avalanche: walletData.data.avaxAddress ?? null,
            solana: walletData.data.solanaAddress ?? null,
            stellar: walletData.data.stellarAddress ?? null,
          };
          userWalletAddress = addressMap[selectedPaymentChain] ?? '';
        }
      }
    } catch (e: any) {
      error = 'Failed to load payment details. Please try again.';
      console.error('loadPaymentInfo:', e);
    } finally {
      isLoadingBalance = false;
    }
  }

  // EVM path: use stored master wallet — no on-chain USDC tx required
  async function handlePlatformWalletPayment() {
    isSubmitting = true;
    error = null;
    pollingStatus = 'Queuing deployment…';
    currentStep = 'processing';
    try {
      // Step 1: queue the deployment job
      const res = await fetch(`${PUBLIC_API_URL}/payments/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${$authStore.accessToken}`,
        },
        body: JSON.stringify({
          wishlistItemId: wishlistItem.id,
          usdcAmount: PLATFORM_FEE_USDC,
          chain: selectedPaymentChain as 'ethereum' | 'avalanche',
          deploymentChains: resolveDeploymentChains(),
          targetAmountEth: wishlistItem.targetAmountEth ?? 0.5,
          durationInDays: wishlistItem.durationDays ?? 30,
          campaignName: wishlistItem.title,
          campaignDescription: wishlistItem.description ?? '',
          paymentMethod: 'master-wallet',
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? 'Failed to register payment');

      const { paymentId, jobId } = data.data as { paymentId: string; jobId: string };

      // Step 2: poll until the worker finishes deploying contracts
      const contracts = await pollUntilDeployed(jobId, paymentId);

      // Step 3: surface results
      deploymentResult = contracts;
      currentStep = 'success';
      toastStore.add({ message: '🎉 Contracts deployed successfully!', type: 'success', ttl: 8000 });
      setTimeout(() => {
        onSuccess(contracts);
        close();
      }, 4000);
    } catch (e: any) {
      error = e.message ?? 'Submission failed. Please try again.';
      currentStep = 'payment';
    } finally {
      isSubmitting = false;
    }
  }

  /**
   * Poll GET /payments/job/:jobId until 'completed' or 'failed'.
   * Returns the deployed contract addresses in the format CompanyManager expects.
   */
  async function pollUntilDeployed(
    jobId: string,
    paymentId: string,
  ): Promise<{ ethereumAddress?: string; avalancheAddress?: string }> {
    const MAX_ATTEMPTS = 30; // ~2 minutes
    const INTERVAL_MS = 4000;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
      pollingStatus = `Deploying contracts… (${i + 1}/${MAX_ATTEMPTS})`;

      const jobRes = await fetch(`${PUBLIC_API_URL}/payments/job/${jobId}`);
      const jobData = await jobRes.json();
      const status: string = jobData.data?.status ?? 'unknown';

      if (status === 'completed') {
        pollingStatus = 'Finalising…';
        // Fetch payment record to get contract addresses
        const payRes = await fetch(`${PUBLIC_API_URL}/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${$authStore.accessToken}` },
        });
        const payData = await payRes.json();
        const contracts = payData.data?.deployedContracts ?? {};
        return {
          ethereumAddress: contracts.ethereum ?? undefined,
          avalancheAddress: contracts.avalanche ?? undefined,
        };
      }

      if (status === 'failed') {
        throw new Error(
          jobData.data?.error ||
            'Contract deployment failed. Please contact support.',
        );
      }
      // Any other status (waiting, active, delayed) → keep polling
    }
    throw new Error('Deployment timed out. The contracts may still deploy — check back shortly.');
  }

  async function handleManualPayment() {
    if (!manualTxHash.trim()) {
      error = 'Please paste your transaction hash / ID.';
      return;
    }
    isSubmitting = true;
    error = null;
    paymentTxHash = manualTxHash.trim();
    await submitPayment(paymentTxHash);
    isSubmitting = false;
  }

  async function submitPayment(txHash: string) {
    currentStep = 'processing';
    try {
      const res = await fetch(`${PUBLIC_API_URL}/payments/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${$authStore.accessToken}`,
        },
        body: JSON.stringify({
          wishlistItemId: wishlistItem.id,
          usdcTxHash: txHash,
          usdcAmount: PLATFORM_FEE_USDC,
          chain: selectedPaymentChain,
          deploymentChains: resolveDeploymentChains(),
          targetAmountEth: wishlistItem.targetAmountEth ?? 0.5,
          durationInDays: wishlistItem.durationDays ?? 30,
          campaignName: wishlistItem.title,
          campaignDescription: wishlistItem.description ?? '',
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? 'Failed to register payment');
      deploymentResult = data.data;
      currentStep = 'success';
      toastStore.add({ message: '🎉 Bounty created successfully!', type: 'success', ttl: 8000 });
      setTimeout(() => {
        onSuccess(deploymentResult);
        close();
      }, 4000);
    } catch (e: any) {
      error = e.message ?? 'Submission failed. Please try again.';
      currentStep = 'payment';
    }
  }
</script>

{#if isOpen}
  <div class="modal modal-open overflow-y-auto" role="dialog">
    <div class="modal-box max-w-lg p-0 overflow-y-auto max-h-[90vh]">

      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-base-300">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
            <Target class="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 class="font-bold text-base leading-tight">Pay with USDC</h3>
            <p class="text-xs opacity-60">Platform deploys on your behalf · ${PLATFORM_FEE_USDC} flat fee</p>
          </div>
        </div>
        <button class="btn btn-sm btn-circle btn-ghost" onclick={close} disabled={isSubmitting}>
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Step progress -->
      <div class="px-6 pt-4 pb-2">
        <div class="flex items-center">
          {#each STEP_DISPLAY as label, i}
            {@const done = stepIndex > i + 1}
            {@const active = stepIndex === i + 1}
            <div class="flex items-center {i < STEP_DISPLAY.length - 1 ? 'flex-1' : ''}">
              <div class="flex items-center gap-1.5 shrink-0">
                <div
                  class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
                    {done ? 'bg-success text-success-content' : active ? 'bg-primary text-primary-content' : 'bg-base-300 text-base-content/40'}"
                >
                  {#if done}
                    <CheckCircle class="w-3.5 h-3.5" />
                  {:else}
                    {i + 1}
                  {/if}
                </div>
                <span class="text-xs font-medium {active ? 'text-primary' : done ? 'text-success' : 'opacity-40'}">{label}</span>
              </div>
              {#if i < STEP_DISPLAY.length - 1}
                <div class="flex-1 h-px mx-2 {done ? 'bg-success' : 'bg-base-300'}"></div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="px-6 pb-6 pt-3">

        <!-- ══ Step 1: Review ══════════════════════════════════════════════════ -->
        {#if currentStep === 'review'}
          <div class="space-y-4">

            <!-- Bounty summary card -->
            <div class="bg-base-200/60 rounded-xl p-4 space-y-2.5 border border-base-300">
              <p class="text-xs font-semibold uppercase opacity-50 tracking-wide">Campaign Summary</p>
              <div class="flex justify-between items-start gap-3">
                <span class="text-xs opacity-60 shrink-0">Campaign</span>
                <span class="text-sm font-semibold text-right">{wishlistItem.title}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-xs opacity-60">Company</span>
                <span class="text-sm">{companyName}</span>
              </div>
              {#if wishlistItem.value}
                <div class="flex justify-between items-center">
                  <span class="text-xs opacity-60">Goal</span>
                  <span class="text-sm font-bold text-success">
                    €{wishlistItem.value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              {/if}
              {#if wishlistItem.selectedChain}
                <div class="flex justify-between items-center">
                  <span class="text-xs opacity-60">Deploys on</span>
                  <span class="text-sm">{BOUNTY_CHAIN_LABELS[wishlistItem.selectedChain] ?? wishlistItem.selectedChain}</span>
                </div>
              {/if}
              {#if wishlistItem.durationDays}
                <div class="flex justify-between items-center">
                  <span class="text-xs opacity-60">Duration</span>
                  <span class="text-sm">{wishlistItem.durationDays} days</span>
                </div>
              {/if}
            </div>

            <!-- Platform fee -->
            <div class="bg-primary/5 border border-primary/20 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p class="text-sm font-semibold">Platform Fee</p>
                <p class="text-xs opacity-60 mt-0.5">Covers deployment & registration</p>
              </div>
              <div class="text-right">
                <p class="text-2xl font-bold text-primary">${PLATFORM_FEE_USDC}</p>
                <p class="text-xs opacity-60">USDC</p>
              </div>
            </div>

            <!-- Choose payment network -->
            <div>
              <p class="text-xs font-semibold uppercase opacity-50 tracking-wide mb-3">Pay USDC from which network?</p>
              <div class="grid grid-cols-2 gap-2">
                {#each PAYMENT_CHAINS as chain}
                  <button
                    type="button"
                    class="relative rounded-xl border-2 p-3 text-left transition-all
                      {selectedPaymentChain === chain.id
                        ? chain.selectedClass
                        : 'border-base-300/60 ' + chain.borderClass}"
                    onclick={() => (selectedPaymentChain = chain.id)}
                  >
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-lg leading-none">{chain.icon}</span>
                      <span class="font-semibold text-sm">{chain.label}</span>
                    </div>
                    <p class="text-xs opacity-60">{chain.symbol} · {chain.network}</p>
                    <span class="absolute top-2 right-2 badge badge-xs badge-ghost">
                      {chain.network}
                    </span>
                  </button>
                {/each}
              </div>

              <p class="text-xs opacity-60 mt-2 flex items-center gap-1">
                <CreditCard class="w-3 h-3" />
                Send USDC from {selectedChainDef?.walletHint ?? 'your wallet'} and paste the transaction ID.
              </p>
            </div>

            <!-- Actions -->
            <div class="flex gap-2 pt-1">
              <button type="button" class="btn btn-ghost btn-sm flex-1" onclick={close}>
                Cancel
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm flex-1 gap-2"
                onclick={goToPayment}
              >
                Continue
                <ArrowRight class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        {/if}

        <!-- ══ Step 2: Payment ═════════════════════════════════════════════════ -->
        {#if currentStep === 'payment'}
          <div class="space-y-4">

            <!-- Chain context -->
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="btn btn-ghost btn-xs gap-1"
                onclick={() => (currentStep = 'review')}
                disabled={isSubmitting}
              >
                <ChevronLeft class="w-3.5 h-3.5" />
                Back
              </button>
              <span class="text-lg leading-none">{selectedChainDef?.icon}</span>
              <span class="text-sm font-semibold">{selectedChainDef?.label} USDC</span>
              <span class="badge badge-xs badge-ghost">{selectedChainDef?.network}</span>
            </div>

            <!-- Amount to send -->
            <div class="bg-base-200/60 rounded-xl p-4 border border-base-300">
              <p class="text-xs opacity-60 mb-0.5">Amount to send</p>
              <p class="text-2xl font-bold">
                ${PLATFORM_FEE_USDC}
                <span class="text-base font-normal opacity-60">USDC</span>
              </p>
            </div>

            <!-- User's platform wallet for this chain -->
            {#if userWalletAddress}
              <div class="bg-base-200/60 rounded-xl p-4 border border-base-300">
                <p class="text-xs opacity-60 mb-2 font-semibold">
                  {selectedChainDef?.isEvm ? 'Your platform wallet' : 'Your sending address'}
                  <span class="opacity-60">({selectedChainDef?.label})</span>
                </p>
                <div class="flex items-center gap-2 bg-base-200 rounded-lg p-2">
                  <code class="text-xs flex-1 break-all">
                    {userWalletAddress.length > 22
                      ? userWalletAddress.slice(0, 10) + '…' + userWalletAddress.slice(-8)
                      : userWalletAddress}
                  </code>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs shrink-0"
                    onclick={() => copyToClipboard(userWalletAddress)}
                  >
                    <Copy class="w-3 h-3" />
                  </button>
                </div>
                {#if !selectedChainDef?.isEvm}
                  <p class="text-xs opacity-50 mt-2">Send USDC from this address in your {selectedChainDef?.label} wallet app, then paste the transaction ID below.</p>
                {/if}
              </div>
            {/if}

            <!-- EVM: one-click platform wallet payment -->
            {#if selectedChainDef?.isEvm && userWalletAddress}
              <div class="space-y-2">
                <button
                  type="button"
                  class="btn btn-primary btn-sm w-full gap-2"
                  onclick={handlePlatformWalletPayment}
                  disabled={isSubmitting}
                >
                  {#if isSubmitting}
                    <span class="loading loading-spinner loading-xs"></span>
                    Processing…
                  {:else}
                    <CheckCircle class="w-3.5 h-3.5" />
                    Pay ${PLATFORM_FEE_USDC} USDC from platform wallet
                  {/if}
                </button>
                <p class="text-xs text-center opacity-50">
                  The platform debits ${PLATFORM_FEE_USDC} USDC from your {selectedChainDef.label} wallet on your behalf.
                </p>
                <div class="divider text-xs my-0 opacity-40">or pay from an external wallet</div>
              </div>
            {/if}

            <!-- Manual send flow (all chains) -->
            <div class="space-y-3">
              <div class="alert alert-info py-3">
                <AlertCircle class="w-4 h-4 shrink-0" />
                <div class="text-xs">
                  <p class="font-semibold mb-1">
                    {selectedChainDef?.isEvm && userWalletAddress
                      ? 'Or pay from an external wallet:'
                      : `How to pay with ${selectedChainDef?.label} USDC:`}
                  </p>
                  <ol class="list-decimal list-inside space-y-0.5 opacity-80">
                    <li>Go to your {selectedChainDef?.walletHint}</li>
                    <li>Send exactly <strong>${PLATFORM_FEE_USDC} USDC</strong> to the address below</li>
                    <li>Paste the transaction ID here and click Confirm</li>
                  </ol>
                </div>
              </div>

              {#if isLoadingBalance}
                <div class="flex items-center gap-2 text-xs opacity-60">
                  <Loader class="w-3 h-3 animate-spin" />
                  Loading platform address…
                </div>
              {:else if platformAddress}
                <div class="bg-base-200/60 rounded-xl p-4 border border-base-300">
                  <p class="text-xs opacity-60 mb-2 font-semibold">
                    Platform {selectedChainDef?.label} USDC address
                    <span class="opacity-60">({selectedChainDef?.network})</span>
                  </p>
                  <div class="flex items-center gap-2 bg-base-200 rounded-lg p-2">
                    <code class="text-xs flex-1 break-all">{platformAddress}</code>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs shrink-0"
                      onclick={() => copyToClipboard(platformAddress)}
                    >
                      <Copy class="w-3 h-3" />
                    </button>
                  </div>
                  <p class="text-xs text-success font-bold mt-2">Amount: ${PLATFORM_FEE_USDC}.00 USDC</p>
                </div>
              {:else if !(selectedChainDef?.isEvm && userWalletAddress)}
                <div class="alert alert-warning py-2">
                  <AlertCircle class="w-4 h-4 shrink-0" />
                  <p class="text-xs">
                    Platform address not available. Please go back and try again.
                  </p>
                </div>
              {/if}

              <!-- Transaction hash input -->
              <div class="form-control">
                <label class="label px-0 pb-1" for="manual-tx-hash">
                  <span class="label-text text-xs font-semibold">Transaction ID / Hash</span>
                  <span class="label-text-alt text-xs opacity-50">Paste after sending</span>
                </label>
                <input
                  id="manual-tx-hash"
                  type="text"
                  class="input input-bordered input-sm font-mono text-xs"
                  placeholder={selectedChainDef?.id === 'solana'
                    ? '5QwB3xY…txId'
                    : selectedChainDef?.id === 'stellar'
                    ? 'a1b2c3…hash'
                    : '0xabc123…hash'}
                  bind:value={manualTxHash}
                  disabled={isSubmitting}
                />
              </div>

              {#if error}
                <div class="alert alert-error py-2">
                  <AlertCircle class="w-4 h-4 shrink-0" />
                  <span class="text-xs">{error}</span>
                </div>
              {/if}

              <div class="flex gap-2">
                <button
                  type="button"
                  class="btn btn-ghost btn-sm flex-1"
                  onclick={() => (currentStep = 'review')}
                  disabled={isSubmitting}
                >
                  Back
                </button>
                <button
                  type="button"
                  class="btn btn-primary btn-sm flex-1 gap-2"
                  onclick={handleManualPayment}
                  disabled={isSubmitting || !manualTxHash.trim() || !platformAddress}
                >
                  {#if isSubmitting}
                    <span class="loading loading-spinner loading-xs"></span>
                    Submitting…
                  {:else}
                    <CheckCircle class="w-3.5 h-3.5" />
                    Confirm Payment
                  {/if}
                </button>
              </div>
            </div>
          </div>
        {/if}

        <!-- ══ Step 3: Processing ══════════════════════════════════════════════ -->
        {#if currentStep === 'processing'}
          <div class="flex flex-col items-center justify-center py-10 gap-5">
            <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader class="w-8 h-8 text-primary animate-spin" />
            </div>
            <div class="text-center">
              <h4 class="text-lg font-bold">Deploying Contracts…</h4>
              <p class="text-sm opacity-60 mt-1">{pollingStatus}</p>
              <p class="text-xs opacity-40 mt-2">Broadcasting to blockchain. This can take 1–2 minutes.</p>
            </div>

            {#if paymentTxHash}
              <div class="bg-base-200 rounded-lg p-3 w-full">
                <p class="text-xs opacity-60 mb-1">Payment transaction</p>
                <div class="flex items-center gap-2">
                  <code class="text-xs flex-1 break-all opacity-80">{paymentTxHash}</code>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    onclick={() => copyToClipboard(paymentTxHash!)}
                  >
                    <Copy class="w-3 h-3" />
                  </button>
                  {#if selectedChainDef?.explorer}
                    <a
                      href="{selectedChainDef.explorer.baseUrl}{paymentTxHash}"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn btn-ghost btn-xs"
                    >
                      <ExternalLink class="w-3 h-3" />
                    </a>
                  {/if}
                </div>
              </div>
            {/if}

            <ul class="space-y-2 text-sm w-full">
              <li class="flex items-center gap-2">
                <CheckCircle class="w-4 h-4 text-success shrink-0" />
                <span>USDC payment confirmed</span>
              </li>
              <li class="flex items-center gap-2">
                <Loader class="w-4 h-4 animate-spin shrink-0 text-primary" />
                <span>Registering with platform…</span>
              </li>
              <li class="flex items-center gap-2 opacity-40">
                <Loader class="w-4 h-4 animate-spin shrink-0" />
                <span>
                  {wishlistItem.isEvm ? 'Queuing contract deployment…' : 'Generating deposit address…'}
                </span>
              </li>
            </ul>

            <p class="text-xs opacity-40">This usually takes a few seconds…</p>
          </div>
        {/if}

        <!-- ══ Step 4: Success ═════════════════════════════════════════════════ -->
        {#if currentStep === 'success'}
          <div class="flex flex-col items-center justify-center py-8 gap-4">
            <div class="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
              <CheckCircle class="w-10 h-10 text-success" />
            </div>
            <div class="text-center">
              <h4 class="text-xl font-bold">Bounty Created! 🎉</h4>
              <p class="text-sm opacity-60 mt-1 max-w-xs">
                {wishlistItem.isEvm
                  ? 'Contracts are being deployed. Investors can contribute shortly.'
                  : 'Your deposit address is ready. Share it to start receiving contributions.'}
              </p>
            </div>

            {#if deploymentResult}
              <div class="w-full space-y-2">
                {#if deploymentResult.ethereumAddress}
                  <div class="bg-base-200 rounded-lg p-3">
                    <p class="text-xs opacity-60 mb-1">🔵 Ethereum Sepolia contract</p>
                    <code class="text-xs break-all">{deploymentResult.ethereumAddress}</code>
                  </div>
                {/if}
                {#if deploymentResult.avalancheAddress}
                  <div class="bg-base-200 rounded-lg p-3">
                    <p class="text-xs opacity-60 mb-1">🔴 Avalanche Fuji contract</p>
                    <code class="text-xs break-all">{deploymentResult.avalancheAddress}</code>
                  </div>
                {/if}
                {#if deploymentResult.solanaEscrowAddress}
                  <div class="bg-base-200 rounded-lg p-3">
                    <p class="text-xs opacity-60 mb-1">🟣 Solana deposit address</p>
                    <code class="text-xs break-all">{deploymentResult.solanaEscrowAddress}</code>
                  </div>
                {/if}
                {#if deploymentResult.stellarEscrowAddress}
                  <div class="bg-base-200 rounded-lg p-3">
                    <p class="text-xs opacity-60 mb-1">⭐ Stellar deposit address</p>
                    <code class="text-xs break-all">{deploymentResult.stellarEscrowAddress}</code>
                  </div>
                {/if}
              </div>
            {/if}

            <p class="text-xs opacity-40">Closing automatically…</p>
          </div>
        {/if}

        <!-- Global error outside payment step -->
        {#if error && currentStep !== 'payment'}
          <div class="alert alert-error mt-4 py-2">
            <AlertCircle class="w-4 h-4 shrink-0" />
            <span class="text-xs">{error}</span>
          </div>
        {/if}

      </div>
    </div>

    <div
      class="modal-backdrop"
      role="button"
      tabindex="0"
      onclick={close}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') close();
      }}
    ></div>
  </div>
{/if}
