<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import { walletStore, isConnected, formattedAddress } from '$lib/stores/walletStore';
	import { toastStore } from '$lib/stores/toast';
	import {
		User,
		Settings,
		Wallet,
		WalletCards,
		LogOut,
		UserCircle,
		Briefcase,
		Home,
		Building2,
		Target,
		TrendingUp,
		Copy,
		Check,
		ExternalLink,
		ShieldCheck,
		Activity,
		BarChart3,
		Clock,
		Coins,
		RefreshCw,
		ArrowUpRight,
		Users,
		Zap
	} from 'lucide-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';

	let user = $state<any>(null);
	let avatarUrl = $state<string | null>(null);

	// ---- Wallet addresses ----
	let walletAddresses = $state<{
		ethAddress: string;
		avaxAddress: string;
		solanaAddress: string | null;
		stellarAddress: string | null;
		bitcoinAddress: string | null;
	} | null>(null);
	let isFetchingWallet = $state(false);
	let copiedAddress = $state<string | null>(null);

	// ---- Portfolio / bounty data ----
	let myCompanies = $state<any[]>([]);
	let allBounties = $state<any[]>([]);
	let isFetchingPortfolio = $state(false);

	// ---- Activity feed ----
	type ActivityItem = {
		id: string;
		bountyTitle: string;
		companyName: string;
		contributorAddress: string;
		contributorName: string | null;
		chain: string;
		amountEth: string | null;
		amountUsd: string | null;
		contributedAt: string;
		isRefunded: boolean;
	};
	let activityFeed = $state<ActivityItem[]>([]);
	let isFetchingActivity = $state(false);

	// ---- Live wallet balances ----
	type BalanceEntry = { balance: string; symbol: string; loading: boolean; error: boolean };
	let walletBalances = $state<Record<string, BalanceEntry>>({
		ethereum: { balance: '', symbol: 'ETH', loading: false, error: false },
		avalanche: { balance: '', symbol: 'AVAX', loading: false, error: false },
		solana: { balance: '', symbol: 'SOL', loading: false, error: false },
		stellar: { balance: '', symbol: 'XLM', loading: false, error: false },
		bitcoin: { balance: '', symbol: 'BTC', loading: false, error: false }
	});

	// ---- Portfolio derived stats ----
	let totalRaisedEur = $derived(
		allBounties.reduce((s, b) => s + (b.totalRaisedEur || 0), 0)
	);
	let activeCampaigns = $derived(allBounties.filter((b) => b.status === 'active').length);
	let totalContributors = $derived(
		allBounties.reduce((s, b) => s + (b.contributorCount || 0), 0)
	);

	const walletChains = $derived([
		{
			key: 'ethAddress',
			label: 'Ethereum',
			badge: 'badge-primary',
			symbol: 'ETH',
			address: walletAddresses?.ethAddress ?? null,
			explorerBase: 'https://sepolia.etherscan.io/address/',
			explorerLabel: 'Etherscan'
		},
		{
			key: 'avaxAddress',
			label: 'Avalanche',
			badge: 'badge-error',
			symbol: 'AVAX',
			address: walletAddresses?.avaxAddress ?? null,
			explorerBase: 'https://testnet.snowtrace.io/address/',
			explorerLabel: 'Snowtrace'
		},
		{
			key: 'solanaAddress',
			label: 'Solana',
			badge: 'badge-secondary',
			symbol: 'SOL',
			address: walletAddresses?.solanaAddress ?? null,
			explorerBase: 'https://explorer.solana.com/address/',
			explorerLabel: 'Explorer'
		},
		{
			key: 'stellarAddress',
			label: 'Stellar',
			badge: 'badge-accent',
			symbol: 'XLM',
			address: walletAddresses?.stellarAddress ?? null,
			explorerBase: 'https://stellar.expert/explorer/public/account/',
			explorerLabel: 'Explorer'
		},
		{
			key: 'bitcoinAddress',
			label: 'Bitcoin',
			badge: 'badge-warning',
			symbol: 'BTC',
			address: walletAddresses?.bitcoinAddress ?? null,
			explorerBase: 'https://mempool.space/address/',
			explorerLabel: 'Mempool'
		}
	]);

	function handleLogout() {
		authStore.logout();
		// disconnect wallet when user logs out
		try {
			walletStore.disconnect();
		} catch (e) {}
		goto('/auth');
	}

	async function connectWallet() {
		try {
			await walletStore.connect();
			toastStore.add({ message: 'Wallet connected', type: 'success', ttl: 3000 });
		} catch (e: any) {
			toastStore.add({
				message: e?.message || 'Failed to connect wallet',
				type: 'error',
				ttl: 5000
			});
		}
	}

	async function fetchUserProfile() {
		try {
			const token = $authStore.accessToken;
			if (!token || !$authStore.user?.id) return;

			const response = await fetch(`${PUBLIC_API_URL}/users/${$authStore.user.id}`, {
				headers: {
					Authorization: `Bearer ${token}`
				}
			});

			const result = await response.json();
			if (result.success && result.data) {
				user = result.data;
				// Set avatar URL from GCP Storage with fresh signed URL
				if (result.data.profilePhotoUrl) {
					avatarUrl = result.data.profilePhotoUrl;
				}
			}
		} catch (error) {
			console.error('Failed to fetch user profile:', error);
		}
	}

	async function fetchWalletAddresses() {
		const token = $authStore.accessToken;
		if (!token) return;
		isFetchingWallet = true;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/wallet/addresses`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			const data = await res.json();
			if (data.success && data.data) walletAddresses = data.data;
		} catch (e) {
			console.error('Failed to fetch wallet addresses:', e);
		} finally {
			isFetchingWallet = false;
		}
	}

	async function copyAddress(addr: string) {
		try {
			await navigator.clipboard.writeText(addr);
			copiedAddress = addr;
			setTimeout(() => (copiedAddress = null), 2000);
		} catch {}
	}

	async function fetchPortfolio() {
		const token = $authStore.accessToken;
		if (!token) return;
		isFetchingPortfolio = true;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/companies/my-companies`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			const data = await res.json();
			if (!data.success) return;
			myCompanies = data.data || [];

			const bountyResults = await Promise.all(
				myCompanies.map((c) =>
					fetch(`${PUBLIC_API_URL}/bounties/company/${c.id}`, {
						headers: { Authorization: `Bearer ${token}` }
					})
						.then((r) => (r.ok ? r.json() : { data: [] }))
						.catch(() => ({ data: [] }))
				)
			);
			const seen = new Set<string>();
			allBounties = bountyResults
				.flatMap((r) => r.data || [])
				.filter((b: any) => {
					if (seen.has(b.id)) return false;
					seen.add(b.id);
					return true;
				});
		} catch (e) {
			console.error('Failed to fetch portfolio:', e);
		} finally {
			isFetchingPortfolio = false;
		}
	}

	async function fetchActivityFeed() {
		const token = $authStore.accessToken;
		if (!token || allBounties.length === 0) return;
		isFetchingActivity = true;
		try {
			const bountiesForActivity = allBounties.slice(0, 6);
			const histories = await Promise.all(
				bountiesForActivity.map((b) =>
					fetch(`${PUBLIC_API_URL}/bounties/${b.id}/history`, {
						headers: { Authorization: `Bearer ${token}` }
					})
						.then((r) => (r.ok ? r.json() : null))
						.catch(() => null)
				)
			);
			const items: ActivityItem[] = [];
			for (let i = 0; i < histories.length; i++) {
				const h = histories[i];
				if (!h?.data?.contributions) continue;
				const bounty = bountiesForActivity[i];
				for (const c of h.data.contributions) {
					items.push({
						id: c.id,
						bountyTitle: bounty.title,
						companyName: bounty.company?.name || '',
						contributorAddress: c.contributorAddress,
						contributorName: c.user?.name || null,
						chain: c.chain || 'ethereum',
						amountEth: c.amountEth ?? null,
						amountUsd: c.amountUsd ?? null,
						contributedAt: c.contributedAt,
						isRefunded: !!c.isRefunded
					});
				}
			}
			items.sort(
				(a, b) =>
					new Date(b.contributedAt).getTime() - new Date(a.contributedAt).getTime()
			);
			activityFeed = items.slice(0, 15);
		} finally {
			isFetchingActivity = false;
		}
	}

	async function fetchWalletBalances() {
		if (!walletAddresses) return;
		const chainMap: Array<{
			key: string;
			address: string | null;
			balanceField: string;
		}> = [
			{
				key: 'ethereum',
				address: walletAddresses.ethAddress,
				balanceField: 'balanceEth'
			},
			{
				key: 'avalanche',
				address: walletAddresses.avaxAddress,
				balanceField: 'balanceAvax'
			},
			{
				key: 'solana',
				address: walletAddresses.solanaAddress,
				balanceField: 'balanceSol'
			},
			{
				key: 'stellar',
				address: walletAddresses.stellarAddress,
				balanceField: 'balanceXlm'
			},
				{
				key: 'bitcoin',
				address: walletAddresses.bitcoinAddress,
				balanceField: 'balanceBtc'
			}
		];
		await Promise.all(
			chainMap.map(async ({ key, address, balanceField }) => {
				if (!address) return;
				walletBalances[key].loading = true;
				try {
					const res = await fetch(
						`${PUBLIC_API_URL}/wallet-balance?address=${encodeURIComponent(address)}&chain=${key}`
					);
					if (!res.ok) throw new Error('Failed');
					const data = await res.json();
					walletBalances[key].balance = data[balanceField] ?? '0.000000';
					walletBalances[key].error = false;
				} catch {
					walletBalances[key].error = true;
				} finally {
					walletBalances[key].loading = false;
				}
			})
		);
	}

	onMount(async () => {
		const ok = await authStore.verify();
		if (!ok) goto('/auth');

		await Promise.all([fetchUserProfile(), fetchWalletAddresses()]);

		// Wallet balances need addresses first
		fetchWalletBalances();

		// Portfolio data: companies → bounties, then activity feed
		await fetchPortfolio();
		fetchActivityFeed();

		authStore.subscribe((s) => {
			if (s.user && !user) {
				fetchUserProfile();
			}
		})();
	});

	function getRoleBadgeClass(role: string) {
		switch (role) {
			case 'investor':
				return 'badge-accent';
			case 'staff':
				return 'badge-secondary';
			default:
				return 'badge-primary';
		}
	}

	function formatEur(amount: number): string {
		return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
	}

	function timeAgo(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		const days = Math.floor(hrs / 24);
		return `${days}d ago`;
	}

	function daysLeft(deadline: string): number {
		return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000));
	}

	function chainLabel(chain: string): string {
		const map: Record<string, string> = {
			ethereum: 'ETH',
			avalanche: 'AVAX',
			solana: 'SOL',
			stellar: 'XLM',
			bitcoin: 'BTC'
		};
		return map[chain] ?? chain.toUpperCase();
	}

	function statusBadgeClass(status: string): string {
		switch (status) {
			case 'active':
				return 'badge-success';
			case 'funded':
				return 'badge-info';
			case 'expired':
				return 'badge-ghost';
			case 'failed':
				return 'badge-error';
			default:
				return 'badge-ghost';
		}
	}

	function shortenAddr(addr: string): string {
		if (!addr || addr.length < 12) return addr;
		return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
	}
