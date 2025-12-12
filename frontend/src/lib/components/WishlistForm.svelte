<script lang="ts">
  import { Plus, X, Target, AlertCircle, Euro, Rocket, Calendar } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { authStore } from '$lib/stores/auth';
  import { toastStore } from '$lib/stores/toast';
  import { tick } from 'svelte';

  let {
    companyId,
    companyWallet,
    onItemAdded = () => {},
    onCreateBounty = null
  }: {
    companyId: string;
    companyWallet?: string;
    onItemAdded?: () => void;
    onCreateBounty?: ((item: any) => void) | null;
  } = $props();

  let isFormOpen = $state(false);
  let isSubmitting = $state(false);

  let formData = $state({
    title: '',
    description: '',
    value: '',
    category: 'funding',
    priority: 'medium',
    // Escrow/bounty fields
    enableEscrow: false,
    targetAmountEth: 0.5,
    durationDays: 30,
    deployToEthereum: true,
    deployToAvalanche: true
  });

  // Wallet state
  let ethBalance = $state<string>('...');
  let avaxBalance = $state<string>('...');
  let estimatedGasCost = $state<{ ethereum?: string; avalanche?: string }>({});
  let isLoadingBalances = $state(false);
  let isEstimatingGas = $state(false);

  const ETH_EUR_RATE = 3200; // Approximate rate for estimation

  const DURATION_PRESETS = [
    { days: 7, label: '1 Week' },
    { days: 14, label: '2 Weeks' },
    { days: 30, label: '1 Month' },
    { days: 60, label: '2 Months' },
    { days: 90, label: '3 Months' },
  ];

  const categories = [
    { value: 'funding', label: '💰 Funding', icon: 'Funding' },
    { value: 'talent', label: '👥 Talent', icon: 'Talent' },
    { value: 'mentorship', label: '🎓 Mentorship', icon: 'Mentorship' },
    { value: 'partnerships', label: '🤝 Partnerships', icon: 'Partnerships' },
    { value: 'resources', label: '🛠️ Resources', icon: 'Resources' },
    { value: 'technology', label: '⚙️ Technology', icon: 'Technology' },
    { value: 'marketing', label: '📢 Marketing', icon: 'Marketing' },
    { value: 'other', label: '✨ Other', icon: 'Other' }
  ];

  const priorities = [
    { value: 'low', label: 'Low', color: 'badge-ghost' },
    { value: 'medium', label: 'Medium', color: 'badge-info' },
    { value: 'high', label: 'High', color: 'badge-warning' },
    { value: 'critical', label: 'Critical', color: 'badge-error' }
  ];

  function resetForm() {
    formData = {
      title: '',
      description: '',
      value: '',
      category: 'funding',
      priority: 'medium',
      enableEscrow: false,
      targetAmountEth: 0.5,
      durationDays: 30,
      deployToEthereum: true,
      deployToAvalanche: true
    };
  }

  function updateEthAmount() {
    if (formData.value && parseFloat(formData.value) > 0) {
      formData.targetAmountEth = Math.round(parseFloat(formData.value) / ETH_EUR_RATE * 10000) / 10000;
    }
  }

  function updateEurAmount() {
    if (formData.targetAmountEth > 0) {
      formData.value = String(Math.round(formData.targetAmountEth * ETH_EUR_RATE * 100) / 100);
    }
  }

  // Update ETH amount when EUR value changes
  $effect(() => {
    if (formData.enableEscrow && formData.value) {
      updateEthAmount();
    }
  });

  async function handleEscrowToggle() {
    if (formData.enableEscrow && companyWallet) {
      // Wait for Svelte to render the conditional block
      await tick();
      updateBalances();
      estimateGasCosts();
    }
  }

  async function updateBalances() {
    if (!companyWallet) return;

    isLoadingBalances = true;
    console.log('Starting balance fetch...');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

      // Fetch both balances in parallel
      const [ethResponse, avaxResponse] = await Promise.all([
        fetch(`${apiUrl}/wallet-balance?address=${companyWallet}&chain=ethereum`),
        fetch(`${apiUrl}/wallet-balance?address=${companyWallet}&chain=avalanche`)
      ]);

      // Process Ethereum balance
      if (ethResponse.ok) {
        const ethData = await ethResponse.json();
        console.log('ETH Response:', ethData);
        ethBalance = ethData.balanceEth;
        console.log(`ETH Balance set to: ${ethBalance}`);
      } else {
        console.error('Failed to fetch ETH balance:', await ethResponse.text());
        ethBalance = '0.000000';
      }

      // Process Avalanche balance
      if (avaxResponse.ok) {
        const avaxData = await avaxResponse.json();
        console.log('AVAX Response:', avaxData);
        avaxBalance = avaxData.balanceAvax;
        console.log(`AVAX Balance set to: ${avaxBalance}`);
      } else {
        console.error('Failed to fetch AVAX balance:', await avaxResponse.text());
        avaxBalance = '0.000000';
      }
    } catch (err) {
      console.error('Failed to update balances:', err);
      ethBalance = '0.000000';
      avaxBalance = '0.000000';
      toastStore.add({ message: 'Error fetching wallet balances', type: 'error', ttl: 3000 });
    } finally {
      console.log('Balance fetch complete, setting isLoadingBalances to false');
      isLoadingBalances = false;
    }
  }

  async function estimateGasCosts() {
    isEstimatingGas = true;
    try {
      const costs: { ethereum?: string; avalanche?: string } = {};
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

      // Estimate Ethereum gas
      if (formData.deployToEthereum) {
        try {
          const gasPriceResponse = await fetch(`${apiUrl}/wallet-balance/gas-price?chain=ethereum`);
          if (gasPriceResponse.ok) {
            const gasPriceData = await gasPriceResponse.json();
            console.log('ETH gas price response:', gasPriceData);
            const gasPriceGwei = parseFloat(gasPriceData.gasPriceGwei);
            if (!isNaN(gasPriceGwei) && gasPriceGwei > 0) {
              const estimatedGas = 500000; // Conservative estimate for contract deployment
              const gasCostEth = (gasPriceGwei * estimatedGas) / 1e9;
              costs.ethereum = gasCostEth.toFixed(6);
              console.log('ETH gas cost calculated:', costs.ethereum);
            } else {
              console.warn('Invalid ETH gas price:', gasPriceGwei);
              costs.ethereum = '0.005'; // Fallback estimate
            }
          } else {
            console.error('ETH gas price request failed:', gasPriceResponse.status, await gasPriceResponse.text());
            costs.ethereum = '0.005'; // Fallback estimate
          }
        } catch (err) {
          console.error('ETH gas estimation error:', err);
          costs.ethereum = '0.005'; // Fallback estimate
        }
      }

      // Estimate Avalanche gas
      if (formData.deployToAvalanche) {
        try {
          const gasPriceResponse = await fetch(`${apiUrl}/wallet-balance/gas-price?chain=avalanche`);
          if (gasPriceResponse.ok) {
            const gasPriceData = await gasPriceResponse.json();
            console.log('AVAX gas price response:', gasPriceData);
            const gasPriceGwei = parseFloat(gasPriceData.gasPriceGwei);
            if (!isNaN(gasPriceGwei) && gasPriceGwei > 0) {
              const estimatedGas = 500000;
              const gasCostAvax = (gasPriceGwei * estimatedGas) / 1e9;
              costs.avalanche = gasCostAvax.toFixed(6);
              console.log('AVAX gas cost calculated:', costs.avalanche);
            } else {
              console.warn('Invalid AVAX gas price:', gasPriceGwei);
              costs.avalanche = '0.005'; // Fallback estimate
            }
          } else {
            console.error('AVAX gas price request failed:', gasPriceResponse.status, await gasPriceResponse.text());
            costs.avalanche = '0.005'; // Fallback estimate
          }
        } catch (err) {
          console.error('AVAX gas estimation error:', err);
          costs.avalanche = '0.005'; // Fallback estimate
        }
      }

      estimatedGasCost = costs;
    } catch (err) {
      console.error('Failed to estimate gas:', err);
    } finally {
      isEstimatingGas = false;
    }
  }

  function toggleForm() {
    isFormOpen = !isFormOpen;
    if (!isFormOpen) {
      resetForm();
    }
  }

  async function handleSubmit() {
    if (!formData.title.trim()) {
      toastStore.add({ message: 'Title is required', type: 'error' });
      return;
    }

    // Validate escrow fields if enabled
    if (formData.enableEscrow) {
      if (!formData.deployToEthereum && !formData.deployToAvalanche) {
        toastStore.add({ message: 'Please select at least one blockchain network', type: 'error' });
        return;
      }
      if (formData.targetAmountEth <= 0) {
        toastStore.add({ message: 'Target amount must be greater than 0', type: 'error' });
        return;
      }
      if (formData.durationDays < 1 || formData.durationDays > 365) {
        toastStore.add({ message: 'Duration must be between 1 and 365 days', type: 'error' });
        return;
      }
      if (!companyWallet) {
        toastStore.add({ message: 'Company must have a wallet address configured', type: 'error' });
        return;
      }

      // Check wallet balances for gas fees
      if (formData.deployToEthereum && estimatedGasCost.ethereum) {
        const gasNeeded = parseFloat(estimatedGasCost.ethereum);
        if (parseFloat(ethBalance) < gasNeeded) {
          toastStore.add({ 
            message: `Insufficient ETH balance. Need ~${gasNeeded} ETH for gas, you have ${ethBalance} ETH`, 
            type: 'warning',
            ttl: 5000
          });
          // Don't block submission, just warn
        }
      }
      if (formData.deployToAvalanche && estimatedGasCost.avalanche) {
        const gasNeeded = parseFloat(estimatedGasCost.avalanche);
        if (parseFloat(avaxBalance) < gasNeeded) {
          toastStore.add({ 
            message: `Insufficient AVAX balance. Need ~${gasNeeded} AVAX for gas, you have ${avaxBalance} AVAX`, 
            type: 'warning',
            ttl: 5000
          });
          // Don't block submission, just warn
        }
      }
    }

    isSubmitting = true;

    try {
      const verified = await authStore.verify();
      if (!verified) {
        throw new Error('Please log in again');
      }

      const token = $authStore.accessToken;
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Step 1: Create wishlist item
      const payload: any = {
        title: formData.title.trim(),
        category: formData.category,
        priority: formData.priority
      };

      if (formData.description.trim()) {
        payload.description = formData.description.trim();
      }

      if (formData.value && !isNaN(parseFloat(formData.value))) {
        payload.value = parseFloat(formData.value);
      }

      const response = await fetch(`${PUBLIC_API_URL}/companies/${companyId}/wishlist`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to add wishlist item');
      }

      const createdItem = result.data;

      // Step 2: If escrow enabled, deploy contracts
      if (formData.enableEscrow) {
        const chains = [];
        if (formData.deployToEthereum) chains.push('ethereum');
        if (formData.deployToAvalanche) chains.push('avalanche');

        const roundedEurAmount = Math.round(parseFloat(formData.value || '0') * 100) / 100;
        const roundedEthAmount = Math.round(formData.targetAmountEth * 10000) / 10000;
        const roundedDurationDays = Math.round(formData.durationDays);

        // Create bounty record
        const bountyResponse = await fetch(`${PUBLIC_API_URL}/bounties`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            wishlistItemId: createdItem.id,
            targetAmountEur: roundedEurAmount,
            durationInDays: roundedDurationDays,
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
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            wishlistItemId: createdItem.id,
            targetAmountEth: roundedEthAmount,
            durationInDays: roundedDurationDays,
            chains,
          }),
        });

        const escrowData = await escrowResponse.json();
        if (!escrowData.success) {
          throw new Error(escrowData.message || 'Failed to deploy escrow contracts');
        }

        toastStore.add({ 
          message: '🎉 Wishlist item created and escrow contracts deployed!', 
          type: 'success',
          ttl: 5000 
        });
        
        // Store contract addresses to show immediately
        const deployedAddresses = escrowData.data;
        if (deployedAddresses) {
          const addresses = [];
          if (deployedAddresses.ethereumAddress) {
            addresses.push(`Ethereum: ${deployedAddresses.ethereumAddress}`);
          }
          if (deployedAddresses.avalancheAddress) {
            addresses.push(`Avalanche: ${deployedAddresses.avalancheAddress}`);
          }
          if (addresses.length > 0) {
            toastStore.add({ 
              message: `📝 Contract${addresses.length > 1 ? 's' : ''} deployed: ${addresses.join(', ')}`, 
              type: 'info',
              ttl: 8000 
            });
          }
        }
      } else {
        toastStore.add({ 
          message: '✨ Wishlist item added successfully!', 
          type: 'success',
          ttl: 3000 
        });
      }

      resetForm();
      isFormOpen = false;
      
      // Delay refresh slightly to ensure backend has saved the contract addresses
      if (formData.enableEscrow) {
        setTimeout(() => onItemAdded(), 1000);
      } else {
        onItemAdded();
      }
    } catch (err: any) {
      toastStore.add({ 
        message: err.message || 'An error occurred', 
        type: 'error' 
      });
    } finally {
      isSubmitting = false;
    }
  }

  function getCategoryLabel(value: string) {
    return categories.find(c => c.value === value)?.label || value;
  }
