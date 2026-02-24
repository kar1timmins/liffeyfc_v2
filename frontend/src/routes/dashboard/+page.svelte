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
		ShieldCheck
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

	onMount(async () => {
		const ok = await authStore.verify();
		if (!ok) goto('/auth');

		// Fetch full user profile and wallet addresses in parallel
		await Promise.all([fetchUserProfile(), fetchWalletAddresses()]);

		// Subscribe to auth store for updates
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
