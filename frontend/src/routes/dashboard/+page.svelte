<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import { walletStore, isConnected, formattedAddress } from '$lib/stores/walletStore';
	import { toastStore } from '$lib/stores/toast';

	let user: any = null;

	function handleLogout() {
		authStore.logout();
		// disconnect wallet when user logs out
		try {
			walletStore.disconnect();
		} catch (e) {}
		goto('/login');
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
		if (!ok) goto('/login');
		// subscribe to authStore to get user for display
		authStore.subscribe((s) => (user = s.user))();
	});
</script>

<div class="container mx-auto p-4">
	<div class="flex justify-between items-center mb-8">
		<h1 class="text-3xl font-bold">Dashboard</h1>
		<button on:click={handleLogout} class="btn btn-outline btn-error">Logout</button>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">Profile</h2>
				<p>View and edit your profile information.</p>
				<div class="card-actions justify-end">
					<button class="btn btn-primary" on:click={() => goto('/profile')}>View Profile</button>
				</div>
			</div>
		</div>

		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">Settings</h2>
				<p>Manage your account settings and preferences.</p>
				<div class="card-actions justify-end">
					<button class="btn btn-primary">Go to Settings</button>
				</div>
			</div>
		</div>

		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">My Wallets</h2>
				<p>Connect and manage your Web3 wallets.</p>
				<div class="card-actions justify-end">
					{#if $authStore.isAuthenticated}
						{#if $isConnected}
							<div class="flex items-center gap-3">
								<div class="text-sm">{$formattedAddress}</div>
								<button class="btn btn-outline" on:click={() => walletStore.disconnect()}>Disconnect</button>
							</div>
						{:else}
							<button class="btn btn-primary" on:click={connectWallet}>Connect Wallet</button>
						{/if}
					{:else}
						<button class="btn btn-disabled" disabled>Sign in to manage</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
