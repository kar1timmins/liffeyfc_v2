<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';

	function handleLogout() {
		authStore.logout();
		goto('/login');
	}

	onMount(async () => {
		const ok = await authStore.verify();
		if (!ok) goto('/login');
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
					<button class="btn btn-primary">View Profile</button>
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
					<button class="btn btn-primary">Manage Wallets</button>
				</div>
			</div>
		</div>
	</div>
</div>
