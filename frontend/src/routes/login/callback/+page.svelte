<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import { PUBLIC_API_URL } from '$env/static/public';

	let success = false;
	let error = '';

	onMount(async () => {
		const params = new URLSearchParams(window.location.search);
		const code = params.get('code');

		if (code) {
			try {
				// Exchange one-time code for access token
				const res = await fetch(`${PUBLIC_API_URL}/auth/oauth/exchange`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include', // Send refresh token cookie
					body: JSON.stringify({ code }),
				});

				if (!res.ok) {
					throw new Error('Failed to exchange OAuth code');
				}

				const json = await res.json();
				const accessToken = json.data?.accessToken;

				if (!accessToken) {
					throw new Error('No access token received');
				}

				// Store access token in memory; refresh token is already in httpOnly cookie
				await authStore.setAccessToken(accessToken);
				
				// Verify will fetch /api/auth/me and populate user
				const ok = await authStore.verify();
				
				// Show success toast
				success = true;
				import('$lib/stores/toast').then(({ toastStore }) => {
					toastStore.add({ message: 'Signed in successfully', type: 'success', ttl: 2000 });
				});
				
				setTimeout(() => {
					goto(ok ? '/profile' : '/dashboard');
				}, 700);
			} catch (err) {
				error = err instanceof Error ? err.message : 'OAuth authentication failed';
				// Redirect to auth page with error after brief delay
				setTimeout(() => {
					goto('/auth?error=oauth_failed');
				}, 2000);
			}
		} else {
			// No code provided, redirect to auth page
			error = 'No OAuth code provided';
			setTimeout(() => {
				goto('/auth?error=oauth_failed');
			}, 2000);
		}
	});
</script>

<div class="flex items-center justify-center min-h-screen">
	{#if error}
		<div class="alert alert-error shadow-lg">
			<div>
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{error}</span>
			</div>
		</div>
	{:else if !success}
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
