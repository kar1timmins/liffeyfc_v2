<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { Building2, MapPin, Users, TrendingUp, DollarSign, Calendar, Globe, Linkedin, Twitter, Target, CheckCircle, Circle, ArrowLeft, Wallet, Eye, EyeOff, Copy, Send, ExternalLink } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { authStore } from '$lib/stores/auth';

  let company = $state<any>(null);
  let wishlistItems = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let showEthAddress = $state(true);
  let showAvaxAddress = $state(true);
  let sendAmount = $state('');
  let selectedChain = $state<'eth' | 'avax' | null>(null);
  let isSending = $state(false);
  let sendSuccess = $state<string | null>(null);
  let sendError = $state<string | null>(null);

  // Live bounty data for escrow-enabled wishlist items (keyed by wishlist item id)
  let liveBounties = $state<Record<string, any>>({});
  let isFetchingBounties = $state(false);
  // payments keyed by wishlist item id
  let paymentsByItem: Record<string, any[]> = $state({});
  let isFetchingPayments = $state(false);
  
  // Donation state for wishlist items
  let donationAmounts = $state<Record<string, string>>({});
  let donatingItemId = $state<string | null>(null);
  let donationSuccess = $state<string | null>(null);
  let donationError = $state<string | null>(null);
  
  // Bounty contribution state (for escrow-enabled wishlist items)
  let bountyContributions = $state<Record<string, string>>({});
  let contributingBountyId = $state<string | null>(null);
  let selectedBountyChain = $state<Record<string, string>>({});
  let bountyContributionSuccess = $state<string | null>(null);
  let bountyContributionError = $state<string | null>(null);

  // Manual (non-EVM) contribution state for SOL / XLM / BTC
  let manualContribAmounts = $state<Record<string, string>>({});
  let manualContribTxHashes = $state<Record<string, string>>({});
  let recordingManualContribId = $state<string | null>(null);
  let manualContribSuccess = $state<string | null>(null);
  let manualContribError = $state<string | null>(null);

  const companyId = $derived($page.params.id);
  const isInvestor = $derived($authStore.user?.role === 'investor');
  const isOwner = $derived(company?.ownerId === $authStore.user?.id);
  const canDonate = $derived(isInvestor && !isOwner);

  const stageLabels: Record<string, string> = {
    idea: 'Idea',
    mvp: 'MVP',
    early_stage: 'Early Stage',
    growth: 'Growth',
    scale: 'Scale',
    established: 'Established'
  };

  // determines if a bounty/wishlist item is no longer open for contributions
  function isBountyClosed(item: any, liveBounty: any): boolean {
    if (item.isFulfilled) return true;
    const now = new Date();
    if (liveBounty) {
      return liveBounty.status !== 'active';
    } else if (item.campaignDeadline) {
      return new Date(item.campaignDeadline) < now;
    }
    return false;
  }

  const fundingLabels: Record<string, string> = {
    bootstrapped: 'Bootstrapped',
    pre_seed: 'Pre-Seed',
    seed: 'Seed',
    series_a: 'Series A',
    series_b: 'Series B',
    series_c_plus: 'Series C+'
  };

  const categoryIcons: Record<string, any> = {
    funding: DollarSign,
    talent: Users,
    mentorship: Target,
    partnerships: Building2,
    resources: Globe,
    technology: Building2,
    marketing: TrendingUp,
    other: Circle
  };

  // automatically pick a default network when a new escrow address becomes available
  $effect(() => {
    for (const item of wishlistItems) {
      if (item.isEscrowActive && !selectedBountyChain[item.id]) {
        if (item.ethereumEscrowAddress) {
          selectedBountyChain[item.id] = 'ethereum';
        } else if (item.avalancheEscrowAddress) {
          selectedBountyChain[item.id] = 'avalanche';
        }
      }
    }
  });

  onMount(async () => {
    await fetchCompany();
    await fetchCompanyPayments();
    await fetchCompanyBounties();
  });

  async function fetchCompany() {
    isLoading = true;
    error = null;

    try {
      const response = await fetch(`${PUBLIC_API_URL}/companies/${companyId}?includeWishlist=true`);
      const data = await response.json();

      if (data.success) {
        company = data.data;
        wishlistItems = data.data.wishlistItems || [];
      } else {
        error = data.message || 'Company not found';
      }
    } catch (err: any) {
      error = err.message || 'Failed to fetch company';
    } finally {
      isLoading = false;
    }
  }

  function goBack() {
    goto('/companies');
  }

  async function fetchCompanyPayments() {
    if (!companyId) return;
    isFetchingPayments = true;
    try {
      const res = await fetch(`${PUBLIC_API_URL}/payments/company/${companyId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        // group by wishlistItemId
        const map: Record<string, any[]> = {};
        for (const p of data.data) {
          if (!map[p.wishlistItemId]) map[p.wishlistItemId] = [];
          map[p.wishlistItemId].push(p);
        }
        paymentsByItem = map;

        // merge deployed contracts into items
        for (const item of wishlistItems) {
          const payments = paymentsByItem[item.id] || [];
          const deployed = payments.find((p) => p.status === 'deployed' && p.deployedContracts);
          if (deployed) {
            item.isEscrowActive = true;
            const contracts = deployed.deployedContracts || {};
            if (!item.ethereumEscrowAddress && contracts.ethereum) {
              item.ethereumEscrowAddress = contracts.ethereum;
            }
            if (!item.avalancheEscrowAddress && contracts.avalanche) {
              item.avalancheEscrowAddress = contracts.avalanche;
            }
          }
          // flag that a confirmed payment exists (deployment may be pending)
          item.hasConfirmedPayment = payments.some((p) => p.status === 'confirmed');
        }
      }
    } catch (e) {
      console.error('Failed to fetch company payments:', e);
    } finally {
      isFetchingPayments = false;
    }
  }

  async function fetchCompanyBounties() {
    if (!companyId) return;
    isFetchingBounties = true;
    try {
      const res = await fetch(`${PUBLIC_API_URL}/bounties/company/${companyId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const map: Record<string, any> = {};
        for (const bounty of data.data) {
          map[bounty.id] = bounty;
        }
        liveBounties = map;
      }
    } catch (e) {
      console.error('Failed to fetch company bounties:', e);
    } finally {
      isFetchingBounties = false;
    }
  }

  async function recordManualContribution(itemId: string, chain: string) {
    const amount = manualContribAmounts[itemId];
    const txHash = manualContribTxHashes[itemId];

    if (!amount || parseFloat(amount) <= 0) {
      manualContribError = 'Please enter a valid amount';
      setTimeout(() => (manualContribError = null), 3000);
      return;
    }
    if (!txHash || txHash.trim().length < 10) {
      manualContribError = 'Please enter a valid transaction hash';
      setTimeout(() => (manualContribError = null), 3000);
      return;
    }

    const token = $authStore.accessToken;
    if (!token) { manualContribError = 'Not authenticated'; return; }

    recordingManualContribId = itemId;
    manualContribError = null;
    manualContribSuccess = null;

    try {
      const res = await fetch(`${PUBLIC_API_URL}/bounties/${itemId}/contributions/manual`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain, nativeAmount: parseFloat(amount), transactionHash: txHash.trim() }),
      });
      const result = await res.json();
      if (result.success) {
        manualContribSuccess = `Contribution recorded! Thank you.`;
        manualContribAmounts[itemId] = '';
        manualContribTxHashes[itemId] = '';
        setTimeout(() => (manualContribSuccess = null), 5000);
        // Refresh bounty data to update totals
        await fetchCompanyBounties();
      } else {
        manualContribError = result.message || 'Failed to record contribution';
        setTimeout(() => (manualContribError = null), 4000);
      }
    } catch (err: any) {
      manualContribError = err.message || 'Failed to record contribution';
      setTimeout(() => (manualContribError = null), 4000);
    } finally {
      recordingManualContribId = null;
    }
  }

  function copyAddress(address: string) {
    navigator.clipboard.writeText(address);
  }

  function maskAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  async function sendFunds(chain: 'eth' | 'avax') {
    if (!sendAmount || parseFloat(sendAmount) <= 0) {
      sendError = 'Please enter a valid amount';
      return;
    }

    const toAddress = chain === 'eth' ? company.ethAddress : company.avaxAddress;
    if (!toAddress) {
      sendError = `No ${chain.toUpperCase()} address found for this company`;
      return;
    }

    isSending = true;
    sendError = null;
    sendSuccess = null;

    try {
      const token = $authStore.accessToken;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${PUBLIC_API_URL}/wallet/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientAddress: toAddress,
          chain: chain === 'eth' ? 'ethereum' : 'avalanche',
          amountEth: parseFloat(sendAmount),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Transaction failed');
      }

      sendSuccess = `Transaction sent! Hash: ${result.data.transactionHash}`;
      sendAmount = '';
      selectedChain = null;
    } catch (err: any) {
      sendError = err.message || 'Transaction failed';
    } finally {
      isSending = false;
    }
  }

  async function donateToWishlistItem(itemId: string) {
    const amount = donationAmounts[itemId];
    if (!amount || parseFloat(amount) <= 0) {
      donationError = 'Please enter a valid amount';
      return;
    }

    donatingItemId = itemId;
    donationError = null;
    donationSuccess = null;

    try {
      const verified = await authStore.verify();
      if (!verified) {
        throw new Error('Please log in again');
      }

      const token = $authStore.accessToken;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${PUBLIC_API_URL}/companies/${companyId}/wishlist/${itemId}/donate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: parseFloat(amount) })
      });

      const result = await response.json();

      if (result.success) {
        donationSuccess = `Thank you for your donation of $${amount}!`;
        donationAmounts[itemId] = '';
        // Refresh company data to get updated wishlist
        await fetchCompany();
      } else {
        donationError = result.message || 'Failed to process donation';
      }
    } catch (err: any) {
      donationError = err.message || 'An error occurred';
    } finally {
      donatingItemId = null;
    }
  }
  
  async function contributeToEscrow(itemId: string, chain: 'ethereum' | 'avalanche') {
    const amount = bountyContributions[itemId];
    if (!amount || parseFloat(amount) <= 0) {
      bountyContributionError = 'Please enter a valid amount';
      setTimeout(() => (bountyContributionError = null), 3000);
      return;
    }

    const item = wishlistItems.find((i) => i.id === itemId);
    if (!item) {
      bountyContributionError = 'Bounty not found';
      setTimeout(() => (bountyContributionError = null), 3000);
      return;
    }

    const escrowAddress =
      chain === 'ethereum' ? item.ethereumEscrowAddress : item.avalancheEscrowAddress;
    if (!escrowAddress) {
      bountyContributionError = `No ${chain} escrow contract deployed for this bounty`;
      setTimeout(() => (bountyContributionError = null), 3000);
      return;
    }

    // Use backend wallet proxy instead of MetaMask
    contributingBountyId = itemId;
    bountyContributionError = null;
    bountyContributionSuccess = null;

    try {
      const token = $authStore.accessToken;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${PUBLIC_API_URL}/wallet/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientAddress: escrowAddress,
          chain,
          amountEth: parseFloat(amount),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Transaction failed');
      }

      bountyContributionSuccess = `Contribution sent! Hash: ${result.data.transactionHash}`;
      bountyContributions[itemId] = '';

      setTimeout(async () => {
        await fetchCompany();
        bountyContributionSuccess = null;
      }, 3000);
    } catch (err: any) {
      bountyContributionError = err.message || 'Transaction failed';
      setTimeout(() => (bountyContributionError = null), 5000);
    } finally {
      contributingBountyId = null;
    }
  }

