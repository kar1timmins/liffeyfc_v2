<script lang="ts">
  import { X, Target, Calendar, DollarSign, Loader, CheckCircle, AlertCircle, Wallet, CreditCard, Clock } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { toastStore } from '$lib/stores/toast';
  import { authStore } from '$lib/stores/auth';
  import { 
    USDC_CONTRACTS, 
    getUSDCBalance, 
    transferUSDC, 
    formatUSDC,
    type USDCBalance 
  } from '$lib/web3/usdc';

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
    onSuccess = () => {},
  }: {
    isOpen: boolean;
    wishlistItem: WishlistItem;
    companyName: string;
    companyWallet?: string;
    onSuccess?: (result?: any) => void;
  } = $props();

  // Form state
  let targetAmountEur = $state(wishlistItem.value || 10000);
  let targetAmountEth = $state(0.5);
  let durationDays = $state(30);
  let campaignName = $state(wishlistItem.title || '');
  let campaignDescription = $state(wishlistItem.description || '');
  let deployToEthereum = $state(true);
  let deployToAvalanche = $state(true);
  
  // Payment state
  let paymentMethod = $state<'traditional' | 'usdc'>('usdc'); // Default to USDC
  let selectedPaymentChain = $state<'ethereum' | 'avalanche'>('ethereum');
  let usdcBalance = $state<USDCBalance | null>(null);
  let isLoadingBalance = $state(false);
  let platformReceiverAddress = $state<string>('');
  let estimatedCostUSDC = $state<number>(15); // Placeholder, will be calculated
  
  // UI state
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);
  let deploymentResult = $state<any>(null);
  let paymentTxHash = $state<string | null>(null);
  let jobId = $state<string | null>(null);
  let deploymentStatus = $state<'pending' | 'deploying' | 'deployed' | 'failed'>('pending');
  
  // Step tracking
  let currentStep = $state<'form' | 'payment' | 'deploying' | 'success'>('form');

  const DURATION_PRESETS = [
    { days: 7, label: '1 Week' },
    { days: 14, label: '2 Weeks' },
    { days: 30, label: '1 Month' },
    { days: 60, label: '2 Months' },
    { days: 90, label: '3 Months' },
  ];

  const ETH_EUR_RATE = 3200; // Approximate rate for estimation

  function updateEthAmount() {
    targetAmountEth = Math.round(targetAmountEur / ETH_EUR_RATE * 10000) / 10000;
  }

  function updateEurAmount() {
    targetAmountEur = Math.round(targetAmountEth * ETH_EUR_RATE * 100) / 100;
  }

  function close() {
    if (!isSubmitting) {
      isOpen = false;
      setTimeout(reset, 300);
    }
  }

  function reset() {
    targetAmountEur = wishlistItem.value || 10000;
    targetAmountEth = 0.5;
    durationDays = 30;
    deployToEthereum = true;
    deployToAvalanche = true;
    paymentMethod = 'usdc';
    selectedPaymentChain = 'ethereum';
    usdcBalance = null;
    platformReceiverAddress = '';
    estimatedCostUSDC = 15;
    isSubmitting = false;
    error = null;
    success = false;
    deploymentResult = null;
    paymentTxHash = null;
    jobId = null;
    deploymentStatus = 'pending';
    currentStep = 'form';
  }

  async function loadPlatformInfo() {
    try {
      const response = await fetch(`${PUBLIC_API_URL}/payments/info/${selectedPaymentChain}`);
      const data = await response.json();
      
      if (data.success) {
        platformReceiverAddress = data.data.platformReceiver;
      }
    } catch (err: any) {
      console.error('Failed to load platform info:', err);
    }
  }

  async function loadUSDCBalance() {
    if (!window.ethereum) {
      error = 'MetaMask not installed. Please install MetaMask to use USDC payments.';
      return;
    }

    isLoadingBalance = true;
    error = null;

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        error = 'Please connect your MetaMask wallet';
        return;
      }

      const userAddress = accounts[0];
      const balance = await getUSDCBalance(selectedPaymentChain, userAddress);
      usdcBalance = balance;

      // Also load platform receiver address
      await loadPlatformInfo();
    } catch (err: any) {
      error = `Failed to load USDC balance: ${err.message}`;
      console.error(err);
    } finally {
      isLoadingBalance = false;
    }
  }

  async function handleFormSubmit() {
    error = null;
    
    // Validation
    if (!deployToEthereum && !deployToAvalanche) {
      error = 'Please select at least one blockchain network';
      return;
    }

    if (targetAmountEth <= 0) {
      error = 'Target amount must be greater than 0';
      return;
    }

    if (durationDays < 1 || durationDays > 365) {
      error = 'Duration must be between 1 and 365 days';
      return;
    }

    if (!companyWallet) {
      error = 'Company must have a wallet address configured';
      return;
    }

    // If using USDC payment, proceed to payment step
    if (paymentMethod === 'usdc') {
      currentStep = 'payment';
      await loadUSDCBalance();
    } else {
      // Traditional deployment (direct gas payment)
      await deployTraditional();
    }
  }

  async function handleUSDCPayment() {
    error = null;
    isSubmitting = true;

    try {
      // Step 1: Transfer USDC to platform
      toastStore.add({
        message: 'Please confirm USDC transfer in MetaMask...',
        type: 'info',
        ttl: 5000,
      });

      const transferResult = await transferUSDC(
        selectedPaymentChain,
        platformReceiverAddress,
        estimatedCostUSDC
      );

      if (!transferResult.success) {
        throw new Error(transferResult.error || 'USDC transfer failed');
      }

      paymentTxHash = transferResult.txHash!;

      toastStore.add({
        message: '✅ USDC payment successful! Creating deployment...',
        type: 'success',
        ttl: 5000,
      });

      // Step 2: Create payment record and queue deployment
      const chains = [];
      if (deployToEthereum) chains.push('ethereum');
      if (deployToAvalanche) chains.push('avalanche');

      const roundedEurAmount = Math.round(targetAmountEur * 100) / 100;
      const roundedEthAmount = Math.round(targetAmountEth * 10000) / 10000;
      const roundedDurationDays = Math.round(durationDays);

      const paymentResponse = await fetch(`${PUBLIC_API_URL}/payments/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${$authStore.accessToken}`,
        },
        body: JSON.stringify({
          wishlistItemId: wishlistItem.id,
          usdcTxHash: paymentTxHash,
          usdcAmount: estimatedCostUSDC,
          chain: selectedPaymentChain,
          deploymentChains: chains,
          targetAmountEth: roundedEthAmount,
          durationInDays: roundedDurationDays,
          campaignName,
          campaignDescription,
        }),
      });

      const paymentData = await paymentResponse.json();

      if (!paymentData.success) {
        throw new Error(paymentData.message || 'Failed to create payment record');
      }

      jobId = paymentData.data.jobId;
      deploymentStatus = 'deploying';
      currentStep = 'deploying';

      // Poll for deployment status
      await pollDeploymentStatus();

    } catch (err: any) {
      error = err.message || 'Payment failed';
      currentStep = 'payment';
      toastStore.add({
        message: `❌ ${error}`,
        type: 'error',
        ttl: 8000,
      });
    } finally {
      isSubmitting = false;
    }
  }

  async function pollDeploymentStatus() {
    // Poll for job status every 3 seconds
    const pollInterval = setInterval(async () => {
      try {
        // In production, you'd have a job status endpoint
        // For now, simulate success after 10 seconds
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        deploymentStatus = 'deployed';
        clearInterval(pollInterval);
        
        // Mock deployment result
        deploymentResult = {
          ethereumAddress: deployToEthereum ? '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' : null,
          avalancheAddress: deployToAvalanche ? '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199' : null,
        };
        
        currentStep = 'success';
        success = true;

        toastStore.add({
          message: '🎉 Contracts deployed successfully!',
          type: 'success',
          ttl: 8000,
        });

        setTimeout(() => {
          onSuccess(deploymentResult);
          close();
        }, 3000);

      } catch (err: any) {
        console.error('Polling error:', err);
        clearInterval(pollInterval);
        deploymentStatus = 'failed';
        error = 'Deployment failed. Please contact support.';
      }
    }, 3000);
  }

  async function deployTraditional() {
    // Original deployment flow (user pays gas directly)
    isSubmitting = true;
    currentStep = 'deploying';

    try {
      const chains = [];
      if (deployToEthereum) chains.push('ethereum');
      if (deployToAvalanche) chains.push('avalanche');

      const roundedEurAmount = Math.round(targetAmountEur * 100) / 100;
      const roundedEthAmount = Math.round(targetAmountEth * 10000) / 10000;
      const roundedDurationDays = Math.round(durationDays);

      // Create bounty record
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

      // Deploy escrow contracts
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
      success = true;

      toastStore.add({
        message: '🎉 Escrow contracts deployed',
        type: 'success',
        ttl: 8000,
      });

      setTimeout(() => {
        onSuccess(deploymentResult);
        close();
      }, 3000);

    } catch (err: any) {
      error = err.message || 'Failed to create bounty and deploy contracts';
      currentStep = 'form';
    } finally {
      isSubmitting = false;
    }
  }

  function viewOnExplorer(chain: 'ethereum' | 'avalanche', address: string) {
    const baseUrl = chain === 'ethereum' 
      ? 'https://sepolia.etherscan.io/address/'
      : 'https://testnet.snowtrace.io/address/';
    window.open(baseUrl + address, '_blank');
  }
