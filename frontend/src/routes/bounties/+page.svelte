<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		Target,
		Clock,
		TrendingUp,
		DollarSign,
		Users,
		CheckCircle,
		AlertCircle,
		Wallet,
		Calendar,
		Building2,
		ArrowRight,
		ArrowLeft,
		Search,
		X
	} from 'lucide-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { authStore } from '$lib/stores/auth';

	let bounties = $state<any[]>([]);
	let filteredBounties = $state<any[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let selectedStatus = $state('all');
	let selectedCategory = $state('all');

	const statusFilters = [
		{ value: 'all', label: 'All Bounties' },
		{ value: 'active', label: 'Active' },
		{ value: 'funded', label: 'Funded' },
		{ value: 'expired', label: 'Expired' }
	];

	const categoryFilters = [
		{ value: 'all', label: 'All Categories' },
		{ value: 'funding', label: '💰 Funding' },
		{ value: 'talent', label: '👥 Talent' },
		{ value: 'mentorship', label: '🎓 Mentorship' },
		{ value: 'partnerships', label: '🤝 Partnerships' },
		{ value: 'resources', label: '🛠️ Resources' },
		{ value: 'technology', label: '⚙️ Technology' },
		{ value: 'marketing', label: '📢 Marketing' }
	];

	const isInvestor = $derived($authStore.user?.role === 'investor');

	onMount(async () => {
		await fetchBounties();
	});

	async function fetchBounties() {
		isLoading = true;
		error = null;

		try {
			const response = await fetch(`${PUBLIC_API_URL}/bounties`);
			const data = await response.json();

			if (data.success) {
				bounties = data.data || [];
				applyFilters();
			} else {
				error = data.message || 'Failed to fetch bounties';
			}
		} catch (err: any) {
			error = err.message || 'Failed to fetch bounties';
		} finally {
			isLoading = false;
		}
	}

	function applyFilters() {
		let result = [...bounties];

		// Search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(bounty) =>
					bounty.title?.toLowerCase().includes(query) ||
					bounty.description?.toLowerCase().includes(query) ||
					bounty.company?.name?.toLowerCase().includes(query)
			);
		}

		// Status filter
		if (selectedStatus !== 'all') {
			result = result.filter((bounty) => bounty.status === selectedStatus);
		}

		// Category filter
		if (selectedCategory !== 'all') {
			result = result.filter((bounty) => bounty.category === selectedCategory);
		}

		filteredBounties = result;
	}

	function clearSearch() {
		searchQuery = '';
		applyFilters();
	}

	function viewBounty(bountyId: string) {
		goto(`/bounties/${bountyId}`);
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

	function getProgressColor(percentage: number) {
		if (percentage >= 100) return 'progress-success';
		if (percentage >= 75) return 'progress-info';
		if (percentage >= 50) return 'progress-warning';
		return 'progress-error';
	}

	function formatCrypto(value: string | number, symbol = 'ETH') {
		const num = typeof value === 'string' ? parseFloat(value) : value;
		if (isNaN(num)) return `0 ${symbol}`;
		return `${num.toFixed(4)} ${symbol}`;
	}

	function formatCurrency(value: string | number) {
		const num = typeof value === 'string' ? parseFloat(value) : value;
		return new Intl.NumberFormat('en-IE', {
			style: 'currency',
			currency: 'EUR'
		}).format(num);
	}

	function formatTimeRemaining(deadline: string) {
		const now = new Date();
		const end = new Date(deadline);
		const diff = end.getTime() - now.getTime();

		if (diff <= 0) return 'Expired';

		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

		if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;
		return `${hours} hour${hours > 1 ? 's' : ''} left`;
	}

	$effect(() => {
		if (searchQuery !== undefined || selectedStatus || selectedCategory) {
			applyFilters();
		}
	});
</script>

<svelte:head>
	<title>Bounties - Liffey Founders Club</title>
</svelte:head>

<div class="min-h-screen py-12">
	<div class="container mx-auto max-w-7xl px-4">
		<!-- Header -->
		<div class="mb-8">
			<button class="btn mb-6 btn-ghost" onclick={() => goto('/dashboard')}>
				<ArrowLeft size={16} /> Back
			</button>
			<div class="mb-4 flex items-center gap-3">
				<Target class="h-10 w-10 text-primary" />
				<h1 class="text-4xl font-bold md:text-5xl">Bounties</h1>
			</div>
			<p class="max-w-3xl text-lg opacity-80">
				Support companies by funding their wishlist items. Contribute to active bounties and help
				founders achieve their goals through blockchain-secured crowdfunding.
			</p>
		</div>

		<!-- Filters Section -->
		<div class="glass-subtle mb-8 rounded-2xl p-6">
			<!-- Search Bar -->
			<div class="relative mb-6">
				<div class="relative">
					<Search class="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 opacity-50" />
					<input
						type="text"
						placeholder="Search bounties by title, description, or company..."
						class="input-bordered input w-full pr-12 pl-12"
						bind:value={searchQuery}
					/>
					{#if searchQuery}
						<button
							onclick={clearSearch}
							class="btn absolute top-1/2 right-4 btn-circle -translate-y-1/2 btn-ghost btn-sm"
							aria-label="Clear search"
						>
							<X class="h-4 w-4" />
						</button>
					{/if}
				</div>
			</div>

			<!-- Filter Controls -->
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<!-- Status Filter -->
				<div class="form-control">
					<label class="label" for="status-filter">
						<span class="label-text font-medium">Status</span>
					</label>
					<select id="status-filter" class="select-bordered select" bind:value={selectedStatus}>
						{#each statusFilters as filter}
							<option value={filter.value} selected={filter.value === 'active'}>
								{filter.label}
							</option>
						{/each}
					</select>
				</div>

				<!-- Category Filter -->
				<div class="form-control">
					<label class="label" for="category-filter">
						<span class="label-text font-medium">Category</span>
					</label>
					<select id="category-filter" class="select-bordered select" bind:value={selectedCategory}>
						{#each categoryFilters as filter}
							<option value={filter.value}>{filter.label}</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Results Count -->
			{#if !isLoading && !error}
				<div class="mt-4 text-sm opacity-70">
					Showing {filteredBounties.length} of {bounties.length} bounties
				</div>
			{/if}
		</div>

		<!-- Loading State -->
		{#if isLoading}
			<div class="flex justify-center py-12">
				<span class="loading loading-lg loading-spinner"></span>
			</div>
		{/if}

		<!-- Error State -->
		{#if error}
			<div class="alert alert-error">
				<AlertCircle class="h-5 w-5" />
				<span>{error}</span>
			</div>
		{/if}

		<!-- Bounties Grid -->
		{#if !isLoading && !error && filteredBounties.length > 0}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredBounties as bounty}
					<div
						class="card border border-base-300 bg-base-100 shadow-xl transition-all duration-300 hover:shadow-2xl"
					>
						<div class="card-body">
							<!-- Company Info -->
							<div class="mb-3 flex items-center gap-3">
								<div class="placeholder avatar">
									{#if bounty.company?.owner?.profilePhotoUrl}
										<div class="h-10 w-10 overflow-hidden rounded-full">
											<img
												src={bounty.company.owner.profilePhotoUrl}
												alt={bounty.company?.name}
												class="h-full w-full object-cover"
											/>
										</div>
									{:else if bounty.company?.avatar}
										<div class="h-10 w-10 overflow-hidden rounded-full">
											<img
												src={bounty.company.avatar}
												alt={bounty.company?.name}
												class="h-full w-full object-cover"
											/>
										</div>
									{:else}
										<div class="w-10 rounded-full bg-primary text-primary-content">
											<span class="text-xs">{bounty.company?.name?.charAt(0) || 'C'}</span>
										</div>
									{/if}
								</div>
								<div>
									<h3 class="text-sm font-semibold">{bounty.company?.name || 'Unknown Company'}</h3>
									<div class="flex items-center gap-2 text-xs opacity-70">
										<Building2 class="h-3 w-3" />
										{bounty.company?.industry || 'N/A'}
									</div>
								</div>
							</div>

							<!-- Bounty Title -->
							<h2 class="card-title line-clamp-2 text-lg">
								{#if bounty.deployments && bounty.deployments.length > 0 && bounty.deployments[0].campaignName}
									{bounty.deployments[0].campaignName}
								{:else}
									{bounty.title}
								{/if}
							</h2>

							<!-- Description -->
							<p class="mb-4 line-clamp-3 text-sm opacity-80">
								{bounty.description || 'No description provided'}
							</p>

							<!-- Target Amount & Progress -->
							<div class="mb-4 space-y-2">
								<div class="flex justify-between text-sm">
									<span class="font-medium">Target</span>
									<span class="font-bold text-primary">
										{#if bounty.targetAmountEth}
											{formatCrypto(bounty.targetAmountEth)}
											<span class="text-xs opacity-60"
												>(≈ {formatCurrency(bounty.targetAmount || 0)})</span
											>
										{:else}
											{formatCurrency(bounty.targetAmount || 0)}
										{/if}
									</span>
								</div>
								<div class="flex justify-between text-sm">
									<span>Raised</span>
									<span class="font-semibold text-success">
										{#if bounty.targetAmountEth}
											{formatCrypto(bounty.raisedAmount || 0)}
										{:else}
											{formatCurrency(bounty.raisedAmount || 0)}
										{/if}
									</span>
								</div>
								<progress
									class="progress {getProgressColor(bounty.progressPercentage || 0)} w-full"
									value={bounty.progressPercentage || 0}
									max="100"
								></progress>
								<div class="text-center text-xs font-semibold opacity-80">
									{bounty.progressPercentage || 0}% funded
								</div>
							</div>

							<!-- Contributors & Time -->
							<div class="mb-4 flex items-center justify-between text-sm">
								<div class="flex items-center gap-1">
									<Users class="h-4 w-4 opacity-70" />
									<span>{bounty.contributorCount || 0} backers</span>
								</div>
								<div class="flex items-center gap-1 text-warning">
									<Clock class="h-4 w-4" />
									<span>{formatTimeRemaining(bounty.deadline)}</span>
								</div>
							</div>
							<!-- Non-EVM address indicators -->
							{#if bounty.solanaWalletAddress || bounty.stellarWalletAddress || bounty.bitcoinWalletAddress}
								<div class="flex items-center gap-2 text-xs opacity-60 mb-2">
									{#if bounty.solanaWalletAddress}
										<span class="badge badge-success badge-xs">SOL</span>
									{/if}
									{#if bounty.stellarWalletAddress}
										<span class="badge badge-warning badge-xs">XLM</span>
									{/if}
									{#if bounty.bitcoinWalletAddress}
										<span class="badge badge-info badge-xs">BTC</span>
									{/if}
								</div>
							{/if}

							<!-- Status Badge -->
							<div class="flex items-center justify-between">
								<span class="badge {getStatusBadge(bounty.status).class}">
									{getStatusBadge(bounty.status).label}
								</span>
								<button onclick={() => viewBounty(bounty.id)} class="btn gap-2 btn-sm btn-primary">
									View Details
									<ArrowRight class="h-4 w-4" />
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Empty State -->
		{#if !isLoading && !error && filteredBounties.length === 0}
			<div class="py-12 text-center">
				<Target class="mx-auto mb-4 h-16 w-16 opacity-30" />
				<h3 class="mb-2 text-2xl font-bold">No Bounties Found</h3>
				<p class="mb-6 opacity-70">
					{bounties.length === 0
						? 'There are no active bounties at the moment. Check back soon!'
						: 'No bounties match your search criteria. Try adjusting your filters.'}
				</p>
				{#if searchQuery || selectedStatus !== 'all' || selectedCategory !== 'all'}
					<button
						onclick={() => {
							searchQuery = '';
							selectedStatus = 'all';
							selectedCategory = 'all';
						}}
						class="btn btn-primary"
					>
						Clear Filters
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