</script>

<div class="w-full">
  {#if !isFormOpen}
    <button
      class="btn btn-sm btn-outline gap-2 w-full"
      onclick={toggleForm}
    >
      <Plus class="w-4 h-4" />
      Add Wishlist Item
    </button>
  {:else}
    <div class="bg-gradient-to-br from-base-100 to-base-200 rounded-xl p-5 border border-base-300 shadow-md">
      <!-- Header -->
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-2">
          <div class="p-2 bg-primary/20 rounded-lg">
            <Target class="w-4 h-4 text-primary" />
          </div>
          <h4 class="font-bold text-base">Add to Wishlist</h4>
        </div>
        <button
          class="btn btn-ghost btn-xs btn-circle"
          onclick={toggleForm}
          aria-label="Close form"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-5">
        <!-- What are you looking for? - Full width -->
        <div class="form-control w-full">
          <label class="label px-0 pb-2" for="wishlist-title">
            <span class="label-text font-semibold text-sm">What are you looking for? *</span>
          </label>
          <input
            id="wishlist-title"
            type="text"
            bind:value={formData.title}
            placeholder="e.g., Seed funding round"
            class="input input-bordered input-sm focus:ring-2 focus:ring-primary w-full"
            required
            disabled={isSubmitting}
          />
        </div>

        <!-- Details - Full width -->
        <div class="form-control w-full">
          <label class="label px-0 pb-2" for="wishlist-description">
            <span class="label-text font-semibold text-sm">Details</span>
            <span class="label-text-alt text-xs opacity-60">Provide context or specifics</span>
          </label>
          <textarea
            id="wishlist-description"
            bind:value={formData.description}
            placeholder="Describe what you need in detail..."
            class="textarea textarea-bordered textarea-sm h-20 resize-none focus:ring-2 focus:ring-primary w-full"
            disabled={isSubmitting}
          ></textarea>
        </div>

        <!-- Section Divider -->
        <div class="divider my-2"></div>

        <!-- Category & Priority Section - Responsive Grid -->
        <div class="space-y-2">
          <h5 class="text-xs font-semibold uppercase opacity-70">Category & Priority</h5>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Category -->
            <div class="form-control w-full">
              <label class="label px-0 pb-2" for="wishlist-category">
                <span class="label-text text-xs font-medium">Type</span>
              </label>
              <select
                id="wishlist-category"
                bind:value={formData.category}
                class="select select-bordered select-sm focus:ring-2 focus:ring-primary w-full"
                disabled={isSubmitting}
              >
                {#each categories as cat}
                  <option value={cat.value}>{cat.label}</option>
                {/each}
              </select>
            </div>

            <!-- Priority -->
            <div class="form-control w-full">
              <label class="label px-0 pb-2" for="wishlist-priority">
                <span class="label-text text-xs font-medium">Priority</span>
              </label>
              <select
                id="wishlist-priority"
                bind:value={formData.priority}
                class="select select-bordered select-sm focus:ring-2 focus:ring-primary w-full"
                disabled={isSubmitting}
              >
                {#each priorities as pri}
                  <option value={pri.value}>{pri.label}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>

        <!-- Section Divider -->
        <div class="divider my-2"></div>

        <!-- Target Value - Full width -->
        <div class="form-control w-full">
          <label class="label px-0 pb-2" for="wishlist-value">
            <span class="label-text font-semibold text-sm flex items-center gap-1">
              <Euro class="w-4 h-4 text-success" />
              Target Value
            </span>
            <span class="label-text-alt text-xs opacity-60">Amount needed in EUR (optional)</span>
          </label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-base opacity-60">€</span>
            <input
              id="wishlist-value"
              type="number"
              inputmode="decimal"
              bind:value={formData.value}
              placeholder="5000"
              step="1"
              min="0"
              class="input input-bordered input-sm pl-8 focus:ring-2 focus:ring-primary w-full"
              disabled={isSubmitting}
            />
          </div>
          {#if formData.value}
            <p class="text-xs opacity-60 mt-2">
              Amount: €{parseFloat(formData.value).toLocaleString('de-DE')}
            </p>
          {/if}
        </div>

        <!-- Create Bounty Option -->
        {#if formData.value && parseFloat(formData.value) > 0}
          <div class="space-y-4">
            <!-- Enable Escrow Checkbox -->
            <div class="form-control">
              <label class="label cursor-pointer justify-start gap-3 px-0">
                <input
                  type="checkbox"
                  bind:checked={formData.enableEscrow}
                  onchange={handleEscrowToggle}
                  class="checkbox checkbox-primary checkbox-sm"
                  disabled={isSubmitting || !companyWallet}
                />
                <div class="flex-1">
                  <span class="label-text font-semibold text-sm flex items-center gap-2">
                    <Rocket class="w-4 h-4 text-primary" />
                    Enable Blockchain Crowdfunding
                  </span>
                  <p class="text-xs opacity-60 mt-1">
                    Deploy smart contracts to accept contributions on Ethereum & Avalanche
                  </p>
                  {#if !companyWallet}
                    <p class="text-xs text-error mt-1">
                      ⚠️ Company needs a wallet address configured first
                    </p>
                  {/if}
                </div>
              </label>
            </div>

            <!-- Escrow Configuration (shown when enabled) -->
            {#if formData.enableEscrow}
              <div class="bg-base-200/50 rounded-lg p-4 space-y-4 border border-primary/20">
                <h5 class="text-xs font-semibold uppercase opacity-70 flex items-center gap-2">
                  <Target class="w-3 h-3" />
                  Campaign Configuration
                </h5>

                <!-- Wallet Balance Display -->
                {#if companyWallet}
                  <div class="bg-base-100 rounded-lg p-3 space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-semibold opacity-70">Company Wallet Balances</span>
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs"
                        onclick={updateBalances}
                        disabled={isSubmitting || isLoadingBalances}
                      >
                        {#if isLoadingBalances}
                          <span class="loading loading-spinner loading-xs"></span>
                        {:else}
                          Refresh
                        {/if}
                      </button>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <div class="bg-primary/10 rounded p-2">
                        <p class="text-xs opacity-60">Ethereum (Sepolia)</p>
                        <p class="font-semibold text-sm">{ethBalance} ETH</p>
                      </div>
                      <div class="bg-error/10 rounded p-2">
                        <p class="text-xs opacity-60">Avalanche (Fuji)</p>
                        <p class="font-semibold text-sm">{avaxBalance} AVAX</p>
                      </div>
                    </div>
                    <p class="text-xs opacity-60">
                      Address: {companyWallet.slice(0, 6)}...{companyWallet.slice(-4)}
                    </p>
                  </div>
                {:else}
                  <div class="alert alert-warning py-2">
                    <AlertCircle class="w-4 h-4 shrink-0" />
                    <p class="text-xs">Company wallet not configured. Generate a wallet first.</p>
                  </div>
                {/if}

                <!-- Target Amount in ETH -->
                <div class="form-control w-full">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="label px-0 pb-2">
                    <span class="label-text text-xs font-medium">Target Amount (ETH)</span>
                    <span class="label-text-alt text-xs opacity-60">≈ €{Math.round(formData.targetAmountEth * ETH_EUR_RATE).toLocaleString()}</span>
                  </label>
                  <input
                    type="number"
                    bind:value={formData.targetAmountEth}
                    oninput={updateEurAmount}
                    step="0.1"
                    min="0.01"
                    class="input input-bordered input-sm focus:ring-2 focus:ring-primary w-full"
                    disabled={isSubmitting}
                  />
                </div>

                <!-- Campaign Duration -->
                <div class="form-control w-full">
                  <label class="label px-0 pb-2">
                    <span class="label-text text-xs font-medium flex items-center gap-1">
                      <Calendar class="w-3 h-3" />
                      Campaign Duration
                    </span>
                  </label>
                  <div class="grid grid-cols-3 gap-2 mb-2">
                    {#each DURATION_PRESETS as preset}
                      <button
                        type="button"
                        class="btn btn-xs {formData.durationDays === preset.days ? 'btn-primary' : 'btn-ghost'}"
                        onclick={() => formData.durationDays = preset.days}
                        disabled={isSubmitting}
                      >
                        {preset.label}
                      </button>
                    {/each}
                  </div>
                  <input
                    type="number"
                    bind:value={formData.durationDays}
                    min="1"
                    max="365"
                    class="input input-bordered input-sm focus:ring-2 focus:ring-primary w-full"
                    disabled={isSubmitting}
                  />
                  <p class="text-xs opacity-60 mt-1">
                    Campaign ends: {new Date(Date.now() + formData.durationDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </p>
                </div>

                <!-- Blockchain Networks -->
                <div class="form-control w-full">
                  <label class="label px-0 pb-2">
                    <span class="label-text text-xs font-medium">Deploy to Networks</span>
                  </label>
                  <div class="space-y-2">
                    <label class="label cursor-pointer justify-start gap-3 px-0">
                      <input
                        type="checkbox"
                        bind:checked={formData.deployToEthereum}
                        onchange={estimateGasCosts}
                        class="checkbox checkbox-sm"
                        disabled={isSubmitting}
                      />
                      <div class="flex-1">
                        <span class="label-text text-xs">Ethereum (Sepolia Testnet)</span>
                        {#if formData.deployToEthereum && estimatedGasCost.ethereum}
                          <p class="text-xs opacity-60 mt-0.5">Est. gas: ~{estimatedGasCost.ethereum} ETH</p>
                        {/if}
                      </div>
                    </label>
                    <label class="label cursor-pointer justify-start gap-3 px-0">
                      <input
                        type="checkbox"
                        bind:checked={formData.deployToAvalanche}
                        onchange={estimateGasCosts}
                        class="checkbox checkbox-sm"
                        disabled={isSubmitting}
                      />
                      <div class="flex-1">
                        <span class="label-text text-xs">Avalanche (Fuji Testnet)</span>
                        {#if formData.deployToAvalanche && estimatedGasCost.avalanche}
                          <p class="text-xs opacity-60 mt-0.5">Est. gas: ~{estimatedGasCost.avalanche} AVAX</p>
                        {/if}
                      </div>
                    </label>
                  </div>
                </div>

                <!-- Total Cost Estimate -->
                {#if estimatedGasCost.ethereum || estimatedGasCost.avalanche}
                  <div class="bg-info/10 rounded-lg p-3 border border-info/30">
                    <p class="text-xs font-semibold mb-2 flex items-center gap-2">
                      <AlertCircle class="w-3 h-3" />
                      Estimated Deployment Costs
                    </p>
                    <div class="space-y-1">
                      {#if formData.deployToEthereum && estimatedGasCost.ethereum}
                        <div class="flex justify-between text-xs">
                          <span>Ethereum deployment:</span>
                          <span class="font-semibold">~{estimatedGasCost.ethereum} ETH</span>
                        </div>
                      {/if}
                      {#if formData.deployToAvalanche && estimatedGasCost.avalanche}
                        <div class="flex justify-between text-xs">
                          <span>Avalanche deployment:</span>
                          <span class="font-semibold">~{estimatedGasCost.avalanche} AVAX</span>
                        </div>
                      {/if}
                      {#if isEstimatingGas}
                        <p class="text-xs opacity-60 mt-1">
                          <span class="loading loading-spinner loading-xs"></span>
                          Updating estimates...
                        </p>
                      {:else}
                        <p class="text-xs opacity-60 mt-2">
                          ⚠️ Actual costs may vary based on network congestion
                        </p>
                      {/if}
                    </div>
                  </div>
                {/if}

                <!-- Info Alert -->
                <div class="alert alert-info py-2">
                  <AlertCircle class="w-4 h-4 shrink-0" />
                  <div class="text-xs">
                    <p class="font-semibold">Smart contracts will be deployed automatically</p>
                    <p class="opacity-80 mt-1">Contributors can fund your campaign using MetaMask on the selected networks</p>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Section Divider -->
        <div class="divider my-2"></div>

        <!-- Action Buttons - Responsive -->
        <div class="flex flex-col-reverse sm:flex-row gap-2 justify-end">
          <button
            type="button"
            class="btn btn-ghost btn-sm w-full sm:w-auto"
            onclick={toggleForm}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn btn-primary btn-sm gap-2 w-full sm:w-auto"
            disabled={isSubmitting || !formData.title.trim()}
          >
            {#if isSubmitting}
              <span class="loading loading-spinner loading-xs"></span>
              Adding...
            {:else}
              <Plus class="w-4 h-4" />
              Add Item
            {/if}
          </button>
        </div>
      </form>
    </div>
  {/if}
</div>
