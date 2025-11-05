<script lang="ts">
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';

	let email = '';
	let password = '';
	let errorMessage = '';
	let loading = false;

	function validateEmail(e: string) {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
	}

	async function handleSubmit() {
		errorMessage = '';
		if (!validateEmail(email)) {
			errorMessage = 'Please enter a valid email address.';
			return;
		}
		if (password.length < 6) {
			errorMessage = 'Password must be at least 6 characters.';
			return;
		}
		loading = true;
		try {
			await authStore.register(email, password);
			await goto('/login');
		} catch (err: any) {
			errorMessage = err?.message || 'Registration failed';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex items-center justify-center min-h-screen bg-base-200">
	<div class="card w-full max-w-sm shadow-2xl bg-base-100">
		<form class="card-body" on:submit|preventDefault={handleSubmit}>
			<h2 class="card-title text-2xl mb-4">Create Account</h2>
			{#if errorMessage}
				<div class="alert alert-error">
					<span>{errorMessage}</span>
				</div>
			{/if}
			<div class="form-control">
				<label class="label" for="email">
					<span class="label-text">Email</span>
				</label>
				<input type="email" id="email" bind:value={email} class="input input-bordered" required />
			</div>
			<div class="form-control">
				<label class="label" for="password">
					<span class="label-text">Password</span>
				</label>
				<input
					type="password"
					id="password"
					bind:value={password}
					class="input input-bordered"
					required
				/>
			</div>
			<div class="form-control mt-6">
				<button type="submit" class="btn btn-primary">Sign Up</button>
			</div>
			<div class="divider">OR</div>
			<div class="form-control">
				<button type="button" on:click={() => window.location.href = '/api/auth/google'} class="btn btn-outline">
					Sign up with Google
				</button>
			</div>
			<div class="text-center mt-4">
				<p>
					Already have an account?
					<a href="/login" class="link">Log in</a>
				</p>
			</div>
		</form>
	</div>
</div>
