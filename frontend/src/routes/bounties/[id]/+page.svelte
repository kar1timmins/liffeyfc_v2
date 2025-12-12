<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { 
    ArrowLeft, 
    Calendar, 
    Users, 
    Clock,
    Wallet,
    AlertCircle,
    Building2,
    ExternalLink,
    RefreshCw,
    Copy,
    Check
  } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { authStore } from '$lib/stores/auth';
  import { toastStore } from '$lib/stores/toast';

  let bounty = $state<any>(null);
  let contributors = $state<any[]>([]);
  let isLoading = $state(true);
  let isLoadingContributors = $state(false);
  let isSyncing = $state(false);
  let error = $state<string | null>(null);
  let showContributors = $state(false);
  let copiedAddress = $state<string | null>(null);

  const bountyId = $derived($page.params.id);
  const isInvestor = $derived($authStore.user?.role === 'investor');

  onMount(() => {
    fetchBounty();
    fetchContributors();
    // Poll for updates every 30 seconds
    const interval = setInterval(() => {
      fetchBounty();
      if (showContributors) {
        fetchContributors();
      }
    }, 30000);
    return () => clearInterval(interval);
  });

  async function fetchBounty() {
    if (!bountyId) return;

    isLoading = true;
    error = null;

    try {
      const response = await fetch(`${PUBLIC_API_URL}/bounties/${bountyId}`);
      const data = await response.json();

      if (data.success) {
        bounty = data.data;
        console.log('📦 Bounty data loaded:', {
          id: bounty.id,
          title: bounty.title,
          isEscrowActive: bounty.isEscrowActive,
          ethereumEscrowAddress: bounty.ethereumEscrowAddress,
          avalancheEscrowAddress: bounty.avalancheEscrowAddress,
          hasEthAddress: !!bounty.ethereumEscrowAddress,
          hasAvaxAddress: !!bounty.avalancheEscrowAddress
        });
      } else {
        error = data.message || 'Failed to fetch bounty';
      }
    } catch (err: any) {
      error = err.message || 'Failed to fetch bounty';
    } finally {
      isLoading = false;
    }
  }

  async function fetchContributors() {
    if (!bountyId) return;

    isLoadingContributors = true;

    try {
      const response = await fetch(`${PUBLIC_API_URL}/bounties/${bountyId}/contributors`);
      const data = await response.json();

      if (data.success) {
        contributors = data.data || [];
      }
    } catch (err: any) {
      console.error('Failed to fetch contributors:', err);
    } finally {
      isLoadingContributors = false;
    }
  }

  async function syncWithBlockchain() {
    if (!bountyId) return;

    isSyncing = true;

    try {
      const response = await fetch(`${PUBLIC_API_URL}/bounties/${bountyId}/sync`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        bounty = data.data;
        await fetchContributors();
        toastStore.add({ message: 'Synced with blockchain', type: 'success' });
      } else {
        toastStore.add({ message: 'Failed to sync', type: 'error' });
      }
    } catch (err: any) {
      toastStore.add({ message: 'Failed to sync with blockchain', type: 'error' });
    } finally {
      isSyncing = false;
    }
  }

  function goToCompanyPage() {
    if (bounty?.company?.id) {
      goto(`/companies/${bounty.company.id}`);
    }
  }

  function goBack() {
    goto('/bounties');
  }

  function formatCurrency(value: string | number) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR'
    }).format(num);
  }

  function formatCrypto(value: string | number) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toFixed(4);
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString('en-IE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function formatTimeRemaining(deadline: string) {
    const now = new Date();
    const end = new Date(deadline);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }

  function formatAddress(address: string) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function toggleContributors() {
    showContributors = !showContributors;
    if (showContributors && contributors.length === 0) {
      fetchContributors();
    }
  }

  function getStatusBadge(status: string) {
    const badges: Record<string, { class: string; label: string }> = {
      active: { class: 'badge-success', label: 'Active' },
      funded: { class: 'badge-info', label: 'Funded' },
      expired: { class: 'badge-ghost', label: 'Expired' },
      pending: { class: 'badge-warning', label: 'Pending' }
    };
    return badges[status] || { class: 'badge-ghost', label: status };
  }

  function viewOnExplorer(chain: 'ethereum' | 'avalanche', address: string) {
    const baseUrl = chain === 'ethereum' 
      ? 'https://sepolia.etherscan.io/address/'
      : 'https://testnet.snowtrace.io/address/';
    window.open(baseUrl + address, '_blank');
  }

  async function copyToClipboard(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      copiedAddress = address;
      toastStore.add({ message: 'Contract address copied to clipboard', type: 'success' });
      setTimeout(() => copiedAddress = null, 2000);
    } catch (err) {
      toastStore.add({ message: 'Failed to copy address', type: 'error' });
    }
  }
