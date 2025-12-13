<script lang="ts">
  import { X, Target, Calendar, DollarSign, Loader, CheckCircle, AlertCircle, Wallet } from 'lucide-svelte';
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
    onSuccess = () => {},
  }: {
    isOpen: boolean;
    wishlistItem: WishlistItem;
    companyName: string;
    companyWallet?: string;
    onSuccess?: () => void;
  } = $props();

  // Form state
  let targetAmountEur = $state(wishlistItem.value || 10000);
  let targetAmountEth = $state(0.5);
  let durationDays = $state(30);
  let campaignName = $state(wishlistItem.title || '');
  let campaignDescription = $state(wishlistItem.description || '');
  let deployToEthereum = $state(true);
  let deployToAvalanche = $state(true);
  
  // UI state
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);
  let deploymentResult = $state<any>(null);
  
  // Step tracking
  let currentStep = $state<'form' | 'deploying' | 'success'>('form');

  const DURATION_PRESETS = [
    { days: 7, label: '1 Week' },
    { days: 14, label: '2 Weeks' },
    { days: 30, label: '1 Month' },
    { days: 60, label: '2 Months' },
    { days: 90, label: '3 Months' },
  ];

  const ETH_EUR_RATE = 3200; // Approximate rate for estimation

  function updateEthAmount() {
    // Round to 4 decimal places for crypto precision
    targetAmountEth = Math.round(targetAmountEur / ETH_EUR_RATE * 10000) / 10000;
  }

  function updateEurAmount() {
    // Round to 2 decimal places for currency
    targetAmountEur = Math.round(targetAmountEth * ETH_EUR_RATE * 100) / 100;
  }

  function close() {
    if (!isSubmitting) {
      isOpen = false;
      // Reset form after animation
      setTimeout(reset, 300);
    }
  }

  function reset() {
    targetAmountEur = wishlistItem.value || 10000;
    targetAmountEth = 0.5;
    durationDays = 30;
    deployToEthereum = true;
    deployToAvalanche = true;
    isSubmitting = false;
    error = null;
    success = false;
    deploymentResult = null;
    currentStep = 'form';
  }

  async function handleSubmit() {
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

    isSubmitting = true;
    currentStep = 'deploying';

    try {
      const chains = [];
      if (deployToEthereum) chains.push('ethereum');
      if (deployToAvalanche) chains.push('avalanche');

      // Ensure values are properly rounded before sending
      const roundedEurAmount = Math.round(targetAmountEur * 100) / 100;
      const roundedEthAmount = Math.round(targetAmountEth * 10000) / 10000;
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
      success = true;

      // Show rich toast so user can quickly access contract addresses
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
          data: {
            campaignName,
            campaignDescription,
            addresses: addrs,
          },
        });
      }

      // Call success callback with deployed addresses so parent can update UI immediately
      const deployedAddresses = deploymentResult || {};
      setTimeout(() => {
        try {
          onSuccess(deployedAddresses);
        } catch (e) {
          // ignore if handler doesn't expect argument
          onSuccess();
        }
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
    <div class="modal-box max-w-2xl">
      <!-- Header -->
      <div class="flex justify-between items-start mb-6">
        <div>
          <h3 class="text-2xl font-bold flex items-center gap-2">
            <Target class="w-6 h-6 text-primary" />
            Create Bounty
          </h3>
          <p class="text-sm opacity-70 mt-1">Deploy blockchain escrow contracts for crowdfunding</p>
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
          <li class="step {currentStep === 'deploying' || currentStep === 'success' ? 'step-primary' : ''}" data-content={currentStep === 'success' ? '✓' : '2'}>
            Deploy
          </li>
          <li class="step {currentStep === 'success' ? 'step-primary' : ''}" data-content="✓">
            Success
          </li>
        </ul>
      </div>

      {#if currentStep === 'form'}
        <!-- Form Step -->
        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <!-- Wishlist Item Info -->
          <div class="alert alert-info mb-4">
            <div>
              <div class="font-semibold">{wishlistItem.title}</div>
              <div class="text-sm opacity-80">{companyName}</div>
            </div>
          </div>

          <!-- Target Amount -->
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
            <div class="label">
              <span class="label-text-alt opacity-70">Display name for this escrow campaign</span>
            </div>
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
            <div class="label">
              <span class="label-text-alt opacity-70">Short purpose or details for this campaign</span>
            </div>
          </div>
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
            <div class="label">
              <span class="label-text-alt opacity-70">
                Approximate conversion: 1 ETH ≈ €{ETH_EUR_RATE.toLocaleString()}
              </span>
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
            <div class="label">
              <span class="label-text-alt">
                Campaign will end on: {new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </span>
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
                  <div>
                    <span class="font-medium">Ethereum Sepolia</span>
                    <span class="text-xs opacity-70 block">Testnet - Free test ETH</span>
                  </div>
                </div>
              </label>
              <label class="cursor-pointer label">
                <div class="flex items-center gap-3">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-primary"
                    bind:checked={deployToAvalanche}
                  />
                  <div>
                    <span class="font-medium">Avalanche Fuji</span>
                    <span class="text-xs opacity-70 block">Testnet - Free test AVAX</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <!-- Company Wallet Info -->
          <div class="alert mb-4">
            <Wallet class="w-5 h-5" />
            <div>
              <div class="font-semibold">Receiving Wallet</div>
              <code class="text-xs">{companyWallet || 'Not configured'}</code>
            </div>
          </div>

          <!-- Error Display -->
          {#if error}
            <div class="alert alert-error mb-4">
              <AlertCircle class="w-5 h-5" />
              <span>{error}</span>
            </div>
          {/if}

          <!-- Warning -->
          <div class="alert alert-warning mb-4">
            <AlertCircle class="w-5 h-5" />
            <div class="text-sm">
              <p class="font-semibold">Important:</p>
              <ul class="list-disc list-inside space-y-1 mt-1">
                <li>Smart contracts will be deployed to testnet blockchains</li>
                <li>If target not met by deadline, contributors get refunds (minus proportional gas fees)</li>
                <li>Once deployed, target amount and deadline cannot be changed</li>
              </ul>
            </div>
          </div>

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
              Deploy Contracts
            </button>
          </div>
        </form>
      {/if}

      {#if currentStep === 'deploying'}
        <!-- Deploying Step -->
        <div class="flex flex-col items-center justify-center py-12">
          <Loader class="w-16 h-16 animate-spin text-primary mb-4" />
          <h4 class="text-xl font-bold mb-2">Deploying Smart Contracts...</h4>
          <p class="text-sm opacity-70 text-center max-w-md">
            Creating bounty record and deploying escrow contracts to selected networks. This may take 30-60 seconds.
          </p>
          <div class="mt-6 space-y-2 text-sm">
            <div class="flex items-center gap-2">
              <Loader class="w-4 h-4 animate-spin" />
              <span>Creating bounty record...</span>
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
                    <div class="flex items-center gap-2">
                      <button
                        class="btn btn-xs btn-ghost"
                        onclick={() => navigator.clipboard?.writeText(deploymentResult.ethereumAddress)}
                      >
                        Copy
                      </button>
                      <button
                        class="btn btn-xs btn-ghost"
                        onclick={() => viewOnExplorer('ethereum', deploymentResult.ethereumAddress)}
                      >
                        View
                      </button>
                    </div>
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
                    <div class="flex items-center gap-2">
                      <button
                        class="btn btn-xs btn-ghost"
                        onclick={() => navigator.clipboard?.writeText(deploymentResult.avalancheAddress)}
                      >
                        Copy
                      </button>
                      <button
                        class="btn btn-xs btn-ghost"
                        onclick={() => viewOnExplorer('avalanche', deploymentResult.avalancheAddress)}
                      >
                        View
                      </button>
                    </div>
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