</script>

<!-- Min height ensures footer stays at bottom -->
<div class="container mx-auto min-h-[calc(100vh-20rem)] max-w-7xl px-4 py-8">
	<!-- Header Section -->
	<div class="mb-8">
		<div class="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
			<div>
				<h1 class="mb-2 text-4xl font-bold">Dashboard</h1>
				{#if user}
					<p class="text-base-content/70">
						Welcome back, <span class="font-semibold">{user.name || user.email}</span>!
					</p>
				{/if}
			</div>
			<button onclick={handleLogout} class="btn gap-2 btn-outline btn-error">
				<LogOut size={18} />
				Logout
			</button>
		</div>

		<!-- User Info Card -->
		{#if user}
			<div class="card bg-gradient-to-br from-primary/10 to-secondary/10 shadow-md">
				<div class="card-body">
					<div class="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
						<div class="avatar">
							<div
								class="h-16 w-16 rounded-full ring ring-primary ring-offset-2 ring-offset-base-100"
							>
								{#if avatarUrl}
									<img src={avatarUrl} alt={user.name || 'User'} />
								{:else}
									<div
										class="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-content"
									>
										<span class="text-2xl"
											>{user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}</span
										>
									</div>
								{/if}
							</div>
						</div>
						<div class="flex-1">
							<h2 class="text-2xl font-bold">{user.name || 'User'}</h2>
							<p class="text-base-content/70">{user.email}</p>
							<div class="mt-2">
								<span class="badge {getRoleBadgeClass(user.role)} gap-2 badge-lg">
									{#if user.role === 'investor'}
										<Briefcase size={14} />
									{:else}
										<UserCircle size={14} />
									{/if}
									{user.role === 'investor'
										? 'Investor'
										: user.role === 'staff'
											? 'Staff'
											: 'Founder'}
								</span>
							</div>
						</div>
						{#if user.role === 'user'}
							<button class="btn btn-sm btn-primary" onclick={() => goto('/profile')}>
								Upgrade to Investor
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- ================================================================
	     PORTFOLIO SUMMARY
	     ================================================================ -->
	{#if isFetchingPortfolio}
		<div class="mb-8 flex items-center gap-3 opacity-60">
			<span class="loading loading-spinner loading-sm"></span>
			<span class="text-sm">Loading your portfolio…</span>
		</div>
	{:else if allBounties.length > 0}
		<div class="mb-8">
			<div class="mb-4 flex items-center gap-2">
				<BarChart3 size={20} class="text-primary" />
				<h2 class="text-xl font-bold">Portfolio Overview</h2>
			</div>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<!-- Total Raised -->
				<div class="card bg-gradient-to-br from-success/15 to-success/5 shadow">
					<div class="card-body py-4">
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium opacity-70">Total Raised</span>
							<Coins size={18} class="text-success opacity-60" />
						</div>
						<p class="mt-1 text-3xl font-bold text-success">{formatEur(totalRaisedEur)}</p>
						<p class="text-xs opacity-50">across {allBounties.length} bounties</p>
					</div>
				</div>
				<!-- Active Campaigns -->
				<div class="card bg-gradient-to-br from-primary/15 to-primary/5 shadow">
					<div class="card-body py-4">
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium opacity-70">Active Campaigns</span>
							<Zap size={18} class="text-primary opacity-60" />
						</div>
						<p class="mt-1 text-3xl font-bold text-primary">{activeCampaigns}</p>
						<p class="text-xs opacity-50">of {allBounties.length} total</p>
					</div>
				</div>
				<!-- Total Contributors -->
				<div class="card bg-gradient-to-br from-accent/15 to-accent/5 shadow">
					<div class="card-body py-4">
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium opacity-70">Total Contributors</span>
							<Users size={18} class="text-accent opacity-60" />
						</div>
						<p class="mt-1 text-3xl font-bold text-accent">{totalContributors}</p>
						<p class="text-xs opacity-50">unique backers</p>
					</div>
				</div>
			</div>
		</div>
	{:else if myCompanies.length > 0}
		<div class="alert alert-info mb-8 shadow">
			<Target size={18} />
			<span>You have companies but no active bounties yet. Create a bounty from a company's wishlist item.</span>
			<button class="btn btn-sm" onclick={() => goto('/companies')}>Go to Companies</button>
		</div>
	{/if}

	<!-- ================================================================
	     LIVE WALLET BALANCE TILES
	     ================================================================ -->
	{#if walletAddresses}
		<div class="mb-8">
			<div class="mb-4 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Wallet size={20} class="text-secondary" />
					<h2 class="text-xl font-bold">Live Balances</h2>
				</div>
				<button
					class="btn btn-ghost btn-xs gap-1 opacity-60 hover:opacity-100"
					onclick={fetchWalletBalances}
				>
					<RefreshCw size={12} />
					Refresh
				</button>
			</div>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{#each [
					{ key: 'ethereum', label: 'Ethereum', symbol: 'ETH', address: walletAddresses.ethAddress, color: 'text-blue-400', bg: 'from-blue-500/10 to-blue-500/5' },
					{ key: 'avalanche', label: 'Avalanche', symbol: 'AVAX', address: walletAddresses.avaxAddress, color: 'text-red-400', bg: 'from-red-500/10 to-red-500/5' },
					{ key: 'solana', label: 'Solana', symbol: 'SOL', address: walletAddresses.solanaAddress, color: 'text-purple-400', bg: 'from-purple-500/10 to-purple-500/5' },
					{ key: 'stellar', label: 'Stellar', symbol: 'XLM', address: walletAddresses.stellarAddress, color: 'text-cyan-400', bg: 'from-cyan-500/10 to-cyan-500/5' },
					{ key: 'bitcoin', label: 'Bitcoin', symbol: 'BTC', address: walletAddresses.bitcoinAddress, color: 'text-yellow-400', bg: 'from-yellow-500/10 to-yellow-500/5' }
				] as chain}
					{#if chain.address}
						<div class="card bg-gradient-to-br shadow {chain.bg}">
							<div class="card-body p-4">
								<div class="flex items-center justify-between">
									<span class="text-xs font-semibold opacity-60">{chain.label}</span>
									<span class="badge badge-sm {statusBadgeClass('active')} badge-outline">{chain.symbol}</span>
								</div>
								{#if walletBalances[chain.key].loading}
									<div class="mt-2 flex items-center gap-1">
										<span class="loading loading-dots loading-xs"></span>
									</div>
								{:else if walletBalances[chain.key].error}
									<p class="mt-2 text-sm opacity-40">—</p>
								{:else if walletBalances[chain.key].balance}
									<p class="mt-1 text-xl font-bold {chain.color}">
										{walletBalances[chain.key].balance}
										<span class="text-xs font-normal opacity-60">{chain.symbol}</span>
									</p>
								{:else}
									<p class="mt-2 text-sm opacity-40">0.000000 {chain.symbol}</p>
								{/if}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}

	<!-- ================================================================
	     BOUNTY PROGRESS BARS
	     ================================================================ -->
	{#if allBounties.length > 0}
		<div class="mb-8">
			<div class="mb-4 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Target size={20} class="text-accent" />
					<h2 class="text-xl font-bold">My Campaigns</h2>
				</div>
				<button
					class="btn btn-ghost btn-xs gap-1 opacity-60 hover:opacity-100"
					onclick={() => goto('/bounties')}
				>
					View all <ArrowUpRight size={12} />
				</button>
			</div>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				{#each allBounties as bounty}
					<div class="card bg-base-100 shadow transition-shadow hover:shadow-md">
						<div class="card-body p-4">
							<div class="mb-1 flex items-start justify-between gap-2">
								<div>
									<p class="font-semibold leading-tight">{bounty.title}</p>
									<p class="text-xs opacity-50">{bounty.company?.name}</p>
								</div>
								<span class="badge {statusBadgeClass(bounty.status)} badge-sm shrink-0">
									{bounty.status}
								</span>
							</div>

							<!-- Progress bar -->
							<div class="my-2">
								<div class="mb-1 flex justify-between text-xs opacity-60">
									<span>{formatEur(bounty.totalRaisedEur || 0)} raised</span>
									<span>of {formatEur(bounty.targetAmountEur || 0)}</span>
								</div>
								<div class="h-2 w-full overflow-hidden rounded-full bg-base-300">
									<div
										class="h-2 rounded-full transition-all duration-500 {bounty.status === 'funded'
											? 'bg-success'
											: bounty.status === 'expired'
												? 'bg-base-content/30'
												: 'bg-primary'}"
										style="width: {Math.min(bounty.progressPercentage || 0, 100)}%"
									></div>
								</div>
							</div>

							<div class="flex items-center justify-between text-xs opacity-60">
								<span class="flex items-center gap-1">
									<Users size={11} />
									{bounty.contributorCount || 0} contributors
								</span>
								{#if bounty.status === 'active'}
									<span class="flex items-center gap-1">
										<Clock size={11} />
										{daysLeft(bounty.deadline)}d left
									</span>
								{/if}
								<button
									class="btn btn-ghost btn-xs"
									onclick={() => goto(`/companies/${bounty.company?.id}`)}
								>
									View <ArrowUpRight size={10} />
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- ================================================================
	     ACTIVITY FEED
	     ================================================================ -->
	{#if isFetchingActivity}
		<div class="mb-8 flex items-center gap-3 opacity-60">
			<span class="loading loading-spinner loading-sm"></span>
			<span class="text-sm">Loading activity…</span>
		</div>
	{:else if activityFeed.length > 0}
		<div class="mb-8">
			<div class="mb-4 flex items-center gap-2">
				<Activity size={20} class="text-info" />
				<h2 class="text-xl font-bold">Recent Activity</h2>
			</div>
			<div class="card bg-base-100 shadow">
				<div class="divide-y divide-base-200">
					{#each activityFeed as item}
						<div class="flex items-start gap-3 px-4 py-3 hover:bg-base-50 transition-colors">
							<!-- Chain badge -->
							<div class="mt-0.5 shrink-0">
								<span class="badge badge-xs badge-outline font-mono">{chainLabel(item.chain)}</span>
							</div>
							<!-- Main content -->
							<div class="min-w-0 flex-1">
								<p class="text-sm leading-snug">
									<span class="font-medium">
										{item.contributorName ?? shortenAddr(item.contributorAddress)}
									</span>
									{#if item.isRefunded}
										<span class="text-error"> claimed refund from</span>
									{:else}
										<span class="opacity-70"> contributed to</span>
									{/if}
									<span class="font-medium"> {item.bountyTitle}</span>
									<span class="opacity-50"> · {item.companyName}</span>
								</p>
								{#if item.amountEth && parseFloat(item.amountEth) > 0}
									<p class="mt-0.5 text-xs opacity-60">
										{parseFloat(item.amountEth).toFixed(6)} {chainLabel(item.chain)}
										{#if item.amountUsd && parseFloat(item.amountUsd) > 0}
											<span class="opacity-50">≈ ${parseFloat(item.amountUsd).toFixed(2)}</span>
										{/if}
									</p>
								{/if}
							</div>
							<!-- Timestamp -->
							<span class="shrink-0 text-xs opacity-40">{timeAgo(item.contributedAt)}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Quick Actions Grid -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		<!-- Home Card -->
		<div
			class="card bg-base-100 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
		>
			<div class="card-body">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 p-3">
						<Home size={24} class="text-primary" />
					</div>
					<h2 class="card-title text-xl">Home</h2>
				</div>
				<p class="mb-4 flex-grow text-base-content/70">
					Return to the main landing page to explore the Liffey Founders Club.
				</p>
				<div class="card-actions">
					<button
						class="text-heading rounded-lg group relative inline-flex items-center justify-center overflow-hidden bg-gradient-to-br from-purple-600 to-blue-500 p-0.5 text-sm font-medium group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white focus:ring-4 focus:ring-blue-300 focus:outline-none dark:text-white dark:focus:ring-blue-800"
						onclick={() => goto('/')}
					>
						<span
							class=" bg-base-100 dark:bg-base-300 rounded-lg relative px-4 py-2.5 leading-5 transition-all duration-75 ease-in group-hover:bg-transparent group-hover:dark:bg-transparent"
						>
							Go to Home
						</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Companies Card -->
		<div
			class="card bg-base-100 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
		>
			<div class="card-body">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-lg bg-gradient-to-br from-secondary/20 to-secondary/10 p-3">
						<Building2 size={24} class="text-secondary" />
					</div>
					<h2 class="card-title text-xl">Companies</h2>
				</div>
				<p class="mb-4 flex-grow text-base-content/70">
					Browse all companies in the network, view profiles, and discover opportunities.
				</p>
				<div class="card-actions">
					<button
						class="text-heading rounded-lg group relative inline-flex items-center justify-center overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-500 p-0.5 text-sm font-medium group-hover:from-cyan-500 group-hover:to-blue-500 hover:text-white focus:ring-4 focus:ring-cyan-200 focus:outline-none dark:text-white dark:focus:ring-cyan-800"
						onclick={() => goto('/companies')}
					>
						<span
							class=" bg-base-100 dark:bg-base-300 rounded-lg relative px-4 py-2.5 leading-5 transition-all duration-75 ease-in group-hover:bg-transparent group-hover:dark:bg-transparent"
						>
							View Companies
						</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Bounties Card -->
		{#if user?.role === 'user' || user?.role === 'investor' || user?.role === 'staff'}
			<div
				class="card bg-base-100 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
			>
				<div class="card-body">
					<div class="mb-4 flex items-center gap-3">
						<div class="rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 p-3">
							<Target size={24} class="text-accent" />
						</div>
						<h2 class="card-title text-xl">Bounties</h2>
					</div>
					<p class="mb-4 flex-grow text-base-content/70">
						Explore crowdfunding campaigns and support companies with blockchain escrow.
					</p>
					<div class="card-actions">
						<button
							class="text-heading rounded-lg group relative inline-flex items-center justify-center overflow-hidden bg-gradient-to-br from-green-400 to-blue-600 p-0.5 text-sm font-medium group-hover:from-green-400 group-hover:to-blue-600 hover:text-white focus:ring-4 focus:ring-green-200 focus:outline-none dark:text-white dark:focus:ring-green-800"
							onclick={() => goto('/bounties')}
						>
							<span
								class=" bg-base-100 dark:bg-base-300 rounded-lg relative px-4 py-2.5 leading-5 transition-all duration-75 ease-in group-hover:bg-transparent group-hover:dark:bg-transparent"
							>
								View Bounties
							</span>
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Profile Card -->
		<div
			class="card bg-base-100 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
		>
			<div class="card-body">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-lg bg-gradient-to-br from-info/20 to-info/10 p-3">
						<User size={24} class="text-info" />
					</div>
					<h2 class="card-title text-xl">Profile</h2>
				</div>
				<p class="mb-4 flex-grow text-base-content/70">
					View and edit your profile information, upgrade to investor account, and manage your
					details.
				</p>
				<div class="card-actions">
					<button
						class="text-heading rounded-lg group relative inline-flex items-center justify-center overflow-hidden bg-gradient-to-br from-pink-500 to-orange-400 p-0.5 text-sm font-medium group-hover:from-pink-500 group-hover:to-orange-400 hover:text-white focus:ring-4 focus:ring-pink-200 focus:outline-none dark:text-white dark:focus:ring-pink-800"
						onclick={() => goto('/profile')}
					>
						<span
							class=" bg-base-100 dark:bg-base-300 rounded-lg relative px-4 py-2.5 leading-5 transition-all duration-75 ease-in group-hover:bg-transparent group-hover:dark:bg-transparent"
						>
							View Profile
						</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Settings Card -->
		<div
			class="card bg-base-100 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
		>
			<div class="card-body">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-lg bg-gradient-to-br from-warning/20 to-warning/10 p-3">
						<Settings size={24} class="text-warning" />
					</div>
					<h2 class="card-title text-xl">Settings</h2>
				</div>
				<p class="mb-4 flex-grow text-base-content/70">
					Manage your account settings, preferences, and security options.
				</p>
				<div class="card-actions">
					<button
						class="text-heading rounded-lg group dark:hover:text-heading relative inline-flex items-center justify-center overflow-hidden bg-gradient-to-br from-teal-300 to-lime-300 p-0.5 text-sm font-medium group-hover:from-teal-300 group-hover:to-lime-300 focus:ring-4 focus:ring-lime-200 focus:outline-none dark:text-white dark:focus:ring-lime-800"
						onclick={() => goto('/settings')}
					>
						<span
							class=" bg-base-100 dark:bg-base-300 rounded-lg relative px-4 py-2.5 leading-5 transition-all duration-75 ease-in group-hover:bg-transparent group-hover:dark:bg-transparent"
						>
							View Settings
						</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Send Funds Card -->
		<div
			class="card bg-base-100 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
		>
			<div class="card-body">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-lg bg-gradient-to-br from-success/20 to-success/10 p-3">
						<Wallet size={24} class="text-success" />
					</div>
					<h2 class="card-title text-xl">Send Funds</h2>
				</div>
				<p class="mb-4 flex-grow text-base-content/70">
					Transfer cryptocurrency to any wallet address on supported networks.
				</p>
				<div class="card-actions">
					{#if $authStore.isAuthenticated}
						<button
							class="text-heading rounded-lg group dark:hover:text-heading relative inline-flex items-center justify-center overflow-hidden bg-gradient-to-br from-red-200 via-red-300 to-yellow-200 p-0.5 text-sm font-medium group-hover:from-red-200 group-hover:via-red-300 group-hover:to-yellow-200 focus:ring-4 focus:ring-red-100 focus:outline-none dark:text-white dark:focus:ring-red-400"
							onclick={() => goto('/send')}
						>
							<span
								class=" bg-base-100 dark:bg-base-300 rounded-lg relative px-4 py-2.5 leading-5 transition-all duration-75 ease-in group-hover:bg-transparent group-hover:dark:bg-transparent"
							>
								Send Funds
							</span>
						</button>
					{:else}
						<button class="btn-disabled btn btn-block" disabled> Sign in to manage </button>
					{/if}
				</div>
			</div>
		</div>

				<!-- Buy Crypto Card -->
				<div
					class="card bg-base-100 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
				>
					<div class="card-body">
						<div class="mb-4 flex items-center gap-3">
							<div class="rounded-lg bg-gradient-to-br from-indigo-200 to-indigo-100 p-3">
								<WalletCards size={24} class="text-indigo-600" />
							</div>
							<h2 class="card-title text-xl">Buy Crypto</h2>
						</div>
						<p class="mb-4 flex-grow text-base-content/70">
							Purchase testnet tokens or swap coins using our integrated on-ramp.
						</p>
						<div class="card-actions">
							<button
								class="text-heading rounded-lg group dark:hover:text-heading relative inline-flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-400 to-blue-500 p-0.5 text-sm font-medium group-hover:from-indigo-400 group-hover:to-blue-500 focus:ring-4 focus:ring-indigo-200 focus:outline-none dark:text-white dark:focus:ring-indigo-800"
								onclick={() => goto('/buy-crypto')}
							>
								<span
									class=" bg-base-100 dark:bg-base-300 rounded-lg relative px-4 py-2.5 leading-5 transition-all duration-75 ease-in group-hover:bg-transparent group-hover:dark:bg-transparent"
								>
									Buy Crypto
								</span>
							</button>
						</div>
					</div>
				</div>

				<!-- Leaderboard Card -->
				<div
					class="card bg-base-100 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
				>
					<div class="card-body">
						<div class="mb-4 flex items-center gap-3">
							<div class="rounded-lg bg-gradient-to-br from-yellow-200 to-yellow-100 p-3">
								<TrendingUp size={24} class="text-yellow-600" />
							</div>
							<h2 class="card-title text-xl">Leaderboard</h2>
						</div>
						<p class="mb-4 flex-grow text-base-content/70">
							See top contributors and company rankings.
						</p>
						<div class="card-actions">
							<button
								class="text-heading rounded-lg group dark:hover:text-heading relative inline-flex items-center justify-center overflow-hidden bg-gradient-to-br from-yellow-400 to-orange-400 p-0.5 text-sm font-medium group-hover:from-yellow-400 group-hover:to-orange-400 focus:ring-4 focus:ring-yellow-200 focus:outline-none dark:text-white dark:focus:ring-yellow-800"
								onclick={() => goto('/leaderboard')}
							>
								<span
									class=" bg-base-100 dark:bg-base-300 rounded-lg relative px-4 py-2.5 leading-5 transition-all duration-75 ease-in group-hover:bg-transparent group-hover:dark:bg-transparent"
								>
									View Leaderboard
								</span>
							</button>
						</div>
					</div>
				</div>

			</div>

		<!-- Wallet Addresses Section -->
		<div class="mt-12">
			<h2 class="mb-6 text-2xl font-bold">My Wallet Addresses</h2>
			{#if !walletAddresses && !isFetchingWallet}
				<span class="badge badge-ghost badge-sm">No wallet generated</span>
			{/if}

		{#if isFetchingWallet}
			<div class="card flex items-center gap-3 bg-base-100 p-6 shadow">
				<span class="loading loading-sm loading-spinner"></span>
				<span class="text-sm opacity-70">Loading addresses…</span>
			</div>
		{:else if !walletAddresses}
			<div class="card border border-base-300 bg-base-100 shadow">
				<div class="card-body items-center gap-3 text-center">
					<Wallet size={36} class="opacity-30" />
					<p class="opacity-70">You haven't generated a master wallet yet.</p>
					<button class="btn btn-sm btn-primary" onclick={() => goto('/profile')}>
						Generate Wallet
					</button>
				</div>
			</div>
		{:else}
			<div class="card border border-base-300 bg-base-100 shadow-xl">
				<div class="card-body p-0">
					<div class="divide-y divide-base-200">
						{#each walletChains as chain}
							<div class="hover:bg-base-50 flex items-center gap-4 px-5 py-4 transition-colors">
								<!-- Chain label -->
								<div class="flex w-32 shrink-0 items-center gap-2">
									<span class="badge {chain.badge} badge-sm">{chain.symbol}</span>
									<span class="hidden text-sm font-medium opacity-80 sm:inline">{chain.label}</span>
								</div>

								<!-- Address -->
								<div class="min-w-0 flex-1">
									{#if chain.address}
										<code class="font-mono text-xs break-all opacity-90">{chain.address}</code>
									{:else}
										<span class="text-xs italic opacity-40"
											>Not available (wallet imported via private key)</span
										>
									{/if}
								</div>

								<!-- Actions -->
								{#if chain.address}
									<div class="flex shrink-0 items-center gap-1">
										<button
											class="btn btn-ghost btn-xs"
											title="Copy address"
											onclick={() => copyAddress(chain.address!)}
										>
											{#if copiedAddress === chain.address}
												<Check size={14} class="text-success" />
											{:else}
												<Copy size={14} />
											{/if}
										</button>
										<a
											href="{chain.explorerBase}{chain.address}"
											target="_blank"
											rel="noopener noreferrer"
											class="btn btn-ghost btn-xs"
											title="View on {chain.explorerLabel}"
										>
											<ExternalLink size={14} />
										</a>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>
			<p class="mt-2 ml-1 text-xs opacity-50">
				These are your master wallet addresses derived from your seed phrase. Keep your seed phrase
				safe and offline.
			</p>
		{/if}
	</div>
</div>