</script>

<svelte:head>
  <title>{bounty?.title || 'Bounty'} - Liffey Founders Club</title>
</svelte:head>

<div class="min-h-screen py-12">
  <div class="container mx-auto px-4 max-w-5xl">
    <!-- Back Button -->
    <button 
      class="btn btn-ghost gap-2 mb-6"
      onclick={goBack}
    >
      <ArrowLeft class="w-5 h-5" />
      Back to Bounties
    </button>

    <!-- Loading State -->
    {#if isLoading && !bounty}
      <div class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    {/if}

    <!-- Error State -->
    {#if error}
      <div class="alert alert-error">
        <AlertCircle class="w-5 h-5" />
        <span>{error}</span>
      </div>
    {/if}

    <!-- Bounty Details -->
    {#if bounty && !isLoading}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main Content -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Header Card -->
          <div class="card bg-base-100 shadow-xl border border-base-300">
            <div class="card-body">
              <!-- Status Badge -->
              <div class="flex justify-between items-start mb-4">
                <span class="badge {getStatusBadge(bounty.status).class} badge-lg">
                  {getStatusBadge(bounty.status).label}
                </span>
                <div class="flex items-center gap-2 text-sm opacity-70">
                  <Calendar class="w-4 h-4" />
                  <span>Created {formatDate(bounty.createdAt)}</span>
                </div>
              </div>

              <!-- Title -->
              <h1 class="text-3xl font-bold mb-4">{bounty.title}</h1>

              <!-- Company Info -->
              <div class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                <div class="avatar placeholder">
                  <div class="bg-primary text-primary-content rounded-full w-12">
                    <span>{bounty.company?.name?.charAt(0) || 'C'}</span>
                  </div>
                </div>
                <div>
                  <h3 class="font-semibold">{bounty.company?.name || 'Unknown Company'}</h3>
                  <div class="flex items-center gap-2 text-sm opacity-70">
                    <Building2 class="w-3 h-3" />
                    {bounty.company?.industry || 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Description Card -->
          <div class="card bg-base-100 shadow-xl border border-base-300">
            <div class="card-body">
              <h2 class="card-title text-xl mb-4">About This Bounty</h2>
              <p class="whitespace-pre-wrap opacity-90">
                {bounty.description || 'No description provided'}
              </p>
            </div>
          </div>

          <!-- Smart Contract Details -->
          {#if bounty.isEscrowActive}
            <div class="card bg-gradient-to-br from-primary/5 to-secondary/5 shadow-xl border-2 border-primary/30">
              <div class="card-body">
                <h2 class="card-title text-xl mb-4 flex items-center gap-2">
                  <Wallet class="w-6 h-6 text-primary" />
                  Smart Contract Details
                </h2>
                
                <div class="alert alert-info mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <span class="text-sm">Funds are held securely in blockchain escrow contracts. You can verify transactions on the blockchain explorer.</span>
                </div>

                {#if !bounty.ethereumEscrowAddress && !bounty.avalancheEscrowAddress}
                  <div class="alert alert-warning">
                    <AlertCircle class="w-5 h-5" />
                    <div class="flex-1">
                      <p class="font-semibold">Smart Contracts Pending Deployment</p>
                      <p class="text-sm">The escrow contracts for this bounty haven't been deployed to the blockchain yet. The company owner can deploy them from the company page.</p>
                    </div>
                  </div>
                {:else}
                  <div class="space-y-4">
                    {#if bounty.ethereumEscrowAddress}
                      <div class="p-4 bg-base-100 border-2 border-primary/20 rounded-lg hover:border-primary/40 transition-colors">
                      <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2">
                          <div class="badge badge-primary gap-1">
                            <span class="w-2 h-2 bg-primary-content rounded-full"></span>
                            Ethereum Sepolia
                          </div>
                          <span class="text-xs opacity-60">Testnet</span>
                        </div>
                        <div class="flex gap-2">
                          <button
                            onclick={() => copyToClipboard(bounty.ethereumEscrowAddress)}
                            class="btn btn-ghost btn-xs gap-1"
                            title="Copy address"
                          >
                            {#if copiedAddress === bounty.ethereumEscrowAddress}
                              <Check class="w-3 h-3 text-success" />
                            {:else}
                              <Copy class="w-3 h-3" />
                            {/if}
                          </button>
                          <button
                            onclick={() => viewOnExplorer('ethereum', bounty.ethereumEscrowAddress)}
                            class="btn btn-primary btn-xs gap-1"
                          >
                            View on Etherscan
                            <ExternalLink class="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div class="bg-base-200 p-3 rounded font-mono text-xs break-all">
                        {bounty.ethereumEscrowAddress}
                      </div>
                    </div>
                  {/if}

                  {#if bounty.avalancheEscrowAddress}
                    <div class="p-4 bg-base-100 border-2 border-error/20 rounded-lg hover:border-error/40 transition-colors">
                      <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2">
                          <div class="badge badge-error gap-1">
                            <span class="w-2 h-2 bg-error-content rounded-full"></span>
                            Avalanche Fuji
                          </div>
                          <span class="text-xs opacity-60">Testnet</span>
                        </div>
                        <div class="flex gap-2">
                          <button
                            onclick={() => copyToClipboard(bounty.avalancheEscrowAddress)}
                            class="btn btn-ghost btn-xs gap-1"
                            title="Copy address"
                          >
                            {#if copiedAddress === bounty.avalancheEscrowAddress}
                              <Check class="w-3 h-3 text-success" />
                            {:else}
                              <Copy class="w-3 h-3" />
                            {/if}
                          </button>
                          <button
                            onclick={() => viewOnExplorer('avalanche', bounty.avalancheEscrowAddress)}
                            class="btn btn-error btn-xs gap-1"
                          >
                            View on Snowtrace
                            <ExternalLink class="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div class="bg-base-200 p-3 rounded font-mono text-xs break-all">
                        {bounty.avalancheEscrowAddress}
                      </div>
                    </div>
                  {/if}
                  </div>

                  <div class="mt-4 text-xs opacity-60 text-center">
                    💡 Click the address to copy or view on blockchain explorer for full transaction history
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
          <!-- Progress Card -->
          <div class="card bg-gradient-to-br from-primary/10 to-secondary/10 shadow-xl border border-primary/20">
            <div class="card-body">
              <h3 class="card-title text-lg mb-4">Funding Progress</h3>

              <!-- Progress Bar -->
              <div class="mb-4">
                <progress 
                  class="progress progress-primary w-full h-4" 
                  value={bounty.progressPercentage || 0} 
                  max="100"
                ></progress>
                <div class="text-center mt-2">
                  <span class="text-2xl font-bold">{bounty.progressPercentage || 0}%</span>
                  <span class="text-sm opacity-70 ml-1">funded</span>
                </div>
              </div>

              <!-- Amounts -->
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="opacity-70">Raised</span>
                  <span class="font-bold">{formatCurrency(bounty.raisedAmount || 0)}</span>
                </div>
                <div class="divider my-0"></div>
                <div class="flex justify-between">
                  <span class="opacity-70">Target</span>
                  <span class="font-bold text-primary">{formatCurrency(bounty.targetAmount || 0)}</span>
                </div>
              </div>

              <!-- Stats -->
              <div class="grid grid-cols-2 gap-3 mt-4">
                <div class="stat bg-base-100 rounded-lg p-3">
                  <div class="stat-figure text-primary">
                    <Users class="w-6 h-6" />
                  </div>
                  <div class="stat-value text-2xl">{bounty.contributorCount || 0}</div>
                  <div class="stat-desc">Backers</div>
                </div>
                <div class="stat bg-base-100 rounded-lg p-3">
                  <div class="stat-figure text-warning">
                    <Clock class="w-6 h-6" />
                  </div>
                  <div class="stat-value text-2xl">{formatTimeRemaining(bounty.deadline)}</div>
                  <div class="stat-desc">Remaining</div>
                </div>
              </div>

              <!-- Blockchain Sync Button -->
              <button
                onclick={syncWithBlockchain}
                disabled={isSyncing}
                class="btn btn-sm btn-outline btn-primary w-full mt-4 gap-2"
              >
                <RefreshCw class="w-4 h-4 {isSyncing ? 'animate-spin' : ''}" />
                {isSyncing ? 'Syncing...' : 'Sync with Blockchain'}
              </button>

              <!-- Contributors Toggle -->
              {#if bounty.contributorCount > 0}
                <button
                  onclick={toggleContributors}
                  class="btn btn-sm btn-ghost w-full mt-2 gap-2"
                >
                  <Users class="w-4 h-4" />
                  {showContributors ? 'Hide' : 'View'} Contributors ({bounty.contributorCount})
                </button>
              {/if}

              <!-- Deadline -->
              <div class="mt-4 p-3 bg-base-100 rounded-lg">
                <div class="flex justify-between text-sm">
                  <span class="opacity-70">Deadline</span>
                  <span class="font-semibold">{formatDate(bounty.deadline)}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Contributors List -->
          {#if showContributors}
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <h3 class="card-title text-lg mb-4 flex items-center gap-2">
                  <Users class="w-5 h-5" />
                  Contributors
                </h3>

                {#if isLoadingContributors}
                  <div class="flex justify-center py-8">
                    <span class="loading loading-spinner loading-md"></span>
                  </div>
                {:else if contributors.length === 0}
                  <p class="text-center py-8 opacity-70">No contributors yet</p>
                {:else}
                  <div class="space-y-2">
                    {#each contributors as contributor, index}
                      <div class="flex items-center justify-between p-3 bg-base-200 rounded-lg hover:bg-base-300 transition-colors">
                        <div class="flex items-center gap-3">
                          <div class="avatar placeholder">
                            <div class="bg-neutral text-neutral-content rounded-full w-10">
                              <span class="text-xs">#{index + 1}</span>
                            </div>
                          </div>
                          <div>
                            <code class="text-sm font-mono">{formatAddress(contributor.address)}</code>
                            <p class="text-xs opacity-70">Backer</p>
                          </div>
                        </div>
                        <div class="text-right">
                          <p class="font-bold text-primary">{formatCrypto(contributor.amountEth)} ETH</p>
                          <p class="text-xs opacity-70">
                            ≈ {formatCurrency(parseFloat(contributor.amountEth) * 3200)}
                          </p>
                        </div>
                      </div>
                    {/each}
                  </div>

                  <!-- Total Summary -->
                  <div class="divider"></div>
                  <div class="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                    <span class="font-semibold">Total Raised</span>
                    <div class="text-right">
                      <p class="font-bold text-lg text-primary">
                        {formatCrypto(contributors.reduce((sum, c) => sum + parseFloat(c.amountEth), 0))} ETH
                      </p>
                      <p class="text-sm opacity-70">
                        from {contributors.length} contributor{contributors.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Contribution Card -->
          {#if isInvestor && bounty.status === 'active'}
            <div class="card bg-gradient-to-br from-primary/10 to-secondary/10 shadow-xl border border-primary/20">
              <div class="card-body">
                <h3 class="card-title text-lg mb-4 flex items-center gap-2">
                  <Wallet class="w-5 h-5" />
                  Ready to Contribute?
                </h3>

                <p class="text-sm opacity-80 mb-4">
                  Visit the company page to contribute via blockchain escrow. Your funds are secured by smart contracts and refunded if the target isn't met.
                </p>

                <div class="alert alert-info text-sm mb-4">
                  <AlertCircle class="w-4 h-4" />
                  <div>
                    <p class="font-semibold">Escrow Protection</p>
                    <p class="text-xs">If target not met by deadline, funds returned minus gas fees (split proportionally).</p>
                  </div>
                </div>

                <button
                  onclick={goToCompanyPage}
                  class="btn btn-primary w-full gap-2"
                >
                  <Building2 class="w-4 h-4" />
                  Go to Company Page to Contribute
                </button>

                <p class="text-xs text-center opacity-70 mt-2">
                  Contributions accepted in ETH or AVAX
                </p>
              </div>
            </div>
          {:else if isInvestor && bounty.status !== 'active'}
            <div class="alert alert-info">
              <AlertCircle class="w-5 h-5" />
              <span>This bounty is no longer accepting contributions</span>
            </div>
          {:else if !isInvestor}
            <div class="alert alert-warning">
              <AlertCircle class="w-5 h-5" />
              <div>
                <p class="font-semibold">Investor Access Required</p>
                <p class="text-sm">Please register as an investor to contribute to bounties</p>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
