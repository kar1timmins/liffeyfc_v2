<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { User, Mail, Briefcase, Building, Globe, Linkedin, CheckCircle, ArrowUpCircle, ArrowLeft, Camera, Wallet } from 'lucide-svelte';
  import GenerateWalletModal from '$lib/components/GenerateWalletModal.svelte';
  import RestoreWalletModal from '$lib/components/RestoreWalletModal.svelte';
  import CompanyManager from '$lib/components/CompanyManager.svelte';

  let user: any = $state(null);
  let isLoading = $state(true);
  let showInvestorForm = $state(false);
  let isUpgrading = $state(false);
  let upgradeError = $state('');
  let upgradeSuccess = $state(false);
  let showGenerateWalletModal = $state(false);
  let showRestoreWalletModal = $state(false);
  let companies = $state<any[]>([]);
  let walletRefreshTrigger = $state(0);

  // Master wallet state
  let masterWallet = $state<any>(null);
  let loadingWallet = $state(false);

  // Avatar upload
  let fileInput: HTMLInputElement | undefined = $state();
  let isUploading = $state(false);
  let uploadError = $state('');

  // Investor form fields
  let company = $state('');
  let investmentFocus = $state('');
  let linkedinUrl = $state('');
  let isAccredited = $state(false);

  onMount(() => {
    // Handle async verification without making onMount async
    authStore.verify().then((ok) => {
      if (!ok) {
        goto('/auth');
        return;
      }
      // Fetch companies after verification
      fetchMyCompanies();
    });
    
    // Subscribe to auth store to get user data
    const unsubscribe = authStore.subscribe((s) => {
      user = s.user;
      isLoading = false;
    });
    
    // Return cleanup function
    return unsubscribe;
  });

  async function fetchMyCompanies() {
    try {
      const token = $authStore.accessToken;
      if (!token) return;

      const response = await fetch(`${PUBLIC_API_URL}/companies/my-companies`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        companies = data.data;
        
        // Dispatch event to refresh FAB navigation
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('refresh-user-companies'));
        }
      }
    } catch (err) {
      console.error('Failed to fetch companies:', err);
    }
  }

  async function fetchMasterWallet() {
    try {
      const token = $authStore.accessToken;
      if (!token) return;

      loadingWallet = true;
      const response = await fetch(`${PUBLIC_API_URL}/wallet/addresses`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        masterWallet = data.data;
      }
    } catch (err) {
      console.error('Failed to fetch master wallet:', err);
    } finally {
      loadingWallet = false;
    }
  }

  // Fetch master wallet when user changes
  $effect(() => {
    if (user && $authStore.accessToken) {
      fetchMasterWallet();
    }
  });

  function handleWalletGenerated() {
    // Increment trigger to refresh wallet status in CompanyManager
    walletRefreshTrigger++;
    // Fetch the master wallet to display addresses
    fetchMasterWallet();
    // Fetch companies to display newly generated wallet addresses
    fetchMyCompanies();
  }

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (!file) return;
    
    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      uploadError = 'Please select an image file';
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      uploadError = 'Image size must be less than 5MB';
      return;
    }

    isUploading = true;
    uploadError = '';

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${PUBLIC_API_URL}/users/upload-avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to upload image');
      }
      
      if (data.success) {
        // Update the user's profile photo URL in the auth store
        let currentUser: any = null;
        const unsubscribe = authStore.subscribe(s => currentUser = s.user);
        unsubscribe(); // Get current value and unsubscribe immediately
        
        if (currentUser) {
          const updatedUser = { ...currentUser, profilePhotoUrl: data.data.profilePhotoUrl };
          await authStore.setAccessToken(token!, updatedUser);
        }
      }
    } catch (error: any) {
      uploadError = error.message || 'Failed to upload image';
    } finally {
      isUploading = false;
      if (fileInput) fileInput.value = '';
    }
  }

  async function handleUpgradeToInvestor() {
    if (!company || !investmentFocus) {
      upgradeError = 'Company and investment focus are required';
      return;
    }

    isUpgrading = true;
    upgradeError = '';

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${PUBLIC_API_URL}/users/upgrade-to-investor`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          investorCompany: company,
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
        
        // Update the access token with the new investor token
        if (data.data?.accessToken) {
          await authStore.setAccessToken(data.data.accessToken, data.data.user);
        }
        
        // Redirect to profile or dashboard after a short delay
        setTimeout(() => {
          goto('/dashboard');
        }, 1500);
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

  function getRoleBadgeClass(role: string) {
    switch(role) {
      case 'investor': return 'badge-accent';
      case 'staff': return 'badge-secondary';
      default: return 'badge-primary';
    }
  }

  function getRoleDisplayName(role: string) {
    switch(role) {
      case 'investor': return 'Investor';
      case 'staff': return 'Staff';
      default: return 'Founder';
    }
  }
</script>

<!-- Min height ensures footer stays at bottom -->
<div class="min-h-[calc(100vh-20rem)] container mx-auto px-4 py-8 max-w-4xl">
  <!-- Back Button -->
  <button class="btn btn-ghost btn-sm gap-2 mb-6" onclick={() => goto('/dashboard')}>
    <ArrowLeft size={18} />
    Back to Dashboard
  </button>

  <!-- Page Header -->
  <div class="mb-8">
    <h1 class="text-4xl font-bold mb-2">Your Profile</h1>
    <p class="text-base-content/70">Manage your account information and preferences</p>
  </div>

  <GenerateWalletModal 
    bind:isOpen={showGenerateWalletModal}
    onWalletGenerated={handleWalletGenerated}
  />

  <RestoreWalletModal 
    bind:isOpen={showRestoreWalletModal}
    onWalletRestored={handleWalletGenerated}
  />

  {#if isLoading}
    <!-- Loading State -->
    <div class="card bg-base-100 shadow-lg">
      <div class="card-body">
        <div class="flex flex-col items-center justify-center py-12">
          <span class="loading loading-spinner loading-lg text-primary"></span>
          <span class="mt-4 text-base-content/70">Loading profile…</span>
        </div>
      </div>
    </div>
  {:else if user}
    <!-- Profile Information Card -->
    <div class="card bg-base-100 shadow-lg mb-6 border border-base-300">
      <div class="card-body">
        <div class="flex items-start gap-6 mb-6">
          <!-- Avatar -->
          <div class="relative group">
            <div class="avatar placeholder">
              <div class="bg-primary text-primary-content rounded-full w-24 h-24 overflow-hidden">
                {#if user.profilePhotoUrl}
                  <img src={user.profilePhotoUrl} alt={user.name} class="w-full h-full object-cover" />
                {:else}
                  <span class="text-3xl">{user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}</span>
                {/if}
              </div>
            </div>
            
            <!-- Upload Overlay -->
            <button 
              class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none w-24 h-24"
              onclick={() => fileInput?.click()}
              disabled={isUploading}
              aria-label="Change profile photo"
            >
              {#if isUploading}
                <span class="loading loading-spinner text-white"></span>
              {:else}
                <Camera class="text-white" size={24} />
              {/if}
            </button>
            
            <input 
              type="file" 
              accept="image/*" 
              class="hidden" 
              bind:this={fileInput}
              onchange={handleFileSelect}
            />
            
            {#if uploadError}
              <div class="text-error text-xs mt-1 absolute top-full left-0 w-32 text-center">{uploadError}</div>
            {/if}
          </div>
          
          <!-- User Info -->
          <div class="flex-1">
            <h2 class="text-3xl font-bold mb-2">{user.name || 'User'}</h2>
            <div class="flex flex-wrap gap-2 mb-4">
              <span class="badge {getRoleBadgeClass(user.role)} badge-lg gap-2">
                {#if user.role === 'investor'}
                  <Briefcase size={14} />
                {:else}
                  <User size={14} />
                {/if}
                {getRoleDisplayName(user.role)}
              </span>
              {#if user.isActive !== false}
                <span class="badge badge-success badge-lg gap-2">
                  <CheckCircle size={14} />
                  Active
                </span>
              {/if}
            </div>
          </div>
        </div>

        <!-- Details Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Email -->
          <div class="flex items-start gap-3 p-4 rounded-lg bg-base-200/50">
            <Mail size={20} class="text-primary mt-1" />
            <div>
              <div class="text-sm text-base-content/60 mb-1">Email</div>
              <div class="font-medium">{user.email || '—'}</div>
            </div>
          </div>

          <!-- Provider -->
          {#if user.provider}
            <div class="flex items-start gap-3 p-4 rounded-lg bg-base-200/50">
              <User size={20} class="text-secondary mt-1" />
              <div>
                <div class="text-sm text-base-content/60 mb-1">Sign-in Method</div>
                <div class="font-medium capitalize">{user.provider}</div>
              </div>
            </div>
          {/if}

          <!-- Company (if investor) -->
          {#if user.role === 'investor' && user.investorCompany}
            <div class="flex items-start gap-3 p-4 rounded-lg bg-base-200/50">
              <Building size={20} class="text-accent mt-1" />
              <div>
                <div class="text-sm text-base-content/60 mb-1">Company/Fund</div>
                <div class="font-medium">{user.investorCompany}</div>
              </div>
            </div>
          {/if}

          <!-- LinkedIn -->
          {#if user.linkedinUrl}
            <div class="flex items-start gap-3 p-4 rounded-lg bg-base-200/50">
              <Linkedin size={20} class="text-info mt-1" />
              <div>
                <div class="text-sm text-base-content/60 mb-1">LinkedIn</div>
                <a href={user.linkedinUrl} target="_blank" rel="noopener" class="font-medium link link-primary">
                  View Profile
                </a>
              </div>
            </div>
          {/if}
        </div>

        <!-- Wallet Section -->
        <div class="divider"></div>
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold mb-1 flex items-center gap-2">
              <Wallet size={18} class="text-primary" />
              Master Wallet
            </h3>
            <p class="text-sm text-base-content/70">Your blockchain wallet addresses</p>
          </div>
          <div class="flex gap-2">
            {#if !masterWallet}
              <button 
                class="btn btn-outline btn-ghost gap-2"
                onclick={() => showRestoreWalletModal = true}
                title="Restore from backup"
              >
                <Wallet size={18} />
                Restore Wallet
              </button>
            {/if}
            {#if !masterWallet}
              <button 
                class="btn btn-outline btn-primary gap-2"
                onclick={() => showGenerateWalletModal = true}
              >
                <Wallet size={18} />
                Generate New Wallet
              </button>
            {/if}
          </div>
        </div>

        <!-- Master Wallet Display -->
        {#if loadingWallet}
          <div class="space-y-2">
            <div class="h-12 skeleton"></div>
            <div class="h-12 skeleton"></div>
          </div>
        {:else if masterWallet}
          <div class="space-y-3">
            <!-- Ethereum Address -->
            <div class="flex items-start gap-3 p-4 rounded-lg bg-base-200/50 border border-primary/20">
              <div class="text-xl">⟠</div>
              <div class="flex-1">
                <div class="text-xs text-base-content/60 mb-1 font-semibold">ETHEREUM SEPOLIA</div>
                <div class="font-mono text-sm break-all">{masterWallet.ethAddress || 'N/A'}</div>
              </div>
              <button 
                class="btn btn-ghost btn-xs"
                onclick={() => {
                  navigator.clipboard.writeText(masterWallet.ethAddress);
                }}
                title="Copy address"
              >
                📋
              </button>
            </div>

            <!-- Avalanche Address -->
            <div class="flex items-start gap-3 p-4 rounded-lg bg-base-200/50 border border-accent/20">
              <div class="text-xl">▲</div>
              <div class="flex-1">
                <div class="text-xs text-base-content/60 mb-1 font-semibold">AVALANCHE FUJI</div>
                <div class="font-mono text-sm break-all">{masterWallet.avaxAddress || 'N/A'}</div>
              </div>
              <button 
                class="btn btn-ghost btn-xs"
                onclick={() => {
                  navigator.clipboard.writeText(masterWallet.avaxAddress);
                }}
                title="Copy address"
              >
                📋
              </button>
            </div>
          </div>
        {:else}
          <div class="alert alert-info">
            <Wallet size={18} />
            <div>
              <div class="font-semibold">No wallet generated yet</div>
              <div class="text-sm">Generate a wallet to get started with blockchain features</div>
            </div>
          </div>
        {/if}

        <!-- Investment Focus (if investor) -->
        {#if user.role === 'investor' && user.investmentFocus}
          <div class="divider"></div>
          <div>
            <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
              <Globe size={18} class="text-accent" />
              Investment Focus
            </h3>
            <p class="text-base-content/80 leading-relaxed">{user.investmentFocus}</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Companies Section -->
    <CompanyManager 
      bind:companies={companies} 
      onUpdate={fetchMyCompanies}
      refreshWalletTrigger={walletRefreshTrigger}
    />

    <!-- Investor Upgrade Section (only show for regular users) -->
    {#if user.role === 'user'}
      <div class="card bg-gradient-to-br from-accent/10 to-primary/10 shadow-lg border border-accent/20">
        <div class="card-body">
          <div class="flex items-start gap-4 mb-4">
            <div class="p-3 rounded-lg bg-accent/20">
              <ArrowUpCircle size={32} class="text-accent" />
            </div>
            <div>
              <h3 class="text-2xl font-bold mb-2">Upgrade to Investor Account</h3>
              <p class="text-base-content/70 leading-relaxed">
                Are you an investor or VC? Upgrade your account to access investor-specific features and connect with founders.
              </p>
            </div>
          </div>
          
          {#if !showInvestorForm}
            <button
              class="btn btn-accent btn-lg gap-2"
              onclick={toggleInvestorForm}
              disabled={upgradeSuccess}
            >
              <Briefcase size={20} />
              Become an Investor
            </button>
          {/if}

          {#if showInvestorForm}
            <div class="divider"></div>
            <form onsubmit={(e) => { e.preventDefault(); handleUpgradeToInvestor(); }} class="space-y-4">
              <div>
                <label class="label" for="company">
                  <span class="label-text font-semibold">Company/Fund Name *</span>
                </label>
                <input
                  type="text"
                  id="company"
                  bind:value={company}
                  class="input input-bordered w-full"
                  placeholder="e.g., Acme Ventures"
                  required
                  disabled={isUpgrading}
                />
              </div>
              
              <div>
                <label class="label" for="investmentFocus">
                  <span class="label-text font-semibold">Investment Focus *</span>
                </label>
                <textarea
                  id="investmentFocus"
                  bind:value={investmentFocus}
                  class="textarea textarea-bordered w-full"
                  placeholder="Describe your investment thesis, sectors of interest, stage preferences..."
                  rows="4"
                  required
                  disabled={isUpgrading}
                ></textarea>
              </div>
              
              <div>
                <label class="label" for="linkedinUrl">
                  <span class="label-text font-semibold">LinkedIn Profile URL</span>
                </label>
                <input
                  type="url"
                  id="linkedinUrl"
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
                    class="checkbox checkbox-accent"
                    disabled={isUpgrading}
                  />
                  <span class="label-text font-semibold">I am an accredited investor</span>
                </label>
              </div>

              {#if upgradeError}
                <div class="alert alert-error">
                  <span>{upgradeError}</span>
                </div>
              {/if}

              {#if upgradeSuccess}
                <div class="alert alert-success">
                  <CheckCircle size={20} />
                  <span>Successfully upgraded to investor! Redirecting to dashboard...</span>
                </div>
              {/if}

              <div class="flex gap-3">
                <button
                  type="submit"
                  class="btn btn-accent flex-1"
                  disabled={isUpgrading || upgradeSuccess}
                >
                  {#if isUpgrading}
                    <span class="loading loading-spinner loading-sm"></span>
                    Upgrading...
                  {:else}
                    <Briefcase size={18} />
                    Complete Upgrade
                  {/if}
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
      </div>
    {/if}
  {:else}
    <!-- Error State -->
    <div class="card bg-base-100 shadow-lg">
      <div class="card-body">
        <div class="alert alert-warning">
          <span>Unable to load profile data. Please try logging in again.</span>
        </div>
        <button class="btn btn-primary mt-4" onclick={() => goto('/auth')}>
          Go to Login
        </button>
      </div>
    </div>
  {/if}
</div>