<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Lock, ArrowLeft, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';

  let token = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let isValidating = $state(true);
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);
  let tokenValid = $state(false);
  let showPassword = $state(false);
  let showConfirmPassword = $state(false);

  onMount(async () => {
    // Get token from URL query parameters
    token = $page.url.searchParams.get('token') || '';

    if (!token) {
      error = 'Invalid reset link. Please request a new password reset.';
      isValidating = false;
      return;
    }

    // Validate token
    await validateToken();
  });

  async function validateToken() {
    try {
      const response = await fetch(`${PUBLIC_API_URL}/auth/validate-reset-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const result = await response.json();

      if (result.success && result.valid) {
        tokenValid = true;
      } else {
        error = 'This reset link has expired or is invalid. Please request a new one.';
      }
    } catch (err) {
      error = 'Failed to validate reset link. Please try again.';
    } finally {
      isValidating = false;
    }
  }

  async function handleSubmit() {
    error = null;

    // Validation
    if (newPassword.length < 8) {
      error = 'Password must be at least 8 characters long';
      return;
    }

    if (newPassword !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }

    isSubmitting = true;

    try {
      const response = await fetch(`${PUBLIC_API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      const result = await response.json();

      if (result.success) {
        success = true;
        // Redirect to login after 3 seconds
        setTimeout(() => {
          goto('/auth');
        }, 3000);
      } else {
        error = result.message || 'Failed to reset password';
      }
    } catch (err: any) {
      error = 'An error occurred. Please try again later.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Reset Password - Liffey Founders Club</title>
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
          <Lock class="w-8 h-8 text-primary" />
        </div>
        <h1 class="text-3xl font-bold mb-2">Reset Password</h1>
        <p class="opacity-70">
          Enter your new password below
        </p>
      </div>

      {#if isValidating}
        <!-- Validating Token -->
        <div class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      {:else if !tokenValid}
        <!-- Invalid Token -->
        <div class="alert alert-error">
          <AlertCircle class="w-5 h-5" />
          <div>
            <h3 class="font-bold">Invalid or Expired Link</h3>
            <p class="text-sm mt-1">{error}</p>
          </div>
        </div>

        <div class="mt-6 text-center">
          <a href="/forgot-password" class="btn btn-primary">
            Request New Reset Link
          </a>
        </div>
      {:else if success}
        <!-- Success Message -->
        <div class="alert alert-success">
          <CheckCircle class="w-5 h-5" />
          <div>
            <h3 class="font-bold">Password Reset Successfully!</h3>
            <p class="text-sm mt-1">
              Your password has been reset. Redirecting to login...
            </p>
          </div>
        </div>

        <div class="mt-6 text-center">
          <p class="text-sm opacity-70">
            Not redirected? <a href="/auth" class="link link-primary">Click here to login</a>
          </p>
        </div>
      {:else}
        <!-- Reset Form -->
        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-6">
          <!-- New Password -->
          <div class="form-control">
            <label class="label" for="new-password">
              <span class="label-text">New Password</span>
              <span class="label-text-alt text-xs opacity-60">Min. 8 characters</span>
            </label>
            <div class="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                bind:value={newPassword}
                placeholder="••••••••"
                class="input input-bordered w-full pr-12"
                required
                minlength="8"
                disabled={isSubmitting}
              />
              <button
                type="button"
                class="btn btn-ghost btn-sm btn-circle absolute right-2 top-1/2 -translate-y-1/2"
                onclick={() => showPassword = !showPassword}
              >
                {#if showPassword}
                  <EyeOff class="w-4 h-4" />
                {:else}
                  <Eye class="w-4 h-4" />
                {/if}
              </button>
            </div>
          </div>

          <!-- Confirm Password -->
          <div class="form-control">
            <label class="label" for="confirm-password">
              <span class="label-text">Confirm Password</span>
            </label>
            <div class="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                bind:value={confirmPassword}
                placeholder="••••••••"
                class="input input-bordered w-full pr-12"
                required
                minlength="8"
                disabled={isSubmitting}
              />
              <button
                type="button"
                class="btn btn-ghost btn-sm btn-circle absolute right-2 top-1/2 -translate-y-1/2"
                onclick={() => showConfirmPassword = !showConfirmPassword}
              >
                {#if showConfirmPassword}
                  <EyeOff class="w-4 h-4" />
                {:else}
                  <Eye class="w-4 h-4" />
                {/if}
              </button>
            </div>
          </div>

          <!-- Error Message -->
          {#if error}
            <div class="alert alert-error">
              <AlertCircle class="w-5 h-5" />
              <span>{error}</span>
            </div>
          {/if}

          <!-- Password Requirements -->
          <div class="text-xs opacity-60">
            <p class="font-semibold mb-1">Password must:</p>
            <ul class="list-disc list-inside space-y-1">
              <li class:text-success={newPassword.length >= 8}>Be at least 8 characters long</li>
              <li class:text-success={newPassword && newPassword === confirmPassword}>Match confirmation password</li>
            </ul>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            class="btn btn-primary w-full"
            disabled={isSubmitting || !newPassword || !confirmPassword || newPassword.length < 8}
          >
            {#if isSubmitting}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              <Lock class="w-5 h-5" />
            {/if}
            Reset Password
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>
