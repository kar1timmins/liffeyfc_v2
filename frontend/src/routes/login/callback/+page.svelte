<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';

	let success = false;

	onMount(async () => {
		const params = new URLSearchParams(window.location.search);
		const accessToken = params.get('accessToken');
		const refreshToken = params.get('refreshToken');

			if (accessToken && refreshToken) {
				// Persist tokens via auth store and verify user
				await authStore.setTokens(accessToken, refreshToken);
				// verify will fetch /api/auth/me and populate user; ignore failure and still redirect
				const ok = await authStore.verify();
				// show a brief success toast then navigate to profile (or dashboard fallback)
				// use global toast store so messages are consistent
				import('$lib/stores/toast').then(({ toastStore }) => {
					toastStore.add({ message: 'Signed in successfully', type: 'success', ttl: 2000 });
				});
				setTimeout(() => {
					goto(ok ? '/profile' : '/dashboard');
				}, 700);
			} else {
			// Handle error case, maybe redirect to login with an error message
			goto('/login?error=oauth_failed');
		}
	});
</script>

	<div class="flex items-center justify-center min-h-screen">
		{#if !success}
			<div class="text-center">
				<p>Finalizing login...</p>
				<span class="loading loading-dots loading-lg"></span>
			</div>
		{:else}
			<div class="alert alert-success shadow-lg">
				<div>
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4"/></svg>
					<span>Signed in successfully — redirecting…</span>
				</div>
			</div>
		{/if}
	</div>
