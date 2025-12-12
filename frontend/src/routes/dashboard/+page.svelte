<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import { walletStore, isConnected, formattedAddress } from '$lib/stores/walletStore';
	import { toastStore } from '$lib/stores/toast';
	import { User, Settings, Wallet, LogOut, UserCircle, Briefcase, Home, Building2, Target, TrendingUp } from 'lucide-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';

	let user = $state<any>(null);
	let avatarUrl = $state<string | null>(null);

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
			toastStore.add({ message: e?.message || 'Failed to connect wallet', type: 'error', ttl: 5000 });
		}
	}

	async function fetchUserProfile() {
		try {
			const token = $authStore.accessToken;
			if (!token || !$authStore.user?.id) return;

			const response = await fetch(`${PUBLIC_API_URL}/users/${$authStore.user.id}`, {
				headers: {
					'Authorization': `Bearer ${token}`
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

	onMount(async () => {
		const ok = await authStore.verify();
		if (!ok) goto('/auth');
		
		// Fetch full user profile with GCP avatar
		await fetchUserProfile();
		
		// Subscribe to auth store for updates
		authStore.subscribe((s) => {
			if (s.user && !user) {
				fetchUserProfile();
			}
		})();
	});

	function getRoleBadgeClass(role: string) {
		switch(role) {
			case 'investor': return 'badge-accent';
			case 'staff': return 'badge-secondary';
			default: return 'badge-primary';
		}
	}
</script>

<!-- Min height ensures footer stays at bottom -->
<div class="min-h-[calc(100vh-20rem)] container mx-auto px-4 py-8 max-w-7xl">
	<!-- Header Section -->
	<div class="mb-8">
		<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
			<div>
				<h1 class="text-4xl font-bold mb-2">Dashboard</h1>
				{#if user}
					<p class="text-base-content/70">Welcome back, <span class="font-semibold">{user.name || user.email}</span>!</p>
				{/if}
			</div>
			<button onclick={handleLogout} class="btn btn-outline btn-error gap-2">
				<LogOut size={18} />
				Logout
			</button>
		</div>
		
		<!-- User Info Card -->
		{#if user}
			<div class="card bg-gradient-to-br from-primary/10 to-secondary/10 shadow-md">
				<div class="card-body">
					<div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
						<div class="avatar">
							<div class="w-16 h-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
								{#if avatarUrl}
									<img src={avatarUrl} alt={user.name || 'User'} />
								{:else}
									<div class="bg-primary text-primary-content rounded-full w-16 h-16 flex items-center justify-center">
										<span class="text-2xl">{user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}</span>
									</div>
								{/if}
							</div>
						</div>
						<div class="flex-1">
							<h2 class="text-2xl font-bold">{user.name || 'User'}</h2>
							<p class="text-base-content/70">{user.email}</p>
							<div class="mt-2">
								<span class="badge {getRoleBadgeClass(user.role)} badge-lg gap-2">
									{#if user.role === 'investor'}
										<Briefcase size={14} />
									{:else}
										<UserCircle size={14} />
									{/if}
									{user.role === 'investor' ? 'Investor' : user.role === 'staff' ? 'Staff' : 'Founder'}
								</span>
							</div>
						</div>
						{#if user.role === 'user'}
							<button class="btn btn-primary btn-sm" onclick={() => goto('/profile')}>
								Upgrade to Investor
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Quick Actions Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
		<!-- Home Card -->
		<div class="card bg-base-100 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
			<div class="card-body">
				<div class="flex items-center gap-3 mb-4">
					<div class="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
						<Home size={24} class="text-primary" />
					</div>
					<h2 class="card-title text-xl">Home</h2>
				</div>
				<p class="text-base-content/70 mb-4 flex-grow">Return to the main landing page to explore the Liffey Founders Club.</p>
				<div class="card-actions">
					<button class="btn btn-primary btn-block" onclick={() => goto('/')}>
						Go Home
					</button>
				</div>
			</div>
		</div>

		<!-- Companies Card -->
		<div class="card bg-base-100 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
			<div class="card-body">
				<div class="flex items-center gap-3 mb-4">
					<div class="p-3 rounded-lg bg-gradient-to-br from-secondary/20 to-secondary/10">
						<Building2 size={24} class="text-secondary" />
					</div>
					<h2 class="card-title text-xl">Companies</h2>
				</div>
				<p class="text-base-content/70 mb-4 flex-grow">Browse all companies in the network, view profiles, and discover opportunities.</p>
				<div class="card-actions">
					<button class="btn btn-secondary btn-block" onclick={() => goto('/companies')}>
						View Companies
					</button>
				</div>
			</div>
		</div>

		<!-- Bounties Card -->
		{#if user?.role === 'user' || user?.role === 'investor' || user?.role === 'staff'}
			<div class="card bg-base-100 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
				<div class="card-body">
					<div class="flex items-center gap-3 mb-4">
						<div class="p-3 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10">
							<Target size={24} class="text-accent" />
						</div>
						<h2 class="card-title text-xl">Bounties</h2>
					</div>
					<p class="text-base-content/70 mb-4 flex-grow">Explore crowdfunding campaigns and support companies with blockchain escrow.</p>
					<div class="card-actions">
						<button class="btn btn-accent btn-block" onclick={() => goto('/bounties')}>
							View Bounties
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Profile Card -->
		<div class="card bg-base-100 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
			<div class="card-body">
				<div class="flex items-center gap-3 mb-4">
					<div class="p-3 rounded-lg bg-gradient-to-br from-info/20 to-info/10">
						<User size={24} class="text-info" />
					</div>
					<h2 class="card-title text-xl">Profile</h2>
				</div>
				<p class="text-base-content/70 mb-4 flex-grow">View and edit your profile information, upgrade to investor account, and manage your details.</p>
				<div class="card-actions">
					<button class="btn btn-info btn-block" onclick={() => goto('/profile')}>
						View Profile
					</button>
				</div>
			</div>
		</div>

		<!-- Settings Card -->
		<div class="card bg-base-100 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
			<div class="card-body">
				<div class="flex items-center gap-3 mb-4">
					<div class="p-3 rounded-lg bg-gradient-to-br from-warning/20 to-warning/10">
						<Settings size={24} class="text-warning" />
					</div>
					<h2 class="card-title text-xl">Settings</h2>
				</div>
				<p class="text-base-content/70 mb-4 flex-grow">Manage your account settings, preferences, and security options.</p>
				<div class="card-actions">
					<button class="btn btn-outline btn-block" disabled>
						Coming Soon
					</button>
				</div>
			</div>
		</div>

		<!-- Send Funds Card -->
		<div class="card bg-base-100 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
			<div class="card-body">
				<div class="flex items-center gap-3 mb-4">
					<div class="p-3 rounded-lg bg-gradient-to-br from-success/20 to-success/10">
						<Wallet size={24} class="text-success" />
					</div>
					<h2 class="card-title text-xl">Send Funds</h2>
				</div>
				<p class="text-base-content/70 mb-4 flex-grow">Transfer cryptocurrency to any wallet address on supported networks.</p>
				<div class="card-actions">
					{#if $authStore.isAuthenticated}
						<button 
							class="btn btn-success btn-block"
							onclick={() => goto('/send')}
						>
							Go to Send Funds
						</button>
					{:else}
						<button class="btn btn-disabled btn-block" disabled>
							Sign in to manage
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