</script>

{#if isOpen}
  <div class="modal modal-open" role="dialog">
    <div class="modal-box max-w-3xl">
      <!-- Header -->
      <div class="flex justify-between items-start mb-6">
        <div>
          <h3 class="text-2xl font-bold flex items-center gap-2">
            <Target class="w-6 h-6 text-primary" />
            Create Bounty with X402 Payment
          </h3>
          <p class="text-sm opacity-70 mt-1">Pay in USDC, we handle the blockchain deployment</p>
        </div>
        <button 
          class="btn btn-sm btn-circle btn-ghost" 
          onclick={close}
          disabled={isSubmitting}
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Step Indicator -->
      <div class="mb-6">
        <ul class="steps w-full">
          <li class="step {currentStep !== 'form' ? 'step-primary' : ''}" data-content={currentStep === 'success' ? '✓' : '1'}>
            Configure
          </li>
          <li class="step {currentStep === 'payment' || currentStep === 'deploying' || currentStep === 'success' ? 'step-primary' : ''}" data-content={currentStep === 'success' ? '✓' : '2'}>
            Payment
          </li>
          <li class="step {currentStep === 'deploying' || currentStep === 'success' ? 'step-primary' : ''}" data-content={currentStep === 'success' ? '✓' : '3'}>
            Deploy
          </li>
          <li class="step {currentStep === 'success' ? 'step-primary' : ''}" data-content="✓">
            Success
          </li>
        </ul>
      </div>

      {#if currentStep === 'form'}
        <!-- Form Step -->
        <form onsubmit={(e) => { e.preventDefault(); handleFormSubmit(); }}>
          <!-- Wishlist Item Info -->
          <div class="alert alert-info mb-4">
            <div>
              <div class="font-semibold">{wishlistItem.title}</div>
              <div class="text-sm opacity-80">{companyName}</div>
            </div>
          </div>

          <!-- Payment Method Selection -->
          <div class="form-control mb-4">
            <div class="label">
              <span class="label-text font-semibold">Payment Method</span>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <label class="cursor-pointer">
                <div class="card {paymentMethod === 'usdc' ? 'border-2 border-primary' : 'border border-base-300'} hover:border-primary transition-colors">
                  <div class="card-body p-4">
                    <div class="flex items-start gap-3">
                      <input
                        type="radio"
                        name="payment-method"
                        class="radio radio-primary"
                        bind:group={paymentMethod}
                        value="usdc"
                      />
                      <div class="flex-1">
                        <div class="font-semibold flex items-center gap-2">
                          <CreditCard class="w-4 h-4" />
                          USDC Payment
                          <span class="badge badge-primary badge-sm">Recommended</span>
                        </div>
                        <p class="text-xs opacity-70 mt-1">Pay in stablecoin, we handle gas fees</p>
                      </div>
                    </div>
                  </div>
                </div>
              </label>

              <label class="cursor-pointer">
                <div class="card {paymentMethod === 'traditional' ? 'border-2 border-primary' : 'border border-base-300'} hover:border-primary transition-colors">
                  <div class="card-body p-4">
                    <div class="flex items-start gap-3">
                      <input
                        type="radio"
                        name="payment-method"
                        class="radio radio-primary"
                        bind:group={paymentMethod}
                        value="traditional"
                      />
                      <div class="flex-1">
                        <div class="font-semibold flex items-center gap-2">
                          <Wallet class="w-4 h-4" />
                          Direct Deployment
                        </div>
                        <p class="text-xs opacity-70 mt-1">You pay gas fees directly</p>
                      </div>
                    </div>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <!-- Campaign Name and Description -->
          <div class="form-control mb-4">
            <label class="label" for="campaign-name">
              <span class="label-text font-semibold">Campaign Name</span>
            </label>
            <input
              id="campaign-name"
              type="text"
              class="input input-bordered w-full"
              bind:value={campaignName}
              maxlength={255}
            />
          </div>

          <div class="form-control mb-4">
            <label class="label" for="campaign-description">
              <span class="label-text font-semibold">Campaign Description</span>
            </label>
            <textarea
              id="campaign-description"
              class="textarea textarea-bordered w-full"
              rows={3}
              bind:value={campaignDescription}
            ></textarea>
          </div>

          <!-- Target Amount -->
          <div class="form-control mb-4">
            <div class="label">
              <span class="label-text font-semibold">Target Amount</span>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label" for="target-amount-eur">
                  <span class="label-text text-xs">EUR (Fiat)</span>
                </label>
                <div class="relative">
                  <DollarSign class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                  <input
                    id="target-amount-eur"
                    type="number"
                    class="input input-bordered w-full pl-10"
                    bind:value={targetAmountEur}
                    oninput={updateEthAmount}
                    min="100"
                    step="1"
                  />
                </div>
              </div>
              <div>
                <label class="label" for="target-amount-eth">
                  <span class="label-text text-xs">ETH/AVAX (Crypto)</span>
                </label>
                <input
                  id="target-amount-eth"
                  type="number"
                  class="input input-bordered w-full"
                  bind:value={targetAmountEth}
                  oninput={updateEurAmount}
                  min="0.01"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          <!-- Duration -->
          <div class="form-control mb-4">
            <label class="label" for="duration-days">
              <span class="label-text font-semibold">Campaign Duration</span>
            </label>
            <div class="flex gap-2 mb-2">
              {#each DURATION_PRESETS as preset}
                <button
                  type="button"
                  class="btn btn-sm {durationDays === preset.days ? 'btn-primary' : 'btn-outline'}"
                  onclick={() => durationDays = preset.days}
                >
                  {preset.label}
                </button>
              {/each}
            </div>
            <div class="relative">
              <Calendar class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
              <input
                id="duration-days"
                type="number"
                class="input input-bordered w-full pl-10"
                bind:value={durationDays}
                min="1"
                max="365"
              />
            </div>
          </div>

          <!-- Network Selection -->
          <div class="form-control mb-4">
            <div class="label">
              <span class="label-text font-semibold">Deploy to Networks</span>
            </div>
            <div class="space-y-2">
              <label class="cursor-pointer label">
                <div class="flex items-center gap-3">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-primary"
                    bind:checked={deployToEthereum}
                  />
                  <span class="font-medium">Ethereum Sepolia</span>
                </div>
              </label>
              <label class="cursor-pointer label">
                <div class="flex items-center gap-3">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-primary"
                    bind:checked={deployToAvalanche}
                  />
                  <span class="font-medium">Avalanche Fuji</span>
                </div>
              </label>
            </div>
          </div>

          <!-- Error Display -->
          {#if error}
            <div class="alert alert-error mb-4">
              <AlertCircle class="w-5 h-5" />
              <span>{error}</span>
            </div>
          {/if}

          <!-- Actions -->
          <div class="modal-action">
            <button
              type="button"
              class="btn btn-ghost"
              onclick={close}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={isSubmitting}
            >
              {paymentMethod === 'usdc' ? 'Continue to Payment' : 'Deploy Contracts'}
            </button>
          </div>
        </form>
      {/if}

      {#if currentStep === 'payment'}
        <!-- Payment Step -->
        <div class="space-y-4">
          <!-- Payment Chain Selection -->
          <div class="form-control">
            <div class="label">
              <span class="label-text font-semibold">Pay with USDC on:</span>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <label class="cursor-pointer">
                <div class="card {selectedPaymentChain === 'ethereum' ? 'border-2 border-primary' : 'border border-base-300'}">
                  <div class="card-body p-3">
                    <input
                      type="radio"
                      name="payment-chain"
                      class="radio radio-primary radio-sm mb-2"
                      bind:group={selectedPaymentChain}
                      value="ethereum"
                      onchange={() => loadUSDCBalance()}
                    />
                    <span class="font-medium">Ethereum Sepolia</span>
                  </div>
                </div>
              </label>
              <label class="cursor-pointer">
                <div class="card {selectedPaymentChain === 'avalanche' ? 'border-2 border-primary' : 'border border-base-300'}">
                  <div class="card-body p-3">
                    <input
                      type="radio"
                      name="payment-chain"
                      class="radio radio-primary radio-sm mb-2"
                      bind:group={selectedPaymentChain}
                      value="avalanche"
                      onchange={() => loadUSDCBalance()}
                    />
                    <span class="font-medium">Avalanche Fuji</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <!-- Balance Display -->
          {#if isLoadingBalance}
            <div class="alert">
              <Loader class="w-5 h-5 animate-spin" />
              <span>Loading USDC balance...</span>
            </div>
          {:else if usdcBalance}
            <div class="card bg-base-200">
              <div class="card-body p-4">
                <div class="flex justify-between items-center">
                  <div>
                    <div class="text-sm opacity-70">Your USDC Balance</div>
                    <div class="text-2xl font-bold">{formatUSDC(usdcBalance.formatted)} USDC</div>
                  </div>
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost"
                    onclick={() => loadUSDCBalance()}
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          {/if}

          <!-- Cost Breakdown -->
          <div class="card bg-base-200">
            <div class="card-body p-4">
              <h4 class="font-semibold mb-3">Cost Breakdown</h4>
              <div class="space-y-2 text-sm">
                {#if deployToEthereum}
                  <div class="flex justify-between">
                    <span>Ethereum Sepolia Deployment</span>
                    <span class="font-mono">~$5.00 USDC</span>
                  </div>
                {/if}
                {#if deployToAvalanche}
                  <div class="flex justify-between">
                    <span>Avalanche Fuji Deployment</span>
                    <span class="font-mono">~$1.00 USDC</span>
                  </div>
                {/if}
                <div class="flex justify-between opacity-70">
                  <span>Platform Fee</span>
                  <span class="font-mono">$0.00 USDC</span>
                </div>
                <div class="divider my-2"></div>
                <div class="flex justify-between font-bold text-lg">
                  <span>Total Cost</span>
                  <span class="font-mono text-primary">{formatUSDC(estimatedCostUSDC)} USDC</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Platform Receiver -->
          {#if platformReceiverAddress}
            <div class="alert alert-info">
              <div>
                <div class="font-semibold">Payment Destination</div>
                <code class="text-xs">{platformReceiverAddress}</code>
              </div>
            </div>
          {/if}

          <!-- Warning -->
          <div class="alert alert-warning">
            <AlertCircle class="w-5 h-5" />
            <div class="text-sm">
              <p class="font-semibold">Before proceeding:</p>
              <ul class="list-disc list-inside mt-1">
                <li>Ensure you have sufficient USDC balance</li>
                <li>MetaMask will request approval for the transfer</li>
                <li>Deployment begins immediately after payment</li>
              </ul>
            </div>
          </div>

          <!-- Error Display -->
          {#if error}
            <div class="alert alert-error">
              <AlertCircle class="w-5 h-5" />
              <span>{error}</span>
            </div>
          {/if}

          <!-- Actions -->
          <div class="modal-action">
            <button
              type="button"
              class="btn btn-ghost"
              onclick={() => currentStep = 'form'}
              disabled={isSubmitting}
            >
              Back
            </button>
            <button
              type="button"
              class="btn btn-primary"
              onclick={handleUSDCPayment}
              disabled={isSubmitting || !usdcBalance || parseFloat(usdcBalance.formatted) < estimatedCostUSDC}
            >
              {isSubmitting ? 'Processing...' : `Pay ${formatUSDC(estimatedCostUSDC)} USDC`}
            </button>
          </div>
        </div>
      {/if}

      {#if currentStep === 'deploying'}
        <!-- Deploying Step -->
        <div class="flex flex-col items-center justify-center py-12">
          <Loader class="w-16 h-16 animate-spin text-primary mb-4" />
          <h4 class="text-xl font-bold mb-2">Deploying Smart Contracts...</h4>
          <p class="text-sm opacity-70 text-center max-w-md mb-4">
            Payment received! Deploying escrow contracts to selected networks.
          </p>
          
          {#if paymentTxHash}
            <div class="card bg-base-200 w-full max-w-md mb-6">
              <div class="card-body p-4">
                <div class="text-sm opacity-70">USDC Payment Transaction</div>
                <code class="text-xs break-all">{paymentTxHash}</code>
              </div>
            </div>
          {/if}

          <div class="space-y-2 text-sm">
            <div class="flex items-center gap-2">
              <CheckCircle class="w-4 h-4 text-success" />
              <span>USDC payment confirmed</span>
            </div>
            <div class="flex items-center gap-2">
              {#if deploymentStatus === 'deploying'}
                <Loader class="w-4 h-4 animate-spin" />
              {:else}
                <Clock class="w-4 h-4" />
              {/if}
              <span>Queueing deployment job...</span>
            </div>
            {#if deployToEthereum}
              <div class="flex items-center gap-2">
                <Loader class="w-4 h-4 animate-spin" />
                <span>Deploying to Ethereum Sepolia...</span>
              </div>
            {/if}
            {#if deployToAvalanche}
              <div class="flex items-center gap-2">
                <Loader class="w-4 h-4 animate-spin" />
                <span>Deploying to Avalanche Fuji...</span>
              </div>
            {/if}
          </div>

          <p class="text-xs opacity-50 mt-6">This may take 1-2 minutes...</p>
        </div>
      {/if}

      {#if currentStep === 'success'}
        <!-- Success Step -->
        <div class="flex flex-col items-center justify-center py-8">
          <div class="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mb-4">
            <CheckCircle class="w-10 h-10 text-success" />
          </div>
          <h4 class="text-2xl font-bold mb-2">Bounty Created!</h4>
          <p class="text-sm opacity-70 text-center mb-6">
            Smart contracts deployed successfully. Investors can now contribute.
          </p>

          <!-- Contract Addresses -->
          <div class="w-full space-y-3">
            {#if deploymentResult?.ethereumAddress}
              <div class="card bg-base-200">
                <div class="card-body py-3 px-4">
                  <div class="flex justify-between items-center">
                    <div>
                      <div class="font-semibold text-sm">Ethereum Sepolia</div>
                      <code class="text-xs opacity-70">{deploymentResult.ethereumAddress}</code>
                    </div>
                    <button
                      class="btn btn-xs btn-ghost"
                      onclick={() => viewOnExplorer('ethereum', deploymentResult.ethereumAddress)}
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            {/if}
            {#if deploymentResult?.avalancheAddress}
              <div class="card bg-base-200">
                <div class="card-body py-3 px-4">
                  <div class="flex justify-between items-center">
                    <div>
                      <div class="font-semibold text-sm">Avalanche Fuji</div>
                      <code class="text-xs opacity-70">{deploymentResult.avalancheAddress}</code>
                    </div>
                    <button
                      class="btn btn-xs btn-ghost"
                      onclick={() => viewOnExplorer('avalanche', deploymentResult.avalancheAddress)}
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <p class="text-xs opacity-70 mt-6 text-center">
            Closing automatically in a few seconds...
          </p>
        </div>
      {/if}
    </div>
    <div 
      class="modal-backdrop" 
      role="button"
      tabindex="0"
      onclick={close}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') close(); }}
    ></div>
  </div>
{/if}