</script>

<svelte:head>
  <title>{company?.name || 'Company'} - Liffey Founders Club</title>
</svelte:head>

<div class="min-h-screen py-12">
  <div class="container mx-auto px-4 max-w-5xl">
    <!-- Back Button -->
    <button 
      class="btn btn-ghost mb-6"
      onclick={goBack}
    >
      <ArrowLeft class="w-5 h-5" />
      Back to Companies
    </button>

    <!-- Loading State -->
    {#if isLoading}
      <div class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    {/if}

    <!-- Error State -->
    {#if error}
      <div class="alert alert-error">
        <span>{error}</span>
      </div>
    {/if}

    <!-- Company Details -->
    {#if company && !isLoading}
      <!-- Company Header -->
      <div class="glass-subtle rounded-3xl p-8 mb-6">
        <div class="flex flex-col md:flex-row gap-6">
          <!-- Logo -->
          <div class="flex-shrink-0">
            {#if company.logoUrl}
              <img 
                src={company.logoUrl} 
                alt={company.name}
                class="w-24 h-24 rounded-2xl object-cover"
              />
            {:else}
              <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Building2 class="w-12 h-12 text-white" />
              </div>
            {/if}
          </div>

          <!-- Company Info -->
          <div class="flex-1">
            <h1 class="text-3xl md:text-4xl font-bold mb-2">{company.name}</h1>
            
            <div class="flex flex-wrap gap-2 mb-4">
              {#if company.industry}
                <span class="badge badge-primary">{company.industry}</span>
              {/if}
              <span class="badge badge-secondary">{stageLabels[company.stage] || company.stage}</span>
              <span class="badge badge-accent">{fundingLabels[company.fundingStage] || company.fundingStage}</span>
            </div>

            <p class="text-lg opacity-80 mb-4">{company.description}</p>

            <!-- Links -->
            <div class="flex flex-wrap gap-3">
              {#if company.website}
                <a 
                  href={company.website} 
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-sm btn-outline"
                >
                  <Globe class="w-4 h-4" />
                  Website
                </a>
              {/if}
              {#if company.linkedinUrl}
                <a 
                  href={company.linkedinUrl} 
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-sm btn-outline"
                >
                  <Linkedin class="w-4 h-4" />
                  LinkedIn
                </a>
              {/if}
              {#if company.twitterUrl}
                <a 
                  href={company.twitterUrl} 
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-sm btn-outline"
                >
                  <Twitter class="w-4 h-4" />
                  Twitter
                </a>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Company Stats -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="glass-subtle rounded-2xl p-6">
          <div class="flex items-center gap-3 mb-2">
            <Users class="w-6 h-6 text-primary" />
            <span class="text-sm opacity-70">Team Size</span>
          </div>
          <p class="text-2xl font-bold">{company.employeeCount} {company.employeeCount === 1 ? 'employee' : 'employees'}</p>
        </div>

        {#if company.location}
          <div class="glass-subtle rounded-2xl p-6">
            <div class="flex items-center gap-3 mb-2">
              <MapPin class="w-6 h-6 text-primary" />
              <span class="text-sm opacity-70">Location</span>
            </div>
            <p class="text-2xl font-bold">{company.location}</p>
          </div>
        {/if}

        {#if company.foundedDate}
          <div class="glass-subtle rounded-2xl p-6">
            <div class="flex items-center gap-3 mb-2">
              <Calendar class="w-6 h-6 text-primary" />
              <span class="text-sm opacity-70">Founded</span>
            </div>
            <p class="text-2xl font-bold">{new Date(company.foundedDate).getFullYear()}</p>
          </div>
        {/if}
      </div>

      <!-- Tags -->
      {#if company.tags && company.tags.length > 0}
        <div class="glass-subtle rounded-2xl p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">Tags</h2>
          <div class="flex flex-wrap gap-2">
            {#each company.tags as tag}
              <span class="badge badge-lg badge-outline">{tag}</span>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Wallet Addresses -->
      {#if (company.ethAddress || company.avaxAddress) && !isOwner}
        <div class="glass-subtle rounded-2xl p-6 mb-6">
          <div class="flex items-center gap-3 mb-6">
            <Wallet class="w-6 h-6 text-primary" />
            <h2 class="text-2xl font-bold">Support This Company</h2>
          </div>

          {#if !$authStore.isAuthenticated}
            <div class="alert alert-info">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <div>
                <h3 class="font-bold">Sign in as an investor to support this company</h3>
                <p class="text-sm">You need to be registered as an investor to view wallet addresses and send donations.</p>
              </div>
            </div>
          {:else if !isInvestor}
            <div class="alert alert-warning">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <div>
                <h3 class="font-bold">Investor access required</h3>
                <p class="text-sm">You need to switch to an investor account to view wallet addresses and send donations. Visit your profile to upgrade your account.</p>
              </div>
            </div>
          {:else if isOwner}
            <div class="alert alert-info">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div>
                <h3 class="font-bold">You own this company</h3>
                <p class="text-sm">You cannot donate to your own company. Other investors can support your company through donations.</p>
              </div>
            </div>
          {:else if canDonate}
            <p class="opacity-80 mb-6">
              Send cryptocurrency directly to this company's wallet using your on-platform wallet. No external wallet is required or allowed.
            </p>
          <div class="space-y-4">
            <!-- Ethereum Address -->
            {#if company.ethAddress}
              <div class="glass-subtle rounded-xl p-4">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="font-semibold flex items-center gap-2">
                    <span class="badge badge-primary">ETH</span>
                    Ethereum Address
                  </h3>
                  <button
                    onclick={() => showEthAddress = !showEthAddress}
                    class="btn btn-sm btn-ghost"
                  >
                    {#if showEthAddress}
                      <EyeOff class="w-4 h-4" />
                    {:else}
                      <Eye class="w-4 h-4" />
                    {/if}
                  </button>
                </div>

                {#if showEthAddress}
                  <div class="flex items-center gap-2 mb-3">
                    <code class="flex-1 px-3 py-2 bg-base-200 rounded text-sm break-all">
                      {company.ethAddress}
                    </code>
                    <button
                      onclick={() => copyAddress(company.ethAddress)}
                      class="btn btn-sm btn-ghost"
                      title="Copy address"
                    >
                      <Copy class="w-4 h-4" />
                    </button>
                  </div>

                  {#if $authStore.isAuthenticated}
                    {#if selectedChain === 'eth'}
                      <div class="space-y-3">
                        <input
                          type="number"
                          bind:value={sendAmount}
                          placeholder="Amount in ETH"
                          step="0.001"
                          min="0"
                          class="input input-bordered w-full"
                        />
                        <div class="flex gap-2">
                          <button
                            onclick={() => sendFunds('eth')}
                            disabled={isSending || !sendAmount}
                            class="btn btn-primary flex-1"
                          >
                            {#if isSending}
                              <span class="loading loading-spinner loading-sm"></span>
                            {:else}
                              <Send class="w-4 h-4" />
                            {/if}
                            Send ETH
                          </button>
                          <button
                            onclick={() => { selectedChain = null; sendAmount = ''; sendError = null; }}
                            class="btn btn-ghost"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    {:else}
                      <button
                        onclick={() => { selectedChain = 'eth'; sendError = null; sendSuccess = null; }}
                        class="btn btn-primary btn-sm w-full"
                      >
                        <Send class="w-4 h-4" />
                        Send ETH
                      </button>
                    {/if}
                  {/if}
                {:else}
                  <p class="text-sm opacity-70">
                    {maskAddress(company.ethAddress)}
                  </p>
                {/if}
              </div>
            {/if}

            <!-- Avalanche Address -->
            {#if company.avaxAddress}
              <div class="glass-subtle rounded-xl p-4">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="font-semibold flex items-center gap-2">
                    <span class="badge badge-error">AVAX</span>
                    Avalanche Address
                  </h3>
                  <button
                    onclick={() => showAvaxAddress = !showAvaxAddress}
                    class="btn btn-sm btn-ghost"
                  >
                    {#if showAvaxAddress}
                      <EyeOff class="w-4 h-4" />
                    {:else}
                      <Eye class="w-4 h-4" />
                    {/if}
                  </button>
                </div>

                {#if showAvaxAddress}
                  <div class="flex items-center gap-2 mb-3">
                    <code class="flex-1 px-3 py-2 bg-base-200 rounded text-sm break-all">
                      {company.avaxAddress}
                    </code>
                    <button
                      onclick={() => copyAddress(company.avaxAddress)}
                      class="btn btn-sm btn-ghost"
                      title="Copy address"
                    >
                      <Copy class="w-4 h-4" />
                    </button>
                  </div>

                  {#if $authStore.isAuthenticated}
                    {#if selectedChain === 'avax'}
                      <div class="space-y-3">
                        <input
                          type="number"
                          bind:value={sendAmount}
                          placeholder="Amount in AVAX"
                          step="0.001"
                          min="0"
                          class="input input-bordered w-full"
                        />
                        <div class="flex gap-2">
                          <button
                            onclick={() => sendFunds('avax')}
                            disabled={isSending || !sendAmount}
                            class="btn btn-error flex-1"
                          >
                            {#if isSending}
                              <span class="loading loading-spinner loading-sm"></span>
                            {:else}
                              <Send class="w-4 h-4" />
                            {/if}
                            Send AVAX
                          </button>
                          <button
                            onclick={() => { selectedChain = null; sendAmount = ''; sendError = null; }}
                            class="btn btn-ghost"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    {:else}
                      <button
                        onclick={() => { selectedChain = 'avax'; sendError = null; sendSuccess = null; }}
                        class="btn btn-error btn-sm w-full"
                      >
                        <Send class="w-4 h-4" />
                        Send AVAX
                      </button>
                    {/if}
                  {/if}
                {:else}
                  <p class="text-sm opacity-70">
                    {maskAddress(company.avaxAddress)}
                  </p>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Send Status Messages -->
          {#if sendSuccess}
            <div class="alert alert-success mt-4">
              <span class="text-sm break-all">{sendSuccess}</span>
            </div>
          {/if}

          {#if sendError}
            <div class="alert alert-error mt-4">
              <span class="text-sm">{sendError}</span>
            </div>
          {/if}
          {/if}
        </div>
      {/if}

      <!-- Wishlist -->
      {#if wishlistItems.length > 0}
        <div class="glass-subtle rounded-2xl p-6 mb-6">
          <div class="flex items-center gap-3 mb-6">
            <Target class="w-6 h-6 text-primary" />
            <h2 class="text-2xl font-bold">Company Wishlist</h2>
          </div>

          {#if wishlistItems.length > 0}
            <p class="opacity-80 mb-6">
              {isInvestor && !isOwner ? 'Support this company with their needs:' : 'Looking for support in the following areas:'}
            </p>

            <!-- Donation Status Messages -->
            {#if donationSuccess}
              <div class="alert alert-success mb-4">
                <span class="text-sm">{donationSuccess}</span>
              </div>
            {/if}

            {#if donationError}
              <div class="alert alert-error mb-4">
                <span class="text-sm">{donationError}</span>
              </div>
            {/if}

            <div class="space-y-4">
              {#each wishlistItems as item}
                {@const Icon = categoryIcons[item.category] || Circle}
                {@const priorityColors: Record<string, string> = {
                  low: 'badge-ghost',
                  medium: 'badge-info',
                  high: 'badge-warning',
                  critical: 'badge-error'
                }}
                {@const liveBounty = item.isEscrowActive ? liveBounties[item.id] : null}
                {@const percentage = liveBounty
                  ? (liveBounty.progressPercentage || 0)
                  : (item.value ? Math.min(100, ((item.amountRaised || 0) / item.value) * 100) : 0)}
                {@const raisedDisplay = liveBounty
                  ? (liveBounty.totalRaisedEur > 0
                      ? `€${(liveBounty.totalRaisedEur as number).toFixed(2)} (all chains)`
                      : `${parseFloat(liveBounty.raisedAmount || '0').toFixed(4)} ETH`)
                  : `€${(item.amountRaised || 0).toLocaleString()}`}
                {@const targetDisplay = liveBounty
                  ? `€${parseFloat(liveBounty.targetAmount || item.value || '0').toLocaleString()}`
                  : `€${(item.value || 0).toLocaleString()}`}
                {@const remaining = liveBounty ? null : (item.value ? Math.max(0, item.value - (item.amountRaised || 0)) : 0)}
                {@const closed = isBountyClosed(item, liveBounty)}

                <details class="card mb-4 {closed ? 'opacity-60' : ''} shadow-lg" >
                  <summary class="cursor-pointer flex justify-between items-center py-2">
                    <span class="font-semibold text-lg">{item.title}</span>
                    {#if closed}
                      <span class="badge badge-ghost">Closed</span>
                    {/if}
                  </summary>
                  <div class="glass-subtle rounded-xl p-4">
                  <div class="flex items-start gap-4">
                    <div class="flex-shrink-0 mt-1">
                      {#if item.isFulfilled}
                        <CheckCircle class="w-6 h-6 text-success" />
                      {:else}
                        <Icon class="w-6 h-6 text-primary" />
                      {/if}
                    </div>

                    <div class="flex-1">
                      <div class="flex items-start justify-between gap-4 mb-2">
                        <h3 class="text-lg font-semibold">{item.title}</h3>
                        <div class="flex gap-2">
                          <span class="badge badge-sm {priorityColors[item.priority] || 'badge-ghost'}">{item.priority}</span>
                          <span class="badge badge-sm badge-outline capitalize">{item.category}</span>
                        </div>
                      </div>
                      
                      {#if item.description}
                        <p class="opacity-80 mb-3">{item.description}</p>
                      {/if}

                        {#if item.value}
                          <div class="mt-3">
                            <div class="flex justify-between text-sm mb-2">
                              <span class="opacity-70">Funding Progress
                                {#if liveBounty && isFetchingBounties}
                                  <span class="loading loading-xs loading-spinner ml-1"></span>
                                {:else if liveBounty}
                                  <span class="badge badge-xs badge-success ml-1">live</span>
                                {/if}
                              </span>
                              <span class="font-semibold">{percentage.toFixed(0)}% complete</span>
                            </div>
                            <progress class="progress {percentage >= 100 ? 'progress-success' : percentage >= 75 ? 'progress-info' : percentage >= 50 ? 'progress-warning' : 'progress-primary'} w-full h-3 mb-2" value={percentage} max="100"></progress>
                            <div class="flex justify-between text-sm opacity-70">
                              <span>Raised: {raisedDisplay}</span>
                              <span>Goal: {targetDisplay}</span>
                            </div>
                            {#if percentage >= 100}
                              <p class="text-sm mt-2 text-success font-semibold">
                                🎉 Goal reached!
                              </p>
                            {:else if remaining !== null && remaining > 0}
                              <p class="text-sm mt-2 opacity-60">
                                €{remaining.toLocaleString()} remaining to reach goal
                              </p>
                            {/if}
                            {#if closed && !item.isFulfilled}
                              <p class="text-sm mt-2 text-warning font-semibold">
                                ⏳ This bounty has expired and is no longer accepting contributions.
                              </p>
                            {/if}
                            {#if closed && !item.hasConfirmedPayment && !item.isEscrowActive}
                              <p class="text-sm mt-2 text-warning font-semibold">
                                ⚠️ This wishlist item has expired and cannot be redeployed. Create a new item instead.
                              </p>
                            {:else if item.hasConfirmedPayment && !item.isEscrowActive}
                              <p class="text-sm mt-2 text-warning font-semibold">
                                🕒 Deployment pending – payment has been confirmed.
                              </p>
                            {/if}

                          <!-- Contract Info Section for Company Owner -->
                          {#if item.isEscrowActive && isOwner && (item.ethereumEscrowAddress || item.avalancheEscrowAddress)}
                            <div class="mt-4 p-4 bg-success/10 rounded-lg border-2 border-success/30">
                              <div class="flex items-center gap-2 mb-3">
                                <CheckCircle class="w-5 h-5 text-success" />
                                <p class="font-semibold">Escrow Contracts Deployed</p>
                              </div>
                              
                              {#if item.ethereumEscrowAddress}
                                <div class="mb-2">
                                  <div class="flex items-center justify-between mb-1">
                                    <span class="text-xs font-semibold flex items-center gap-1">
                                      <span class="badge badge-primary badge-xs">ETH</span>
                                      Ethereum Sepolia
                                    </span>
                                    <button
                                      class="btn btn-ghost btn-xs gap-1"
                                      onclick={() => window.open(`https://sepolia.etherscan.io/address/${item.ethereumEscrowAddress}`, '_blank')}
                                    >
                                      View
                                      <ExternalLink class="w-3 h-3" />
                                    </button>
                                  </div>
                                  <code class="text-xs bg-base-200 px-2 py-1 rounded block truncate">{item.ethereumEscrowAddress}</code>
                                </div>
                              {/if}
                              
                              {#if item.avalancheEscrowAddress}
                                <div>
                                  <div class="flex items-center justify-between mb-1">
                                    <span class="text-xs font-semibold flex items-center gap-1">
                                      <span class="badge badge-error badge-xs">AVAX</span>
                                      Avalanche Fuji
                                    </span>
                                    <button
                                      class="btn btn-ghost btn-xs gap-1"
                                      onclick={() => window.open(`https://testnet.snowtrace.io/address/${item.avalancheEscrowAddress}`, '_blank')}
                                    >
                                      View
                                      <ExternalLink class="w-3 h-3" />
                                    </button>
                                  </div>
                                  <code class="text-xs bg-base-200 px-2 py-1 rounded block truncate">{item.avalancheEscrowAddress}</code>
                                </div>
                              {/if}

                              <p class="text-xs opacity-70 mt-3">
                                Investors can now contribute via blockchain escrow. View bounty details in the <a href="/bounties" class="link">Bounties page</a>{#if liveBounty} or <a href="/bounties/{item.id}" class="link link-primary">see live progress</a>{/if}.
                              </p>
                            </div>
                          {/if}

                          <!-- Escrow Contribution for Investors (Blockchain) -->
                          {#if item.isEscrowActive && isInvestor && !isOwner && percentage < 100 && !closed}
                            <div class="mt-4 p-4 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg border-2 border-primary/20">
                              <div class="flex items-center gap-2 mb-3">
                                <span class="badge badge-primary badge-sm">🔗 Blockchain Escrow</span>
                                <span class="text-xs opacity-70">Time-locked smart contract</span>
                              </div>
                              
                              {#if bountyContributionSuccess}
                                <div class="alert alert-success mb-3">
                                  <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  <span class="text-sm">{bountyContributionSuccess}</span>
                                </div>
                              {/if}
                              
                              {#if bountyContributionError}
                                <div class="alert alert-error mb-3">
                                  <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  <span class="text-sm">{bountyContributionError}</span>
                                </div>
                              {/if}
                              
                              <p class="text-sm font-semibold mb-3">Contribute via Smart Contract:</p>
                              
                              <!-- Network Selector -->
                              <div class="flex flex-wrap gap-2 mb-3">
                                {#if item.ethereumEscrowAddress}
                                  <button
                                    class="btn btn-xs {selectedBountyChain[item.id] === 'ethereum' ? 'btn-primary' : 'btn-outline'}"
                                    onclick={() => selectedBountyChain[item.id] = 'ethereum'}
                                    disabled={contributingBountyId === item.id || recordingManualContribId === item.id}
                                  >
                                    ETH Sepolia
                                  </button>
                                {/if}
                                {#if item.avalancheEscrowAddress}
                                  <button
                                    class="btn btn-xs {selectedBountyChain[item.id] === 'avalanche' ? 'btn-primary' : 'btn-outline'}"
                                    onclick={() => selectedBountyChain[item.id] = 'avalanche'}
                                    disabled={contributingBountyId === item.id || recordingManualContribId === item.id || closed}
                                  >
                                    AVAX Fuji
                                  </button>
                                {/if}
                                {#if liveBounty?.solanaWalletAddress}
                                  <button
                                    class="btn btn-xs {selectedBountyChain[item.id] === 'solana' ? 'btn-success' : 'btn-outline btn-success'}"
                                    onclick={() => selectedBountyChain[item.id] = 'solana'}
                                    disabled={recordingManualContribId === item.id}
                                  >
                                    SOL
                                  </button>
                                {/if}
                                {#if liveBounty?.stellarWalletAddress}
                                  <button
                                    class="btn btn-xs {selectedBountyChain[item.id] === 'stellar' ? 'btn-warning' : 'btn-outline btn-warning'}"
                                    onclick={() => selectedBountyChain[item.id] = 'stellar'}
                                    disabled={recordingManualContribId === item.id}
                                  >
                                    XLM
                                  </button>
                                {/if}
                                {#if liveBounty?.bitcoinWalletAddress}
                                  <button
                                    class="btn btn-xs {selectedBountyChain[item.id] === 'bitcoin' ? 'btn-warning' : 'btn-outline btn-warning'}"
                                    onclick={() => selectedBountyChain[item.id] = 'bitcoin'}
                                    disabled={recordingManualContribId === item.id}
                                  >
                                    BTC
                                  </button>
                                {/if}
                              </div>
                              
                              {#if selectedBountyChain[item.id] === 'ethereum' || selectedBountyChain[item.id] === 'avalanche'}
                                <!-- EVM: contribution via platform wallet (no MetaMask) -->
                                <div class="flex gap-2">
                                  <input
                                    type="number"
                                    bind:value={bountyContributions[item.id]}
                                    placeholder={`Amount in ${selectedBountyChain[item.id] === 'ethereum' ? 'ETH' : 'AVAX'}`}
                                    step="0.01"
                                    min="0.01"
                                    class="input input-bordered input-sm flex-1"
                                    disabled={contributingBountyId === item.id}
                                  />
                                  <button 
                                    class="btn btn-primary btn-sm"
                                    onclick={() => contributeToEscrow(item.id, selectedBountyChain[item.id] as 'ethereum' | 'avalanche')}
                                    disabled={contributingBountyId === item.id || !bountyContributions[item.id] || closed}
                                  >
                                    {#if contributingBountyId === item.id}
                                      <span class="loading loading-spinner loading-xs"></span>
                                    {:else}
                                      <Wallet class="w-4 h-4" />
                                    {/if}
                                    Contribute
                                  </button>
                                </div>
                                {#if item.campaignDeadline}
                                  <p class="text-xs opacity-60 mt-2">
                                    ⚠️ Funds locked until {new Date(item.campaignDeadline).toLocaleDateString()}. Refunded if target not met (minus gas fees split among contributors).
                                  </p>
                                {/if}

                              {:else if selectedBountyChain[item.id] === 'solana' || selectedBountyChain[item.id] === 'stellar' || selectedBountyChain[item.id] === 'bitcoin'}
                                <!-- Non-EVM: send directly to company wallet, then record here -->
                                {@const chainLabel = selectedBountyChain[item.id] === 'solana' ? 'SOL' : selectedBountyChain[item.id] === 'stellar' ? 'XLM' : 'BTC'}
                                {@const walletAddr = selectedBountyChain[item.id] === 'solana'
                                  ? liveBounty?.solanaWalletAddress
                                  : selectedBountyChain[item.id] === 'stellar'
                                    ? liveBounty?.stellarWalletAddress
                                    : liveBounty?.bitcoinWalletAddress}

                                {#if walletAddr}
                                  <div class="mb-3">
                                    <p class="text-xs font-semibold mb-1 opacity-70">Send {chainLabel} to this address:</p>
                                    <div class="flex items-center gap-2 bg-base-200 rounded px-3 py-2">
                                      <code class="text-xs break-all flex-1">{walletAddr}</code>
                                      <button class="btn btn-ghost btn-xs" onclick={() => navigator.clipboard.writeText(walletAddr)} title="Copy">
                                        <Copy class="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  {#if manualContribSuccess}
                                    <div class="alert alert-success alert-sm mb-2 py-2">
                                      <span class="text-xs">{manualContribSuccess}</span>
                                    </div>
                                  {/if}
                                  {#if manualContribError}
                                    <div class="alert alert-error alert-sm mb-2 py-2">
                                      <span class="text-xs">{manualContribError}</span>
                                    </div>
                                  {/if}

                                  <p class="text-xs font-semibold mb-2 opacity-80">After sending, record your contribution:</p>
                                  <div class="space-y-2">
                                    <input
                                      type="number"
                                      bind:value={manualContribAmounts[item.id]}
                                      placeholder={`Amount sent in ${chainLabel}`}
                                      step="0.000001"
                                      min="0.000001"
                                      class="input input-bordered input-sm w-full"
                                      disabled={recordingManualContribId === item.id}
                                    />
                                    <input
                                      type="text"
                                      bind:value={manualContribTxHashes[item.id]}
                                      placeholder="Transaction hash"
                                      class="input input-bordered input-sm w-full font-mono text-xs"
                                      disabled={recordingManualContribId === item.id}
                                    />
                                    <button
                                      class="btn btn-success btn-sm w-full"
                                      onclick={() => recordManualContribution(item.id, selectedBountyChain[item.id])}
                                      disabled={recordingManualContribId === item.id || !manualContribAmounts[item.id] || !manualContribTxHashes[item.id]}
                                    >
                                      {#if recordingManualContribId === item.id}
                                        <span class="loading loading-spinner loading-xs"></span>
                                      {:else}
                                        <CheckCircle class="w-4 h-4" />
                                      {/if}
                                      Record Contribution
                                    </button>
                                  </div>
                                  <p class="text-xs opacity-50 mt-2">Your contribution will be converted to EUR at the current rate and added to the campaign total.</p>
                                {/if}
                              {:else}
                                <p class="text-xs opacity-60 text-center py-2">
                                  ↑ Select a network to contribute
                                </p>
                              {/if}
                            </div>
                          <!-- Regular Donation for Investors (Non-escrow) -->
                          {:else if !item.isEscrowActive && isInvestor && !isOwner && (remaining ?? 0) > 0 && !closed}
                            <div class="mt-4 p-4 bg-base-200/50 rounded-lg">
                              <p class="text-sm font-semibold mb-2">Support this need:</p>
                              <div class="flex gap-2">
                                <input
                                  type="number"
                                  bind:value={donationAmounts[item.id]}
                                  placeholder="Amount ($)"
                                  step="1"
                                  min="1"
                                  max={remaining ?? undefined}
                                  class="input input-bordered input-sm flex-1"
                                  disabled={donatingItemId === item.id}
                                />
                                <button 
                                  class="btn btn-primary btn-sm"
                                  onclick={() => donateToWishlistItem(item.id)}
                                  disabled={donatingItemId === item.id || !donationAmounts[item.id] || closed}
                                >
                                  {#if donatingItemId === item.id}
                                    <span class="loading loading-spinner loading-xs"></span>
                                  {:else}
                                    <DollarSign class="w-4 h-4" />
                                  {/if}
                                  Donate
                                </button>
                              </div>
                              <p class="text-xs opacity-60 mt-2">
                                Donations help companies achieve their goals faster
                              </p>
                            </div>
                          {/if}
                        </div>
                        {:else}
                          <p class="text-sm opacity-60 mt-2">
                            {(liveBounty?.raisedAmount && parseFloat(liveBounty.raisedAmount) > 0)
                              ? `Raised: ${parseFloat(liveBounty.raisedAmount).toFixed(4)} ETH`
                              : (item.amountRaised > 0 
                                  ? `Total support received: €${(item.amountRaised || 0).toLocaleString()}` 
                                  : 'No monetary goal set')}
                          </p>
                        {/if}

                      {#if item.isFulfilled}
                        <span class="text-success text-sm mt-2 inline-block">✓ Fulfilled</span>
                      {/if}
                    </div>
                  </div>
                </div>
              </details>
              {/each}
            </div>
          {:else}
            <p class="opacity-60 text-center py-8">No wishlist items yet</p>
          {/if}
        </div>
      {/if}

      <!-- Contact Section -->
      <div class="glass-subtle rounded-2xl p-6 text-center">
        <h2 class="text-2xl font-bold mb-4">Interested in connecting?</h2>
        <p class="opacity-80 mb-6">
          Reach out through the Liffey Founders Club community or contact the founder directly.
        </p>
        {#if $authStore.isAuthenticated}
          <button class="btn btn-primary">
            Send Message
          </button>
        {:else}
          <button class="btn btn-primary" onclick={() => goto('/auth')}>
            Sign In to Connect
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>
