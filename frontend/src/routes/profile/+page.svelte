<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { User, Mail, Briefcase, Building, Globe, Linkedin, CheckCircle, ArrowUpCircle, ArrowLeft, Camera, Wallet, ChevronDown, ChevronRight } from 'lucide-svelte';
  import GenerateWalletModal from '$lib/components/GenerateWalletModal.svelte';
  import RestoreWalletModal from '$lib/components/RestoreWalletModal.svelte';
  import UsdcWalletManager from '$lib/components/UsdcWalletManager.svelte';
  import CompanyManager from '$lib/components/CompanyManager.svelte';
  import { toastStore } from '$lib/stores/toast';

  let user: any = $state(null);
  let isLoading = $state(true);
  let showInvestorForm = $state(false);
  let isUpgrading = $state(false);
  let upgradeError = $state('');
  let upgradeSuccess = $state(false);
  let showGenerateWalletModal = $state(false);
  let showRestoreWalletModal = $state(false);
  let companies = $state<any[]>([]);
  let contributions = $state<any[]>([]);
  let walletRefreshTrigger = $state(0);

  // Master wallet state
  let masterWallet = $state<any>(null);
  let loadingWallet = $state(false);

  // control whether address list is shown
  let masterWalletExpanded = $state(true);
  let masterBalances = $state<{ [chain: string]: string }>({});


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
      // Fetch companies and contributions after verification
      fetchMyCompanies();
      fetchMyContributions();
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

        // After loading companies, fetch payments for each to mark pending/deployed items
        for (const comp of companies) {
          if (!comp.id) continue;
          try {
            const payRes = await fetch(`${PUBLIC_API_URL}/payments/company/${comp.id}`);
            const payData = await payRes.json();
            if (payData.success && Array.isArray(payData.data)) {
              const map: Record<string, any[]> = {};
              for (const p of payData.data) {
                if (!map[p.wishlistItemId]) map[p.wishlistItemId] = [];
                map[p.wishlistItemId].push(p);
              }
              if (comp.wishlistItems) {
                for (const item of comp.wishlistItems) {
                  const payments = map[item.id] || [];
                  // mark if a confirmed payment exists (pending deployment)
                  item.hasConfirmedPayment = payments.some((p) => p.status === 'confirmed');
                  // also flag escrow active if deployed contracts exist
                  item.isEscrowActive = payments.some(
                    (p) => p.status === 'deployed' && p.deployedContracts,
                  );
                }
              }
            }
          } catch (e) {
            console.error('Failed to fetch payments for company', comp.id, e);
          }
        }

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

  async function fetchMyContributions() {
    try {
      const token = $authStore.accessToken;
      if (!token) return;
      const resp = await fetch(`${PUBLIC_API_URL}/bounties/contributions/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (data.success) {
        contributions = data.data;
      }
    } catch (err) {
      console.error('Failed to fetch contributions:', err);
    }
  }

  async function fetchMasterBalances() {
    if (!masterWallet) return;
    const toFetch: Array<{ addr?: string; chain: string }> = [
      { addr: masterWallet.ethAddress, chain: 'ethereum' },
      { addr: masterWallet.avaxAddress, chain: 'avalanche' },
      { addr: masterWallet.solanaAddress, chain: 'solana' },
      { addr: masterWallet.stellarAddress, chain: 'stellar' },
      { addr: masterWallet.bitcoinAddress, chain: 'bitcoin' },
    ];

    masterBalances = {};
    await Promise.all(
      toFetch.map(async ({ addr, chain }) => {
        if (!addr) return;
        try {
          const resp = await fetch(`${PUBLIC_API_URL}/wallet-balance?address=${addr}&chain=${chain}`);
          const data = await resp.json();
          if (data.balanceEth !== undefined) {
            masterBalances[chain] = `${parseFloat(data.balanceEth).toFixed(6)} ETH`;
          } else if (data.balanceAvax !== undefined) {
            masterBalances[chain] = `${parseFloat(data.balanceAvax).toFixed(6)} AVAX`;
          } else if (data.balanceSol !== undefined) {
            masterBalances[chain] = `${parseFloat(data.balanceSol).toFixed(6)} SOL`;
          } else if (data.balanceXlm !== undefined) {
            masterBalances[chain] = `${parseFloat(data.balanceXlm).toFixed(6)} XLM`;
          } else if (data.balanceBtc !== undefined) {
            masterBalances[chain] = `${parseFloat(data.balanceBtc).toFixed(8)} BTC`;
          }
        } catch (err) {
          console.error(`Failed to fetch balance for ${chain}:`, err);
        }
      })
    );
  }

  // Fetch master wallet when user changes
  $effect(() => {
    if (user && $authStore.accessToken) {
      fetchMasterWallet();
    }
  });

  // whenever master wallet is visible and section expanded, fetch balances
  $effect(() => {
    if (masterWallet && masterWalletExpanded) {
      fetchMasterBalances();
    }
  });

  // when contributions list is loaded we could trigger other things
  $effect(() => {
    // no-op for now, placeholder if we need reactivity later
    contributions;
  });


  let usdcHint = $state<string | null>(null);

  function handleWalletGenerated(data?: any) {
    // Increment trigger to refresh wallet status in CompanyManager
    walletRefreshTrigger++;
    // Fetch the master wallet to display addresses
    fetchMasterWallet();
    // Fetch companies to display newly generated wallet addresses
    fetchMyCompanies();

    // If wallet data is provided, show a transient hint and toast
    if (data && data.ethAddress) {
      usdcHint = `Your USDC wallet has been set to: ${data.ethAddress}`;
      toastStore.add({ message: `✅ ${usdcHint}`, type: 'success', ttl: 8000 });
      // Clear hint after 12 seconds
      setTimeout(() => usdcHint = null, 12000);
    }
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
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        // notify profile page to refresh user object
        authStore.verify();
      } else {
        uploadError = data.message || 'Upload failed';
      }
    } catch (error: any) {
      uploadError = error.message || 'Failed to upload image';
    } finally {
      isUploading = false;
      if (fileInput) fileInput.value = '';
    }
  }

  // helper to format contribution entries
  function formatContrib(c: any) {
    if (c.amountEth) return `${parseFloat(c.amountEth).toFixed(4)} ETH`;
    if (c.nativeAmount && c.currencySymbol) return `${parseFloat(c.nativeAmount).toFixed(4)} ${c.currencySymbol}`;
    if (c.amountEur) return `€${parseFloat(c.amountEur).toFixed(2)}`;
    return '-';
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
    Back
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
          <div class="flex items-center gap-2">
            <Wallet size={18} class="text-primary" />
            <h3 class="text-lg font-semibold mb-1">Master Wallet</h3>
            {#if masterWallet}
              <button
                class="btn btn-ghost btn-xs"
                onclick={() => (masterWalletExpanded = !masterWalletExpanded)}
                aria-label={masterWalletExpanded ? 'Collapse' : 'Expand'}
              >
                {#if masterWalletExpanded}
                  <ChevronDown size={16} />
                {:else}
                  <ChevronRight size={16} />
                {/if}
              </button>
            {/if}
            <p class="text-sm text-base-content/70 ml-4">Your blockchain wallet addresses</p>
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

        <!-- Wallet Type Info -->
        {#if masterWallet}
          <div class="alert alert-info mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <div class="text-sm">
              <p class="font-semibold mb-1">About Your Wallet</p>
              <p>
                When you create companies, each one receives a unique child wallet derived from this master wallet. 
                Company wallets are used to receive contributions on blockchain bounties.
              </p>
            </div>
          </div>
        {/if}

        <!-- Master Wallet Display -->
        {#if loadingWallet}
          <div class="space-y-2">
            <div class="h-12 skeleton"></div>
            <div class="h-12 skeleton"></div>
          </div>
        {:else if masterWallet && masterWalletExpanded}
          <div class="space-y-3">
            <!-- Ethereum Address -->
            <div class="flex items-start gap-3 p-4 rounded-lg bg-base-200/50 border border-primary/20">
              <div class="text-xl">⟠</div>
              <div class="flex-1">
                <div class="text-xs text-base-content/60 mb-1 font-semibold">ETHEREUM SEPOLIA</div>
                <div class="font-mono text-sm break-all">{masterWallet.ethAddress || 'N/A'}</div>
                {#if masterBalances.ethereum}
                  <div class="text-xs opacity-60 mt-1">Balance: {masterBalances.ethereum}</div>
                {/if}
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
                {#if masterBalances.avalanche}
                  <div class="text-xs opacity-60 mt-1">Balance: {masterBalances.avalanche}</div>
                {/if}
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

            <!-- Solana Address -->
            <div class="flex items-start gap-3 p-4 rounded-lg bg-base-200/50 border border-secondary/20">
              <div class="text-xl">◎</div>
              <div class="flex-1">
                <div class="text-xs text-base-content/60 mb-1 font-semibold">SOLANA</div>
                <div class="font-mono text-sm break-all">{masterWallet.solanaAddress || 'N/A'}</div>
                {#if masterBalances.solana}
                  <div class="text-xs opacity-60 mt-1">Balance: {masterBalances.solana}</div>
                {/if}
              </div>
              <button 
                class="btn btn-ghost btn-xs"
                onclick={() => {
                  navigator.clipboard.writeText(masterWallet.solanaAddress || '');
                }}
                title="Copy address"
              >
                📋
              </button>
            </div>

            <!-- Stellar Address -->
            <div class="flex items-start gap-3 p-4 rounded-lg bg-base-200/50 border border-accent/20">
              <div class="text-xl">✧</div>
              <div class="flex-1">
                <div class="text-xs text-base-content/60 mb-1 font-semibold">STELLAR</div>
                <div class="font-mono text-sm break-all">{masterWallet.stellarAddress || 'N/A'}</div>
                {#if masterBalances.stellar}
                  <div class="text-xs opacity-60 mt-1">Balance: {masterBalances.stellar}</div>
                {/if}
              </div>
              <button 
                class="btn btn-ghost btn-xs"
                onclick={() => {
                  navigator.clipboard.writeText(masterWallet.stellarAddress || '');
                }}
                title="Copy address"
              >
                📋
              </button>
            </div>

            <!-- Bitcoin Address -->
            <div class="flex items-start gap-3 p-4 rounded-lg bg-base-200/50 border border-warning/20">
              <div class="text-xl">₿</div>
              <div class="flex-1">
                <div class="text-xs text-base-content/60 mb-1 font-semibold">BITCOIN</div>
                <div class="font-mono text-sm break-all">{masterWallet.bitcoinAddress || 'N/A'}</div>
                {#if masterBalances.bitcoin}
                  <div class="text-xs opacity-60 mt-1">Balance: {masterBalances.bitcoin}</div>
                {/if}
              </div>
              <button 
                class="btn btn-ghost btn-xs"
                onclick={() => {
                  navigator.clipboard.writeText(masterWallet.bitcoinAddress || '');
                }}
                title="Copy address"
              >
                📋
              </button>
            </div>
          </div>
        {:else if masterWallet && !masterWalletExpanded}
          <!-- wallet exists but section is collapsed; show nothing -->
        {:else if !masterWallet}
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

    <!-- USDC Wallet Manager -->
    {#if usdcHint}
      <div class="alert alert-success mb-4">
        <div class="flex-1">
          <p class="font-semibold">{usdcHint}</p>
          <p class="text-xs opacity-70">You can manage your USDC wallet below or copy the address to your clipboard.</p>
        </div>
        <button class="btn btn-ghost btn-xs" onclick={() => { if (usdcHint) navigator.clipboard.writeText(usdcHint.split(':').pop()?.trim() || ''); }} title="Copy">
          📋
        </button>
      </div>
    {/if}

    <UsdcWalletManager 
      masterWallet={masterWallet}
    />

    <!-- Companies Section -->
    <CompanyManager 
      bind:companies={companies} 
      onUpdate={fetchMyCompanies}
      refreshWalletTrigger={walletRefreshTrigger}
      masterWallet={masterWallet}
    />

    <!-- Contributions history -->
    <div class="mt-10">
      <div class="card bg-base-100 shadow-lg border border-base-300">
        <div class="card-body">
          <h3 class="text-lg font-semibold mb-1 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Contribution History
            {#if contributions.length > 0}
              <span class="badge badge-primary badge-sm">{contributions.length}</span>
            {/if}
          </h3>
          <p class="text-sm text-base-content/60 mb-4">A record of every bounty contribution linked to your account or wallet addresses.</p>

          {#if contributions.length === 0}
            <div class="flex flex-col items-center justify-center py-10 text-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-base-content/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg>
              <p class="text-base-content/50 text-sm">No contributions yet.<br/>Visit a company page to contribute to a bounty.</p>
              <a href="/companies" class="btn btn-sm btn-outline btn-primary mt-1">Browse Companies</a>
            </div>
          {:else}
            <div class="flex flex-col gap-3">
              {#each contributions as c}
                {@const explorerBase =
                  c.chain === 'ethereum' ? 'https://sepolia.etherscan.io' :
                  c.chain === 'avalanche' ? 'https://testnet.snowtrace.io' :
                  c.chain === 'solana' ? 'https://explorer.solana.com' :
                  c.chain === 'stellar' ? 'https://stellar.expert/explorer/testnet' :
                  c.chain === 'bitcoin' ? 'https://mempool.space/testnet' : null}
                {@const txUrl = c.transactionHash && explorerBase
                  ? (c.chain === 'solana'
                      ? `${explorerBase}/tx/${c.transactionHash}?cluster=devnet`
                      : `${explorerBase}/tx/${c.transactionHash}`)
                  : null}
                {@const chainLabel =
                  c.chain === 'ethereum' ? 'ETH Sepolia' :
                  c.chain === 'avalanche' ? 'AVAX Fuji' :
                  c.chain === 'solana' ? 'Solana' :
                  c.chain === 'stellar' ? 'Stellar' :
                  c.chain === 'bitcoin' ? 'Bitcoin' : (c.chain ?? '').toUpperCase()}
                {@const chainColor =
                  c.chain === 'ethereum' ? 'badge-info' :
                  c.chain === 'avalanche' ? 'badge-error' :
                  c.chain === 'solana' ? 'badge-secondary' :
                  c.chain === 'stellar' ? 'badge-accent' :
                  c.chain === 'bitcoin' ? 'badge-warning' : 'badge-ghost'}

                <div class="flex flex-col sm:flex-row sm:items-start gap-3 p-4 rounded-xl bg-base-200/50 border border-base-300/60 hover:border-primary/30 transition-colors">
                  <!-- Chain badge column -->
                  <div class="flex sm:flex-col items-center gap-2 sm:gap-1 sm:min-w-[80px]">
                    <span class="badge {chainColor} badge-sm font-mono">{chainLabel}</span>
                    <span class="text-xs text-base-content/50">{new Date(c.contributedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                  </div>

                  <!-- Main info -->
                  <div class="flex-1 min-w-0">
                    <!-- Bounty title -->
                    <div class="font-semibold text-sm mb-0.5">
                      {#if c.wishlistItem}
                        <a href="/bounties/{c.wishlistItem.id}" class="link link-hover link-primary">
                          {c.wishlistItem.title}
                        </a>
                        {#if c.wishlistItem.company?.name}
                          <span class="text-base-content/50 font-normal text-xs"> — {c.wishlistItem.company.name}</span>
                        {/if}
                      {:else}
                        <span class="text-base-content/40 italic">Bounty unavailable</span>
                      {/if}
                    </div>

                    <!-- Amounts -->
                    <div class="flex flex-wrap items-center gap-2 mt-1">
                      <span class="text-base font-bold text-success">{formatContrib(c)}</span>
                      {#if c.amountEur && !(c.chain === 'ethereum' || c.chain === 'avalanche')}
                        <span class="text-xs text-base-content/50">≈ €{parseFloat(c.amountEur).toFixed(2)}</span>
                      {/if}
                      {#if c.amountUsd}
                        <span class="text-xs text-base-content/40">/ ${parseFloat(c.amountUsd).toFixed(2)}</span>
                      {/if}
                    </div>

                    <!-- Tx hash -->
                    {#if c.transactionHash}
                      <div class="flex items-center gap-1 mt-1">
                        <span class="text-xs text-base-content/50">Tx:</span>
                        {#if txUrl}
                          <a href={txUrl} target="_blank" rel="noopener noreferrer"
                             class="font-mono text-xs text-primary link link-hover truncate max-w-[180px] sm:max-w-xs">
                            {c.transactionHash.slice(0, 10)}…{c.transactionHash.slice(-6)}
                          </a>
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-primary/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                        {:else}
                          <span class="font-mono text-xs text-base-content/50 truncate max-w-[180px]">
                            {c.transactionHash.slice(0, 10)}…{c.transactionHash.slice(-6)}
                          </span>
                        {/if}
                      </div>
                    {/if}

                    <!-- Contract / recipient address -->
                    {#if c.contractAddress}
                      <div class="flex items-center gap-1 mt-0.5">
                        <span class="text-xs text-base-content/40">Contract:</span>
                        <span class="font-mono text-xs text-base-content/50">
                          {c.contractAddress.slice(0, 8)}…{c.contractAddress.slice(-6)}
                        </span>
                      </div>
                    {/if}
                  </div>

                  <!-- Status badge -->
                  <div class="flex sm:flex-col items-center gap-1">
                    {#if c.isRefunded}
                      <span class="badge badge-warning badge-sm">Refunded</span>
                      {#if c.refundedAt}
                        <span class="text-xs text-base-content/40">{new Date(c.refundedAt).toLocaleDateString()}</span>
                      {/if}
                    {:else}
                      <span class="badge badge-success badge-sm">Confirmed</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Investor Upgrade Section (only show for regular users) -->
    {#if user.role === 'user'}
      <div class="card bg-gradient-to-br from-accent/10 to-primary/10 shadow-lg border border-accent/20 mt-10">
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