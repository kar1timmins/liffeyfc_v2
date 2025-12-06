<script lang="ts">
  import { goto } from '$app/navigation';
  import { Mail, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';

  let email = $state('');
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);

  async function handleSubmit() {
    if (!email.trim()) {
      error = 'Please enter your email address';
      return;
    }

    isSubmitting = true;
    error = null;

    try {
      const response = await fetch(`${PUBLIC_API_URL}/auth/request-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const result = await response.json();

      if (result.success) {
        success = true;
      } else {
        error = result.message || 'Failed to send reset email';
      }
    } catch (err: any) {
      error = 'An error occurred. Please try again later.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Forgot Password - Liffey Founders Club</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center py-12 px-4">
  <div class="max-w-md w-full">
    <!-- Back Button -->
    <button 
      class="btn btn-ghost mb-6"
      onclick={() => goto('/auth')}
    >
      <ArrowLeft class="w-5 h-5" />
      Back to Login
    </button>

    <div class="glass-subtle rounded-3xl p-8">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Mail class="w-8 h-8 text-primary" />
        </div>
        <h1 class="text-3xl font-bold mb-2">Forgot Password?</h1>
        <p class="opacity-70">
          Enter your email address and we'll send you a link to reset your password
        </p>
      </div>

      {#if !success}
        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-6">
          <!-- Email Input -->
          <div class="form-control">
            <label class="label" for="email">
              <span class="label-text">Email Address</span>
            </label>
            <input
              id="email"
              type="email"
              bind:value={email}
              placeholder="your@email.com"
              class="input input-bordered w-full"
              required
              disabled={isSubmitting}
            />
          </div>

          <!-- Error Message -->
          {#if error}
            <div class="alert alert-error">
              <AlertCircle class="w-5 h-5" />
              <span>{error}</span>
            </div>
          {/if}

          <!-- Submit Button -->
          <button
            type="submit"
            class="btn btn-primary w-full"
            disabled={isSubmitting || !email.trim()}
          >
            {#if isSubmitting}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              <Mail class="w-5 h-5" />
            {/if}
            Send Reset Link
          </button>
        </form>
      {:else}
        <!-- Success Message -->
        <div class="alert alert-success">
          <CheckCircle class="w-5 h-5" />
          <div>
            <h3 class="font-bold">Check your email</h3>
            <p class="text-sm mt-1">
              If an account exists with that email address, we've sent password reset instructions.
            </p>
          </div>
        </div>

        <div class="mt-6 text-center">
          <p class="text-sm opacity-70 mb-4">
            Didn't receive the email? Check your spam folder or try again in a few minutes.
          </p>
          <button
            class="btn btn-ghost btn-sm"
            onclick={() => { success = false; email = ''; }}
          >
            Try Different Email
          </button>
        </div>
      {/if}

      <!-- Additional Help -->
      <div class="divider mt-8"></div>
      <div class="text-center text-sm opacity-70">
        <p>
          Remember your password? 
          <a href="/auth" class="link link-primary">Sign in</a>
        </p>
      </div>
    </div>
  </div>
</div>
