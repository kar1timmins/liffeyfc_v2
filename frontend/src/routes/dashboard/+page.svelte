<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import { walletStore, isConnected, formattedAddress } from '$lib/stores/walletStore';
	import { toastStore } from '$lib/stores/toast';
	import { User, Settings, Wallet, LogOut, UserCircle, Briefcase } from 'lucide-svelte';

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

	onMount(async () => {
		const ok = await authStore.verify();
		if (!ok) goto('/auth');
		// subscribe to authStore to get user for display
		authStore.subscribe((s) => {
			user = s.user;
			// Set avatar URL if user has one
			if (s.user?.avatarUrl) {
				avatarUrl = s.user.avatarUrl;
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
		<!-- Profile Card -->
		<div class="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-base-300">
			<div class="card-body">
				<div class="flex items-center gap-3 mb-4">
					<div class="p-3 rounded-lg bg-primary/10">
						<User size={24} class="text-primary" />
					</div>
					<h2 class="card-title text-xl">Profile</h2>
				</div>
				<p class="text-base-content/70 mb-4 flex-grow">View and edit your profile information, upgrade to investor account, and manage your details.</p>
				<div class="card-actions">
					<button class="btn btn-primary btn-block" onclick={() => goto('/profile')}>
						View Profile
					</button>
				</div>
			</div>
		</div>

		<!-- Settings Card -->
		<div class="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-base-300">
			<div class="card-body">
				<div class="flex items-center gap-3 mb-4">
					<div class="p-3 rounded-lg bg-secondary/10">
						<Settings size={24} class="text-secondary" />
					</div>
					<h2 class="card-title text-xl">Settings</h2>
				</div>
				<p class="text-base-content/70 mb-4 flex-grow">Manage your account settings, preferences, and security options.</p>
				<div class="card-actions">
					<button class="btn btn-secondary btn-block" disabled>
						Coming Soon
					</button>
				</div>
			</div>
		</div>

		<!-- Wallets Card -->
		<div class="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-base-300">
			<div class="card-body">
				<div class="flex items-center gap-3 mb-4">
					<div class="p-3 rounded-lg bg-accent/10">
						<Wallet size={24} class="text-accent" />
					</div>
					<h2 class="card-title text-xl">Web3 Wallets</h2>
				</div>
				<p class="text-base-content/70 mb-4 flex-grow">Connect and manage your Web3 wallets for blockchain interactions.</p>
				<div class="card-actions">
					{#if $authStore.isAuthenticated}
						{#if $isConnected}
							<div class="w-full space-y-2">
								<div class="p-3 rounded-lg bg-success/10 border border-success/20">
									<div class="text-xs text-success font-semibold mb-1">Connected</div>
									<div class="font-mono text-sm">{$formattedAddress}</div>
								</div>
								<button class="btn btn-outline btn-error btn-sm btn-block" onclick={() => walletStore.disconnect()}>
									Disconnect Wallet
								</button>
							</div>
						{:else}
							<button class="btn btn-accent btn-block" onclick={connectWallet}>
								Connect Wallet
							</button>
						{/if}
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
