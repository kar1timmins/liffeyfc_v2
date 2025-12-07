<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { 
    ArrowLeft, 
    Target, 
    Calendar, 
    DollarSign, 
    Users, 
    Clock,
    Wallet,
    CheckCircle,
    AlertCircle,
    TrendingUp,
    Building2,
    Send,
    ExternalLink
  } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { authStore } from '$lib/stores/auth';
  import { toastStore } from '$lib/stores/toast';

  let bounty = $state<any>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  const bountyId = $derived($page.params.id);
  const isInvestor = $derived($authStore.user?.role === 'investor');

  onMount(() => {
    fetchBounty();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchBounty, 30000);
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
      } else {
        error = data.message || 'Failed to fetch bounty';
      }
    } catch (err: any) {
      error = err.message || 'Failed to fetch bounty';
    } finally {
      isLoading = false;
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
            <div class="card bg-base-100 shadow-xl border border-base-300">
              <div class="card-body">
                <h2 class="card-title text-xl mb-4 flex items-center gap-2">
                  <Wallet class="w-5 h-5" />
                  Smart Contract Addresses
                </h2>

                <div class="space-y-4">
                  {#if bounty.ethereumEscrowAddress}
                    <div class="p-4 bg-base-200 rounded-lg">
                      <div class="flex justify-between items-center mb-2">
                        <span class="font-semibold">Ethereum (Sepolia)</span>
                        <button
                          onclick={() => viewOnExplorer('ethereum', bounty.ethereumEscrowAddress)}
                          class="btn btn-ghost btn-xs gap-1"
                        >
                          View on Explorer
                          <ExternalLink class="w-3 h-3" />
                        </button>
                      </div>
                      <code class="text-xs break-all opacity-70">
                        {bounty.ethereumEscrowAddress}
                      </code>
                    </div>
                  {/if}

                  {#if bounty.avalancheEscrowAddress}
                    <div class="p-4 bg-base-200 rounded-lg">
                      <div class="flex justify-between items-center mb-2">
                        <span class="font-semibold">Avalanche (Fuji)</span>
                        <button
                          onclick={() => viewOnExplorer('avalanche', bounty.avalancheEscrowAddress)}
                          class="btn btn-ghost btn-xs gap-1"
                        >
                          View on Explorer
                          <ExternalLink class="w-3 h-3" />
                        </button>
                      </div>
                      <code class="text-xs break-all opacity-70">
                        {bounty.avalancheEscrowAddress}
                      </code>
                    </div>
                  {/if}
                </div>
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

              <!-- Deadline -->
              <div class="mt-4 p-3 bg-base-100 rounded-lg">
                <div class="flex justify-between text-sm">
                  <span class="opacity-70">Deadline</span>
                  <span class="font-semibold">{formatDate(bounty.deadline)}</span>
                </div>
              </div>
            </div>
          </div>

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
