<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { PUBLIC_API_URL } from '$env/static/public';

  let user: any = $state(null);
  let isLoading = $state(true);
  let showInvestorForm = $state(false);
  let isUpgrading = $state(false);
  let upgradeError = $state('');
  let upgradeSuccess = $state(false);

  // Investor form fields
  let company = $state('');
  let investmentFocus = $state('');
  let linkedinUrl = $state('');
  let isAccredited = $state(false);

  onMount(async () => {
    const ok = await authStore.verify();
    if (!ok) {
      goto('/auth');
      return;
    }
    
    // Subscribe to auth store to get user data
    const unsubscribe = authStore.subscribe((s) => {
      user = s.user;
      isLoading = false;
    });
    
    // Return cleanup function
    return unsubscribe;
  });

  async function handleUpgradeToInvestor() {
    if (!company || !investmentFocus) {
      upgradeError = 'Company and investment focus are required';
      return;
    }

    isUpgrading = true;
    upgradeError = '';

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${PUBLIC_API_URL}/investors/upgrade`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          company,
          investmentFocus,
          linkedinUrl: linkedinUrl || undefined,
          isAccredited,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to upgrade to investor');
      }

      if (data.success) {
        upgradeSuccess = true;
        // Refresh auth to get new token with investor userType
        setTimeout(() => {
          // Force logout and redirect to login to get new investor token
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          goto('/login?message=Please sign in with your new investor account');
        }, 2000);
      } else {
        upgradeError = data.message || 'Failed to upgrade to investor';
      }
    } catch (error: any) {
      upgradeError = error.message || 'An error occurred during upgrade';
    } finally {
      isUpgrading = false;
    }
  }

  function toggleInvestorForm() {
    showInvestorForm = !showInvestorForm;
    upgradeError = '';
  }
</script>

<div class="container mx-auto p-6">
  <div class="card bg-base-100 shadow-md p-6 max-w-2xl mx-auto">
    <h2 class="text-2xl font-bold mb-4">Your Profile</h2>
    {#if user}
      <div class="space-y-4">
        <div><strong>Name:</strong> {user.name || '—'}</div>
        <div><strong>Email:</strong> {user.email || '—'}</div>
        <div><strong>Account Type:</strong> <span class="badge badge-primary">{user.userType || 'user'}</span></div>
        {#if user.provider}
          <div><strong>Signed in with:</strong> {user.provider}</div>
        {/if}

        <!-- Investor Upgrade Section (only show for users, not investors or staff) -->
        {#if user.userType === 'user'}
          <div class="divider"></div>
          <div class="bg-base-200 p-4 rounded-lg">
            <h3 class="text-xl font-semibold mb-2">Upgrade to Investor Account</h3>
            <p class="text-sm mb-4">
              Are you an investor or VC? Upgrade your account to access investor-specific features and connect with founders.
            </p>
            
            <button
              class="btn btn-primary"
              onclick={toggleInvestorForm}
              disabled={upgradeSuccess}
            >
              {showInvestorForm ? 'Cancel' : 'Become an Investor'}
            </button>

            {#if showInvestorForm}
              <form onsubmit={(e) => { e.preventDefault(); handleUpgradeToInvestor(); }} class="mt-6 space-y-4">
                <div>
                  <label class="label">
                    <span class="label-text">Company/Fund Name *</span>
                  </label>
                  <input
                    type="text"
                    bind:value={company}
                    class="input input-bordered w-full"
                    placeholder="e.g., Acme Ventures"
                    required
                    disabled={isUpgrading}
                  />
                </div>

                <div>
                  <label class="label">
                    <span class="label-text">Investment Focus *</span>
                  </label>
                  <textarea
                    bind:value={investmentFocus}
                    class="textarea textarea-bordered w-full"
                    placeholder="Describe your investment thesis, sectors of interest, stage preferences..."
                    rows="3"
                    required
                    disabled={isUpgrading}
                  ></textarea>
                </div>

                <div>
                  <label class="label">
                    <span class="label-text">LinkedIn Profile URL</span>
                  </label>
                  <input
                    type="url"
                    bind:value={linkedinUrl}
                    class="input input-bordered w-full"
                    placeholder="https://linkedin.com/in/yourprofile"
                    disabled={isUpgrading}
                  />
                </div>

                <div class="form-control">
                  <label class="label cursor-pointer justify-start gap-4">
                    <input
                      type="checkbox"
                      bind:checked={isAccredited}
                      class="checkbox"
                      disabled={isUpgrading}
                    />
                    <span class="label-text">I am an accredited investor</span>
                  </label>
                </div>

                {#if upgradeError}
                  <div class="alert alert-error">
                    <span>{upgradeError}</span>
                  </div>
                {/if}

                {#if upgradeSuccess}
                  <div class="alert alert-success">
                    <span>Successfully upgraded to investor! Redirecting to login...</span>
                  </div>
                {/if}

                <div class="flex gap-2">
                  <button
                    type="submit"
                    class="btn btn-primary"
                    disabled={isUpgrading || upgradeSuccess}
                  >
                    {isUpgrading ? 'Upgrading...' : 'Complete Upgrade'}
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost"
                    onclick={toggleInvestorForm}
                    disabled={isUpgrading || upgradeSuccess}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            {/if}
          </div>
        {/if}
      </div>
    {:else if isLoading}
      <div class="flex items-center justify-center py-8">
        <span class="loading loading-spinner loading-lg"></span>
        <span class="ml-2">Loading profile…</span>
      </div>
    {:else}
      <div class="alert alert-warning">
        <span>Unable to load profile data. Please try logging in again.</span>
      </div>
    {/if}
  </div>
</div>
