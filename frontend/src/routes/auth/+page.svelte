<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { authStore } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Check, X } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';

  let mode: 'login' | 'register' = 'login';
  let email = '';
  let password = '';
  let name = '';
  let error = '';
  let loading = false;

  // Password requirements state
  $: passwordRequirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[@$!%*?&]/.test(password),
  };

  $: allRequirementsMet = Object.values(passwordRequirements).every(r => r);

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
    if (mode === 'register' && !allRequirementsMet) {
      error = 'Please meet all password requirements.';
      return;
    }
    if (mode === 'login' && password.length < 6) {
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
    window.location.href = `${PUBLIC_API_URL}/auth/google`;
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
        
        {#if mode === 'register' && password.length > 0}
          <div class="bg-base-200 rounded-lg p-3 mb-3 space-y-1.5" in:fly={{y:10, duration:200}}>
            <p class="text-xs font-semibold text-base-content/70 mb-2">Password Requirements:</p>
            
            <div class="flex items-center gap-2 text-xs">
              {#if passwordRequirements.minLength}
                <Check class="w-4 h-4 text-success flex-shrink-0" />
                <span class="text-success">At least 8 characters</span>
              {:else}
                <X class="w-4 h-4 text-error flex-shrink-0" />
                <span class="text-base-content/60">At least 8 characters</span>
              {/if}
            </div>
            
            <div class="flex items-center gap-2 text-xs">
              {#if passwordRequirements.hasUppercase}
                <Check class="w-4 h-4 text-success flex-shrink-0" />
                <span class="text-success">One uppercase letter (A-Z)</span>
              {:else}
                <X class="w-4 h-4 text-error flex-shrink-0" />
                <span class="text-base-content/60">One uppercase letter (A-Z)</span>
              {/if}
            </div>
            
            <div class="flex items-center gap-2 text-xs">
              {#if passwordRequirements.hasLowercase}
                <Check class="w-4 h-4 text-success flex-shrink-0" />
                <span class="text-success">One lowercase letter (a-z)</span>
              {:else}
                <X class="w-4 h-4 text-error flex-shrink-0" />
                <span class="text-base-content/60">One lowercase letter (a-z)</span>
              {/if}
            </div>
            
            <div class="flex items-center gap-2 text-xs">
              {#if passwordRequirements.hasNumber}
                <Check class="w-4 h-4 text-success flex-shrink-0" />
                <span class="text-success">One number (0-9)</span>
              {:else}
                <X class="w-4 h-4 text-error flex-shrink-0" />
                <span class="text-base-content/60">One number (0-9)</span>
              {/if}
            </div>
            
            <div class="flex items-center gap-2 text-xs">
              {#if passwordRequirements.hasSpecial}
                <Check class="w-4 h-4 text-success flex-shrink-0" />
                <span class="text-success">One special character (@$!%*?&)</span>
              {:else}
                <X class="w-4 h-4 text-error flex-shrink-0" />
                <span class="text-base-content/60">One special character (@$!%*?&)</span>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <div class="flex items-center gap-3 mt-4">
        <button class="btn btn-primary" type="submit" disabled={loading}>{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" class="btn btn-outline" on:click={handleGoogle}>Continue with Google</button>
      </div>
    </form>
  </div>
</div>
