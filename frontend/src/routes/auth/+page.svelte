<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { authStore } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let mode: 'login' | 'register' = 'login';
  let email = '';
  let password = '';
  let name = '';
  let error = '';
  let loading = false;

  function switchTo(m: 'login' | 'register') {
    mode = m;
    error = '';
  }

  async function submit() {
    error = '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      error = 'Please enter a valid email address.';
      return;
    }
    if (password.length < 6) {
      error = 'Password must be at least 6 characters.';
      return;
    }
    loading = true;
    try {
      if (mode === 'login') {
        await authStore.login(email, password);
      } else {
        await authStore.register(email, password, name || undefined);
        // after register, log them in
        await authStore.login(email, password);
      }
      goto('/dashboard');
    } catch (e: any) {
      error = e?.message || 'Failed';
    } finally {
      loading = false;
    }
  }

  function handleGoogle() {
    window.location.href = '/api/auth/google';
  }

  onMount(()=>{
    // start in login by default
  });
</script>

<div class="min-h-screen flex items-center justify-center bg-base-200">
  <div class="card w-full max-w-md shadow-xl bg-base-100 p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
      <div class="space-x-2">
        <button class="btn btn-sm btn-ghost" on:click={() => switchTo('login')}>Login</button>
        <button class="btn btn-sm btn-ghost" on:click={() => switchTo('register')}>Register</button>
      </div>
    </div>

    {#if error}
      <div class="alert alert-error mb-4">{error}</div>
    {/if}

    <form on:submit|preventDefault={submit}>
      {#if mode === 'register'}
        <div in:fly={{x:20}} out:fade>
          <label class="label" for="name"><span class="label-text">Name</span></label>
          <input id="name" class="input input-bordered w-full mb-3" bind:value={name} />
        </div>
      {/if}

      <div in:fly={{x:20}} out:fade>
        <label class="label" for="email"><span class="label-text">Email</span></label>
        <input id="email" type="email" class="input input-bordered w-full mb-3" bind:value={email} />

        <label class="label" for="password"><span class="label-text">Password</span></label>
        <input id="password" type="password" class="input input-bordered w-full mb-3" bind:value={password} />
      </div>

      <div class="flex items-center gap-3 mt-4">
        <button class="btn btn-primary" type="submit" disabled={loading}>{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" class="btn btn-outline" on:click={handleGoogle}>Continue with Google</button>
      </div>
    </form>
  </div>
</div>
