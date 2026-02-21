<script lang="ts">
  import { onMount } from 'svelte';
  import { Building2, Plus, Edit, Trash2, Globe, Linkedin, Twitter, X, Target, Wallet, AlertCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { authStore } from '$lib/stores/auth';
  import { toastStore } from '$lib/stores/toast';
  import WishlistForm from './WishlistForm.svelte';
  import CreateBountyModal from './CreateBountyModal.svelte';
  import CreateBountyModalX402 from './CreateBountyModalX402.svelte';

  interface Company {
    id: string;
    name: string;
    description: string;
    industry?: string;
    website?: string;
    employeeCount?: number;
    stage?: string;
    fundingStage?: string;
    location?: string;
    foundedDate?: string;
    logoUrl?: string;
    linkedinUrl?: string;
    twitterUrl?: string;
    ethAddress?: string;
    avaxAddress?: string;
    tags?: string[];
    isPublic: boolean;
    wishlistItems?: any[];
  }

  let { 
    companies = $bindable([]), 
    onUpdate = () => {},
    refreshWalletTrigger = 0,
    masterWallet = null
  }: { 
    companies: Company[], 
    onUpdate: () => void,
    refreshWalletTrigger?: number,
    masterWallet?: any
  } = $props();

  let showForm = $state(false);
  let editingCompany = $state<Company | null>(null);
  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);
  let hasWallet = $state<boolean | null>(null);
  let isCheckingWallet = $state(false);
  let walletAddresses = $state<{ eth: string; avax: string } | null>(null);
  let expandedWishlistId = $state<string | null>(null);
  let bountyModalOpen = $state(false);
  let bountyModalX402Open = $state(false);
  let selectedWishlistItem = $state<any | null>(null);
  let selectedCompany = $state<Company | null>(null);
  
  // Newly created company state - for showing child address with reveal
  let newlyCreatedCompany = $state<Company | null>(null);
  let revealedAddresses = $state<{ [key: string]: boolean }>({});
  
  // Delete confirmation modal state
  let showDeleteModal = $state(false);
  let deleteConfirmationText = $state('');
  let itemToDelete = $state<{ companyId: string; itemId: string; itemTitle: string; hasEscrow: boolean } | null>(null);
  let isDeleting = $state(false);
  
  // Company delete confirmation modal state
  let showCompanyDeleteModal = $state(false);
  let companyDeleteConfirmationText = $state('');
  let companyToDelete = $state<{ id: string; name: string } | null>(null);
  let isDeletingCompany = $state(false);
  
  // Form fields
  let name = $state('');
  let description = $state('');
  let industry = $state('');
  let website = $state('');
  let employeeCount = $state<number>(1);
  let stage = $state('idea');
  let fundingStage = $state('bootstrapped');
  let location = $state('');
  let foundedDate = $state('');
  let linkedinUrl = $state('');
  let twitterUrl = $state('');
  let ethAddress = $state('');
  let avaxAddress = $state('');
  let tagsInput = $state('');
  let isPublic = $state(true);

  const stageOptions = [
    { value: 'idea', label: 'Idea' },
    { value: 'mvp', label: 'MVP' },
    { value: 'early_stage', label: 'Early Stage' },
    { value: 'growth', label: 'Growth' },
    { value: 'scale', label: 'Scale' },
    { value: 'established', label: 'Established' }
  ];

  const fundingOptions = [
    { value: 'bootstrapped', label: 'Bootstrapped' },
    { value: 'pre_seed', label: 'Pre-Seed' },
    { value: 'seed', label: 'Seed' },
    { value: 'series_a', label: 'Series A' },
    { value: 'series_b', label: 'Series B' },
    { value: 'series_c_plus', label: 'Series C+' }
  ];

  const industries = [
    'Technology', 'Healthcare', 'Finance', 'Education', 'E-commerce',
    'SaaS', 'AI/ML', 'Blockchain', 'Consumer', 'B2B', 'Energy',
    'Real Estate', 'Media', 'Agriculture', 'Transportation', 'Other'
  ];

  onMount(() => {
    checkUserWallet();
  });

  // Re-check wallet when trigger changes
  $effect(() => {
    if (refreshWalletTrigger > 0) {
      checkUserWallet();
    }
  });

  async function checkUserWallet() {
    isCheckingWallet = true;
    try {
      // Verify authentication first
      const verified = await authStore.verify();
      if (!verified) return;

      const token = $authStore.accessToken;
      if (!token) return;

      const response = await fetch(`${PUBLIC_API_URL}/wallet/check`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        hasWallet = result.data.hasWallet;
        
        // If user has wallet, fetch addresses for display
        if (hasWallet) {
          const addrResponse = await fetch(`${PUBLIC_API_URL}/wallet/addresses`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const addrResult = await addrResponse.json();
          if (addrResult.success) {
            walletAddresses = {
              eth: addrResult.data.ethAddress,
              avax: addrResult.data.avaxAddress
            };
          }
        }
      }
    } catch (err) {
      console.error('Failed to check wallet:', err);
    } finally {
      isCheckingWallet = false;
    }
  }

  function openForm(company: Company | null = null) {
    // Check wallet requirement for new companies
    if (!company && hasWallet === false) {
      errorMessage = 'Please generate a master wallet before registering a company. Scroll down to the wallet section.';
      return;
    }

    editingCompany = company;
    if (company) {
      // Populate form with existing company data
      name = company.name;
      description = company.description;
      industry = company.industry || '';
      website = company.website || '';
      employeeCount = company.employeeCount || 1;
      stage = company.stage || 'idea';
      fundingStage = company.fundingStage || 'bootstrapped';
      location = company.location || '';
      foundedDate = company.foundedDate || '';
      linkedinUrl = company.linkedinUrl || '';
      twitterUrl = company.twitterUrl || '';
      ethAddress = company.ethAddress || '';
      avaxAddress = company.avaxAddress || '';
      tagsInput = company.tags?.join(', ') || '';
      isPublic = company.isPublic ?? true;
    } else {
      // Reset form
      resetForm();
    }
    showForm = true;
    errorMessage = null;
  }

  function resetForm() {
    name = '';
    description = '';
    industry = '';
    website = '';
    employeeCount = 1;
    stage = 'idea';
    fundingStage = 'bootstrapped';
    location = '';
    foundedDate = '';
    linkedinUrl = '';
    twitterUrl = '';
    ethAddress = '';
    avaxAddress = '';
    tagsInput = '';
    isPublic = true;
  }

  function closeForm() {
    showForm = false;
    editingCompany = null;
    errorMessage = null;
    resetForm();
  }

  function toggleWishlist(companyId: string) {
    expandedWishlistId = expandedWishlistId === companyId ? null : companyId;
  }

  function handleWishlistItemAdded(deployed?: any) {
    // If we got deployed addresses from the form, update the local list immediately
    if (deployed) {
      // deployed is an array of {chain, address}
      // find the wishlist item and attach addresses
      // For simplicity, refresh the companies to get canonical state, then merge in addresses
      onUpdate();
    } else {
      // Refresh companies to show updated wishlist
      onUpdate();
    }
  }

  function openBountyModal(item: any, company: Company) {
    selectedWishlistItem = item;
    selectedCompany = company;
    bountyModalOpen = true;
  }

  function openBountyModalX402(item: any, company: Company) {
    selectedWishlistItem = item;
    selectedCompany = company;
    bountyModalX402Open = true;
  }

  function handleBountySuccess(deployed?: any) {
    bountyModalOpen = false;
    bountyModalX402Open = false;
    // If deployed addresses provided, update local companies state immediately to avoid 'deploying' UI
    if (deployed && selectedCompany && selectedWishlistItem) {
      const companyIndex = companies.findIndex((c) => c.id === selectedCompany.id);
      if (companyIndex !== -1) {
        const itemIndex = companies[companyIndex].wishlistItems?.findIndex((w) => w.id === selectedWishlistItem.id);
        if (typeof itemIndex === 'number' && itemIndex !== -1) {
          const item = companies[companyIndex].wishlistItems[itemIndex];
          if (deployed.ethereumAddress) item.ethereumEscrowAddress = deployed.ethereumAddress;
          if (deployed.avalancheAddress) item.avalancheEscrowAddress = deployed.avalancheAddress;
          item.isEscrowActive = true;
          // push a deployment history entry for immediate visibility
          item.deployments = item.deployments || [];
          // Push per-chain deployments where txHash is available
          deployed.addresses.forEach((a) => {
            item.deployments.unshift({
              chain: a.chain,
              network: a.chain === 'ethereum' ? 'sepolia' : 'fuji',
              deploymentTxHash: a.txHash || null,
              deployedAt: new Date().toISOString(),
              campaignName: deployed.campaignName || selectedWishlistItem.title || null,
              campaignDescription: deployed.campaignDescription || selectedWishlistItem.description || null,
            });
          });
          // force Svelte reactivity
          companies = [...companies];
        }
      }
    }

    selectedWishlistItem = null;
    selectedCompany = null;

    // Refresh companies to show updated bounty status
    onUpdate();
  }

  /**
   * Truncate Ethereum address to show first 6 and last 4 characters
   * Example: 0x1234567890abcdef... -> 0x1234...cdef
   */
  function truncateAddress(address: string): string {
    if (!address || address.length < 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Toggle reveal state for a given address
   */
  function toggleReveal(key: string) {
    revealedAddresses[key] = !revealedAddresses[key];
  }

  /**
   * Show address - either truncated or full based on reveal state
   */
  function displayAddress(address: string, key: string): string {
    if (revealedAddresses[key]) {
      return address;
    }
    return truncateAddress(address);
  }

  async function handleSubmit() {
    if (!name || !description) {
      errorMessage = 'Name and description are required';
      return;
    }

    isSubmitting = true;
    errorMessage = null;

    try {
      const token = $authStore.accessToken;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const companyData = {
        name,
        description,
        industry: industry || undefined,
        website: website || undefined,
        employeeCount: employeeCount || undefined,
        stage,
        fundingStage,
        location: location || undefined,
        foundedDate: foundedDate || undefined,
        linkedinUrl: linkedinUrl || undefined,
        twitterUrl: twitterUrl || undefined,
        ethAddress: ethAddress || undefined,
        avaxAddress: avaxAddress || undefined,
        tags: tags.length > 0 ? tags : undefined,
        isPublic
      };

      const url = editingCompany
        ? `${PUBLIC_API_URL}/companies/${editingCompany.id}`
        : `${PUBLIC_API_URL}/companies`;
      
      const method = editingCompany ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(companyData)
      });

      const result = await response.json();

      if (result.success) {
        // For newly created companies, capture the company data to show address reveal/status
        if (!editingCompany && result.data) {
          newlyCreatedCompany = result.data;
          revealedAddresses = {}; // Reset reveal state
          // Show modal and keep form open - closeForm will be called when user dismisses modal
          console.log('[CompanyCreation] Company created:', result.data.id, 'ETH:', result.data.ethAddress, 'AVAX:', result.data.avaxAddress);
          // Refresh companies list
          onUpdate();
        } else {
          // For edits, close form immediately and refresh
          closeForm();
          onUpdate();
        }
      } else {
        errorMessage = result.message || 'Failed to save company';
      }
    } catch (err: any) {
      errorMessage = err.message || 'An error occurred';
    } finally {
      isSubmitting = false;
    }
  }

  async function deleteCompany(companyId: string, companyName: string) {
    openCompanyDeleteModal(companyId, companyName);
  }

  function openCompanyDeleteModal(companyId: string, companyName: string) {
    companyToDelete = { id: companyId, name: companyName };
    companyDeleteConfirmationText = '';
    showCompanyDeleteModal = true;
  }

  async function confirmDeleteCompany() {
    if (!companyToDelete) return;
    
    if (companyDeleteConfirmationText !== 'delete') {
      toastStore.add({ message: 'Please type "delete" to confirm', type: 'error' });
      return;
    }

    isDeletingCompany = true;

    try {
      const token = $authStore.accessToken;
      if (!token) {
        toastStore.add({ message: 'Not authenticated', type: 'error' });
        return;
      }

      const response = await fetch(`${PUBLIC_API_URL}/companies/${companyToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        toastStore.add({ message: 'Company deleted successfully', type: 'success' });
        showCompanyDeleteModal = false;
        companyDeleteConfirmationText = '';
        companyToDelete = null;
        onUpdate(); // Refresh the company list
      } else {
        toastStore.add({ message: result.message || 'Failed to delete company', type: 'error' });
      }
    } catch (err: any) {
      toastStore.add({ message: err.message || 'An error occurred while deleting', type: 'error' });
    } finally {
      isDeletingCompany = false;
    }
  }

  function cancelCompanyDeleteModal() {
    showCompanyDeleteModal = false;
    companyDeleteConfirmationText = '';
    companyToDelete = null;
  }

  function openDeleteModal(companyId: string, itemId: string, itemTitle: string, hasEscrow: boolean) {
    itemToDelete = { companyId, itemId, itemTitle, hasEscrow };
    deleteConfirmationText = '';
    showDeleteModal = true;
  }

  async function confirmDeleteWishlistItem() {
    if (!itemToDelete) return;
    
    if (deleteConfirmationText !== 'delete') {
      toastStore.add({ message: 'Please type "delete" to confirm', type: 'error' });
      return;
    }

    isDeleting = true;

    try {
      const token = $authStore.accessToken;
      if (!token) return;

      const response = await fetch(`${PUBLIC_API_URL}/companies/${itemToDelete.companyId}/wishlist/${itemToDelete.itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        toastStore.add({ message: 'Wishlist item deleted successfully', type: 'success' });
        showDeleteModal = false;
        deleteConfirmationText = '';
        itemToDelete = null;
        onUpdate(); // Refresh the company list
      } else {
        toastStore.add({ message: result.message || 'Failed to delete wishlist item', type: 'error' });
      }
    } catch (err: any) {
      toastStore.add({ message: err.message || 'An error occurred while deleting', type: 'error' });
    } finally {
      isDeleting = false;
    }
  }

  function cancelDeleteModal() {
    showDeleteModal = false;
    deleteConfirmationText = '';
    itemToDelete = null;
  }

  async function deleteWishlistItem(companyId: string, itemId: string, itemTitle: string, hasEscrow: boolean) {
    openDeleteModal(companyId, itemId, itemTitle, hasEscrow);
  }

</script>

<div class="glass-subtle rounded-3xl p-6 md:p-8">
  <div class="flex items-center justify-between mb-6">
    <div class="flex items-center gap-3">
      <Building2 class="w-6 h-6 text-primary" />
      <h2 class="text-2xl font-bold">My Companies</h2>
    </div>
    
    {#if !showForm}
      {#if hasWallet === false}
        <div class="flex items-center gap-2 text-warning">
          <AlertCircle class="w-5 h-5" />
          <span class="text-sm">Generate wallet to register companies</span>
        </div>
      {:else}
        <button 
          class="btn btn-primary" 
          onclick={() => openForm()}
          disabled={isCheckingWallet}
        >
          <Plus class="w-5 h-5" />
          Register Company
        </button>
      {/if}
    {/if}
  </div>

  {#if showForm}
    <div class="glass-subtle rounded-2xl p-6 mb-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-xl font-bold">
          {editingCompany ? 'Edit Company' : 'Register New Company'}
        </h3>
        <button class="btn btn-ghost btn-sm" onclick={closeForm}>
          <X class="w-5 h-5" />
        </button>
      </div>

      {#if errorMessage}
        <div class="alert alert-error mb-6">
          <span>{errorMessage}</span>
        </div>
      {/if}

      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-6">
        <!-- Basic Information Section -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold opacity-80 mb-4">Basic Information</h3>
          
          <div class="form-control">
            <label class="label" for="company-name">
              <span class="label-text font-medium">Company Name <span class="text-error">*</span></span>
            </label>
            <input 
              type="text"
              id="company-name"
              class="input input-bordered w-full"
              placeholder="Enter your company name"
              bind:value={name}
              required
            />
          </div>

          <div class="form-control">
            <label class="label" for="company-description">
              <span class="label-text font-medium">Description <span class="text-error">*</span></span>
            </label>
            <textarea 
              id="company-description"
              class="textarea textarea-bordered w-full h-32"
              placeholder="Describe what your company does..."
              bind:value={description}
              required
            ></textarea>
          </div>

          <div class="form-control">
            <label class="label" for="company-industry">
              <span class="label-text font-medium">Industry</span>
            </label>
            <select 
              id="company-industry"
              class="select select-bordered w-full"
              bind:value={industry}
            >
              <option value="">Select Industry</option>
              {#each industries as ind}
                <option value={ind}>{ind}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Stage & Funding Section -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold opacity-80 mb-4">Stage & Funding</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label" for="company-stage">
                <span class="label-text font-medium">Company Stage</span>
              </label>
              <select 
                id="company-stage"
                class="select select-bordered w-full"
                bind:value={stage}
              >
                {#each stageOptions as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </div>

            <div class="form-control">
              <label class="label" for="company-funding">
                <span class="label-text font-medium">Funding Stage</span>
              </label>
              <select 
                id="company-funding"
                class="select select-bordered w-full"
                bind:value={fundingStage}
              >
                {#each fundingOptions as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Company Details Section -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold opacity-80 mb-4">Company Details</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label" for="company-employees">
                <span class="label-text font-medium">Team Size</span>
              </label>
              <input 
                type="number"
                id="company-employees"
                class="input input-bordered w-full"
                placeholder="Number of employees"
                bind:value={employeeCount}
                min="1"
              />
            </div>

            <div class="form-control">
              <label class="label" for="company-location">
                <span class="label-text font-medium">Location</span>
              </label>
              <input 
                type="text"
                id="company-location"
                class="input input-bordered w-full"
                placeholder="e.g., Dublin, Ireland"
                bind:value={location}
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label" for="company-founded">
                <span class="label-text font-medium">Founded Date</span>
              </label>
              <input 
                type="date"
                id="company-founded"
                class="input input-bordered w-full"
                bind:value={foundedDate}
              />
            </div>

            <div class="form-control">
              <label class="label" for="company-website">
                <span class="label-text font-medium">Website</span>
              </label>
              <input 
                type="url"
                id="company-website"
                class="input input-bordered w-full"
                placeholder="https://example.com"
                bind:value={website}
              />
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Social Links Section -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold opacity-80 mb-4">Social Links</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label" for="company-linkedin">
                <span class="label-text font-medium">LinkedIn URL</span>
              </label>
              <input 
                type="url"
                id="company-linkedin"
                class="input input-bordered w-full"
                placeholder="https://linkedin.com/company/..."
                bind:value={linkedinUrl}
              />
            </div>

            <div class="form-control">
              <label class="label" for="company-twitter">
                <span class="label-text font-medium">Twitter/X URL</span>
              </label>
              <input 
                type="url"
                id="company-twitter"
                class="input input-bordered w-full"
                placeholder="https://x.com/..."
                bind:value={twitterUrl}
              />
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Wallet Addresses Section -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 mb-4">
            <Wallet class="w-5 h-5 text-primary" />
            <h3 class="text-lg font-semibold opacity-80">Wallet Addresses</h3>
          </div>
          
          {#if !editingCompany}
            <!-- New company - show auto-generation info -->
            <div class="alert alert-info">
              <AlertCircle class="w-5 h-5" />
              <div>
                <h4 class="font-semibold">Wallet addresses will be auto-generated</h4>
                <p class="text-sm mt-1">
                  When you create this company, unique ETH and AVAX addresses will be automatically derived from your master wallet. 
                  These addresses maintain a hierarchical link to your main wallet for security and recovery.
                </p>
                {#if walletAddresses}
                  <p class="text-sm mt-2 opacity-80">
                    <strong>Your master wallet:</strong><br>
                    ETH: <code class="text-xs">{walletAddresses.eth}</code><br>
                    AVAX: <code class="text-xs">{walletAddresses.avax}</code>
                  </p>
                {/if}
              </div>
            </div>
          {:else}
            <!-- Editing existing company - show current addresses -->
            <p class="text-sm opacity-70 mb-4">
              These wallet addresses were automatically generated for your company.
            </p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label" for="company-eth-address-display">
                  <span class="label-text font-medium">Ethereum Address (ETH)</span>
                </label>
                <input 
                  type="text"
                  id="company-eth-address-display"
                  class="input input-bordered w-full font-mono text-sm"
                  value={ethAddress}
                  disabled
                  title="Auto-generated wallet address (cannot be changed)"
                />
              </div>

              <div class="form-control">
                <label class="label" for="company-avax-address-display">
                  <span class="label-text font-medium">Avalanche Address (AVAX)</span>
                </label>
                <input 
                  type="text"
                  id="company-avax-address-display"
                  class="input input-bordered w-full font-mono text-sm"
                  value={avaxAddress}
                  disabled
                  title="Auto-generated wallet address (cannot be changed)"
                />
              </div>
            </div>
          {/if}
        </div>

        <div class="divider"></div>

        <!-- Tags & Visibility Section -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold opacity-80 mb-4">Tags & Visibility</h3>
          
          <div class="form-control">
            <label class="label" for="company-tags">
              <span class="label-text font-medium">Tags</span>
              <span class="label-text-alt opacity-70">Comma-separated</span>
            </label>
            <input 
              type="text"
              id="company-tags"
              class="input input-bordered w-full"
              placeholder="e.g., AI, SaaS, B2B, Fintech"
              bind:value={tagsInput}
            />
          </div>

          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-4 p-4 bg-base-200 rounded-lg">
              <input 
                type="checkbox"
                class="toggle toggle-primary"
                bind:checked={isPublic}
              />
              <div class="flex flex-col">
                <span class="label-text font-medium">Make company profile public</span>
                <span class="text-sm opacity-70 mt-1">
                  Public companies are visible on the Companies page to all users
                </span>
              </div>
            </label>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Action Buttons -->
        <div class="flex flex-col sm:flex-row gap-3 pt-4">
          <button 
            type="submit"
            class="btn btn-primary flex-1 sm:flex-initial sm:min-w-[200px]"
            disabled={isSubmitting}
          >
            {#if isSubmitting}
              <span class="loading loading-spinner"></span>
            {/if}
            {editingCompany ? 'Save Changes' : 'Register Company'}
          </button>
          <button 
            type="button"
            class="btn btn-ghost flex-1 sm:flex-initial"
            onclick={closeForm}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Newly Created Company - Child Address Display or Wallet Generation Status -->
  {#if newlyCreatedCompany}
    <div class="glass-subtle rounded-2xl p-6 mb-6 border-2 {newlyCreatedCompany.ethAddress || newlyCreatedCompany.avaxAddress ? 'border-primary/50 bg-primary/5' : 'border-warning/50 bg-warning/5'}">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="badge badge-primary badge-lg">NEW</div>
          <h3 class="text-lg font-bold">
            {newlyCreatedCompany.name} - Company Registration
          </h3>
        </div>
        <button 
          class="btn btn-ghost btn-sm"
          onclick={() => { newlyCreatedCompany = null; revealedAddresses = {}; closeForm(); }}
          aria-label="Close"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      {#if newlyCreatedCompany.ethAddress || newlyCreatedCompany.avaxAddress}
        <!-- Success - Wallets Generated -->
        <p class="text-sm opacity-75 mb-4">
          Your company has been registered with the following blockchain addresses. These are your company's child wallet addresses derived from your master wallet.
        </p>

        <div class="space-y-3">
          {#if newlyCreatedCompany.ethAddress}
            <div class="bg-base-200/50 rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="badge badge-primary">Ethereum Sepolia</span>
                  <span class="text-xs opacity-60">testnet</span>
                </div>
              </div>
              <div class="flex items-center justify-between gap-3">
                <code class="text-sm font-mono bg-base-100 px-3 py-2 rounded flex-1 break-all">
                  {displayAddress(newlyCreatedCompany.ethAddress, 'eth')}
                </code>
                <div class="flex gap-2">
                  <button
                    class="btn btn-ghost btn-sm"
                    onclick={() => toggleReveal('eth')}
                    title={revealedAddresses['eth'] ? 'Hide address' : 'Show full address'}
                    aria-label={revealedAddresses['eth'] ? 'Hide address' : 'Show full address'}
                  >
                    {#if revealedAddresses['eth']}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-4.5-11-4.5s1.6-3.3 4.3-5.3m2.6-2.6A9.88 9.88 0 0 1 12 4c7 0 11 4.5 11 4.5s-1.6 3.3-4.3 5.3"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    {:else}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    {/if}
                  </button>
                  <button
                    class="btn btn-ghost btn-sm"
                    onclick={() => {
                      navigator.clipboard.writeText(newlyCreatedCompany?.ethAddress || '');
                      toastStore.add({ message: 'ETH address copied!', type: 'success' });
                    }}
                    title="Copy to clipboard"
                    aria-label="Copy to clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  </button>
                </div>
              </div>
              <p class="text-xs opacity-60 mt-2">
                Use this address to receive contributions to bounties on Ethereum Sepolia testnet
              </p>
            </div>
          {/if}

          {#if newlyCreatedCompany.avaxAddress}
            <div class="bg-base-200/50 rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="badge badge-error">Avalanche Fuji</span>
                  <span class="text-xs opacity-60">testnet</span>
                </div>
              </div>
              <div class="flex items-center justify-between gap-3">
                <code class="text-sm font-mono bg-base-100 px-3 py-2 rounded flex-1 break-all">
                  {displayAddress(newlyCreatedCompany.avaxAddress, 'avax')}
                </code>
                <div class="flex gap-2">
                  <button
                    class="btn btn-ghost btn-sm"
                    onclick={() => toggleReveal('avax')}
                    title={revealedAddresses['avax'] ? 'Hide address' : 'Show full address'}
                    aria-label={revealedAddresses['avax'] ? 'Hide address' : 'Show full address'}
                  >
                    {#if revealedAddresses['avax']}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-4.5-11-4.5s1.6-3.3 4.3-5.3m2.6-2.6A9.88 9.88 0 0 1 12 4c7 0 11 4.5 11 4.5s-1.6 3.3-4.3 5.3"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    {:else}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    {/if}
                  </button>
                  <button
                    class="btn btn-ghost btn-sm"
                    onclick={() => {
                      navigator.clipboard.writeText(newlyCreatedCompany?.avaxAddress || '');
                      toastStore.add({ message: 'AVAX address copied!', type: 'success' });
                    }}
                    title="Copy to clipboard"
                    aria-label="Copy to clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  </button>
                </div>
              </div>
              <p class="text-xs opacity-60 mt-2">
                Use this address to receive contributions to bounties on Avalanche Fuji testnet
              </p>
            </div>
          {/if}
        </div>

        <div class="alert alert-info mt-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span class="text-sm">
            These addresses are derived from your master wallet and will always be the same if you restore your wallet.
          </span>
        </div>
      {:else}
        <!-- Warning - Wallet Not Generated -->
        <div class="alert alert-warning">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4v2m0 0v2m0-6h2m-4 0H8m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <div>
            <h4 class="font-semibold mb-2">Wallet Addresses Not Generated</h4>
            <p class="text-sm mb-3">
              Your company was created successfully, but blockchain wallet addresses were not automatically generated. This typically means you don't have a master wallet yet.
            </p>
            <p class="text-sm mb-3">
              To generate wallet addresses for this company:
            </p>
            <ol class="text-sm list-decimal list-inside space-y-1 mb-3">
              <li>Go to your profile page</li>
              <li>Generate or restore a master wallet</li>
              <li>Come back here and click "Generate Wallet Addresses" on the company card</li>
            </ol>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if companies.length === 0 && !showForm}
    <div class="text-center py-12">
      <Building2 class="w-16 h-16 mx-auto mb-4 opacity-30" />
      <p class="text-lg opacity-70 mb-4">You haven't registered any companies yet</p>
      <button class="btn btn-primary" onclick={() => openForm()}>
        <Plus class="w-5 h-5" />
        Register Your First Company
      </button>
    </div>
  {:else if !showForm}
    <div class="space-y-4">
      {#each companies as company}
        <div class="glass-subtle rounded-2xl p-6">
          <div class="flex flex-col md:flex-row gap-4">
            <div class="flex-1">
              <div class="flex items-start justify-between mb-2">
                <div>
                  <h3 class="text-xl font-bold">{company.name}</h3>
                  <div class="flex flex-wrap gap-2 mt-2">
                    {#if company.industry}
                      <span class="badge badge-primary badge-sm">{company.industry}</span>
                    {/if}
                    <span class="badge {company.isPublic ? 'badge-success' : 'badge-ghost'} badge-sm">
                      {company.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                </div>
              </div>

              <p class="opacity-80 mb-3">{company.description}</p>

              <div class="flex flex-wrap gap-2 text-sm mb-4">
                {#if company.website}
                  <a 
                    href={company.website} 
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link link-primary flex items-center gap-1"
                  >
                    <Globe class="w-4 h-4" />
                    Website
                  </a>
                {/if}
                {#if company.linkedinUrl}
                  <a 
                    href={company.linkedinUrl} 
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link link-primary flex items-center gap-1"
                  >
                    <Linkedin class="w-4 h-4" />
                    LinkedIn
                  </a>
                {/if}
                {#if company.wishlistItems && company.wishlistItems.length > 0}
                  <span class="flex items-center gap-1 opacity-70">
                    <Target class="w-4 h-4" />
                    {company.wishlistItems.length} wishlist {company.wishlistItems.length === 1 ? 'item' : 'items'}
                  </span>
                {/if}
              </div>

              <!-- Wallet Addresses Section -->
              {#if company.ethAddress || company.avaxAddress}
                <div class="mt-4 p-3 bg-base-200/50 rounded-lg">
                  <div class="flex items-center gap-2 mb-2">
                    <Wallet class="w-4 h-4 text-primary" />
                    <span class="text-sm font-semibold">Wallet Addresses</span>
                  </div>
                  <div class="space-y-2">
                    {#if company.ethAddress}
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 flex-1 min-w-0">
                          <span class="badge badge-primary badge-xs">ETH</span>
                          <code class="text-xs font-mono flex-1" title={company.ethAddress}>
                            {displayAddress(company.ethAddress, `eth-${company.id}`)}
                          </code>
                        </div>
                        <div class="flex gap-1">
                          <button
                            class="btn btn-ghost btn-xs"
                            onclick={() => toggleReveal(`eth-${company.id}`)}
                            title={revealedAddresses[`eth-${company.id}`] ? 'Hide address' : 'Show full address'}
                            aria-label={revealedAddresses[`eth-${company.id}`] ? 'Hide' : 'Show'}
                          >
                            {#if revealedAddresses[`eth-${company.id}`]}
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-4.5-11-4.5s1.6-3.3 4.3-5.3m2.6-2.6A9.88 9.88 0 0 1 12 4c7 0 11 4.5 11 4.5s-1.6 3.3-4.3 5.3"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                            {:else}
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            {/if}
                          </button>
                          <button
                            class="btn btn-ghost btn-xs"
                            onclick={() => {
                              navigator.clipboard.writeText(company.ethAddress || '');
                              toastStore.add({ message: 'Address copied!', type: 'success' });
                            }}
                            title="Copy Ethereum address"
                            aria-label="Copy Ethereum address"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                          </button>
                        </div>
                      </div>
                    {/if}
                    {#if company.avaxAddress}
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 flex-1 min-w-0">
                          <span class="badge badge-error badge-xs">AVAX</span>
                          <code class="text-xs font-mono flex-1" title={company.avaxAddress}>
                            {displayAddress(company.avaxAddress, `avax-${company.id}`)}
                          </code>
                        </div>
                        <div class="flex gap-1">
                          <button
                            class="btn btn-ghost btn-xs"
                            onclick={() => toggleReveal(`avax-${company.id}`)}
                            title={revealedAddresses[`avax-${company.id}`] ? 'Hide address' : 'Show full address'}
                            aria-label={revealedAddresses[`avax-${company.id}`] ? 'Hide' : 'Show'}
                          >
                            {#if revealedAddresses[`avax-${company.id}`]}
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-4.5-11-4.5s1.6-3.3 4.3-5.3m2.6-2.6A9.88 9.88 0 0 1 12 4c7 0 11 4.5 11 4.5s-1.6 3.3-4.3 5.3"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                            {:else}
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            {/if}
                          </button>
                          <button
                            class="btn btn-ghost btn-xs"
                            onclick={() => {
                              navigator.clipboard.writeText(company.avaxAddress || '');
                              toastStore.add({ message: 'Address copied!', type: 'success' });
                            }}
                            title="Copy Avalanche address"
                            aria-label="Copy Avalanche address"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                          </button>
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              {:else}
                <div class="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <div class="flex items-center gap-2 mb-2">
                    <AlertCircle class="w-4 h-4 text-warning" />
                    <span class="text-sm font-semibold">No Wallet Addresses</span>
                  </div>
                  <p class="text-sm opacity-80 mb-3">
                    This company doesn't have blockchain wallet addresses yet. Wallet addresses are automatically generated when a company is created if you have a master wallet. If this company was created before your master wallet, you can regenerate addresses now.
                  </p>
                  <button
                    class="btn btn-sm btn-warning gap-2"
                    onclick={() => {
                      errorMessage = null;
                      // Trigger wallet generation for this company
                      fetch(`${PUBLIC_API_URL}/wallet/company/${company.id}`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${$authStore.accessToken}`
                        }
                      })
                        .then(res => res.json())
                        .then(data => {
                          if (data.success) {
                            toastStore.add({ message: 'Wallet addresses generated successfully!', type: 'success' });
                            onUpdate(); // Refresh companies
                          } else {
                            toastStore.add({ message: data.message || 'Failed to generate wallet', type: 'error' });
                          }
                        })
                        .catch(err => {
                          toastStore.add({ message: 'Error generating wallet', type: 'error' });
                        });
                    }}
                  >
                    <Wallet class="w-4 h-4" />
                    Generate Wallet Addresses
                  </button>
                </div>
              {/if}

              <!-- Wishlist Section - Expandable -->
              <div class="mt-4">
                <button
                  class="btn btn-sm btn-outline w-full justify-between"
                  onclick={() => toggleWishlist(company.id)}
                >
                  <span class="flex items-center gap-2">
                    <Target class="w-4 h-4" />
                    Company Wishlist
                    {#if company.wishlistItems && company.wishlistItems.length > 0}
                      <span class="badge badge-primary badge-sm">{company.wishlistItems.length}</span>
                    {/if}
                  </span>
                  {#if expandedWishlistId === company.id}
                    <ChevronUp class="w-4 h-4" />
                  {:else}
                    <ChevronDown class="w-4 h-4" />
                  {/if}
                </button>

                {#if expandedWishlistId === company.id}
                  <div class="mt-4 space-y-4 border-t border-base-300 pt-4">
                    <!-- Add New Wishlist Item -->
                    <WishlistForm 
                      companyId={company.id}
                      companyWallet={company.ethAddress || company.avaxAddress}
                      masterWallet={masterWallet}
                      onItemAdded={handleWishlistItemAdded}
                      onCreateBounty={(item) => openBountyModal(item, company)}
                    />

                    <!-- Existing Wishlist Items -->
                    {#if company.wishlistItems && company.wishlistItems.length > 0}
                      <div class="space-y-3">
                        <h4 class="text-sm font-semibold opacity-70">Current Wishlist Items:</h4>
                        {#each company.wishlistItems as item}
                          <div class="bg-base-200/50 rounded-lg p-3">
                            <div class="flex items-start justify-between mb-2 gap-2">
                              <div class="flex-1">
                                <h5 class="font-semibold text-sm">{item.title}</h5>
                                {#if item.description}
                                  <p class="text-xs opacity-70 mt-1">{item.description}</p>
                                {/if}
                                <div class="flex gap-2 mt-2">
                                  <span class="badge badge-sm">{item.category}</span>
                                  <span class="badge badge-sm badge-{item.priority === 'critical' ? 'error' : item.priority === 'high' ? 'warning' : 'ghost'}">
                                    {item.priority}
                                  </span>
                                </div>
                              </div>
                              <button
                                class="btn btn-ghost btn-xs btn-square text-error"
                                onclick={() => deleteWishlistItem(company.id, item.id, item.title, item.isEscrowActive)}
                                title="Delete wishlist item"
                              >
                                <Trash2 class="w-3 h-3" />
                              </button>
                            </div>
                            
                            {#if item.value}
                              {@const percentage = Math.min(100, ((item.amountRaised || 0) / item.value) * 100)}
                              {@const remaining = Math.max(0, item.value - (item.amountRaised || 0))}
                              <div class="mt-2">
                                <div class="flex justify-between text-xs mb-1">
                                  <span class="opacity-70">Progress</span>
                                  <span class="font-semibold">{percentage.toFixed(0)}% complete</span>
                                </div>
                                <progress class="progress progress-primary w-full h-2" value={percentage} max="100"></progress>
                                <div class="flex justify-between text-xs mt-1 opacity-70">
                                  <span>Raised: ${(item.amountRaised || 0).toLocaleString()}</span>
                                  <span>Goal: ${item.value.toLocaleString()}</span>
                                </div>
                                {#if remaining > 0}
                                  <p class="text-xs mt-1 opacity-60">
                                    ${remaining.toLocaleString()} remaining to reach goal
                                  </p>
                                {:else}
                                  <p class="text-xs mt-1 text-success font-semibold">
                                    🎉 Goal reached!
                                  </p>
                                {/if}
                              </div>
                            {:else}
                              <p class="text-xs opacity-60 mt-2">
                                Raised: ${(item.amountRaised || 0).toLocaleString()}
                              </p>
                            {/if}

                            <!-- Create Bounty Button - Debug Version -->
                            {#if !item.isEscrowActive}
                              <div class="mt-3 pt-3 border-t border-base-300">
                                {#if item.value && (company.ethAddress || company.avaxAddress)}
                                  <div class="space-y-2">
                                    <button
                                      class="btn btn-sm btn-primary w-full gap-2"
                                      onclick={() => openBountyModal(item, company)}
                                    >
                                      <Target class="w-4 h-4" />
                                      Create Bounty (Traditional)
                                    </button>
                                    <button
                                      class="btn btn-sm btn-accent w-full gap-2"
                                      onclick={() => openBountyModalX402(item, company)}
                                    >
                                      <Wallet class="w-4 h-4" />
                                      Create Bounty (Pay with USDC)
                                    </button>
                                  </div>
                                  <p class="text-xs opacity-60 mt-1 text-center">
                                    Choose payment method for deployment
                                  </p>
                                {:else}
                                  <div class="alert alert-warning py-2">
                                    <div class="text-xs">
                                      {#if !item.value}
                                        ⚠️ Set a target value to enable bounty creation
                                      {:else if !company.ethAddress && !company.avaxAddress}
                                        ⚠️ Add a wallet address to your company to enable bounties
                                      {/if}
                                    </div>
                                  </div>
                                {/if}
                              </div>
                            {:else}
                              <div class="mt-3 pt-3 border-t border-base-300">
                                <div class="alert alert-success py-2 mb-3">
                                  <div class="flex items-center gap-2 text-xs">
                                    <Target class="w-4 h-4" />
                                    <span class="font-semibold">Active Bounty Campaign</span>
                                  </div>
                                </div>
                                
                                {#if item.ethereumEscrowAddress || item.avalancheEscrowAddress}
                                  <div class="bg-base-200/50 rounded-lg p-3 space-y-2">
                                    <p class="text-xs font-semibold opacity-70 mb-2">Smart Contract Addresses:</p>
                                    
                                    {#if item.ethereumEscrowAddress}
                                      <div class="space-y-1">
                                        <div class="flex items-center justify-between">
                                          <span class="text-xs font-semibold flex items-center gap-1">
                                            <span class="badge badge-primary badge-xs">ETH</span>
                                            Ethereum Sepolia
                                          </span>
                                          <a
                                            href="https://sepolia.etherscan.io/address/{item.ethereumEscrowAddress}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="btn btn-ghost btn-xs gap-1"
                                          >
                                            View
                                            <ExternalLink class="w-3 h-3" />
                                          </a>
                                        </div>
                                        <code class="text-xs bg-base-300 px-2 py-1 rounded block truncate">{item.ethereumEscrowAddress}</code>
                                      </div>
                                    {/if}
                                    
                                    {#if item.avalancheEscrowAddress}
                                      <div class="space-y-1">
                                        <div class="flex items-center justify-between">
                                          <span class="text-xs font-semibold flex items-center gap-1">
                                            <span class="badge badge-error badge-xs">AVAX</span>
                                            Avalanche Fuji
                                          </span>
                                          <a
                                            href="https://testnet.snowtrace.io/address/{item.avalancheEscrowAddress}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="btn btn-ghost btn-xs gap-1"
                                          >
                                            View
                                            <ExternalLink class="w-3 h-3" />
                                          </a>
                                        </div>
                                        <code class="text-xs bg-base-300 px-2 py-1 rounded block truncate">{item.avalancheEscrowAddress}</code>
                                      </div>
                                    {/if}
                                    
                                    {#if item.deployments && item.deployments.length > 0}
                                      <div class="mt-3 pt-3 border-t border-base-300">
                                        <p class="text-xs font-semibold opacity-70 mb-2">📋 Deployment History:</p>
                                        {#each item.deployments as deployment}
                                          <div class="bg-base-300/30 rounded p-2 mb-2 text-xs space-y-1">
                                            <div class="flex items-center justify-between">
                                              <span class="font-semibold">{deployment.chain === 'ethereum' ? '⟠ Ethereum' : '▲ Avalanche'} {deployment.network}</span>
                                              <a
                                                href={deployment.chain === 'ethereum' 
                                                  ? `https://sepolia.etherscan.io/tx/${deployment.deploymentTxHash}`
                                                  : `https://testnet.snowtrace.io/tx/${deployment.deploymentTxHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="link link-primary text-xs"
                                                title="View deployment transaction"
                                              >
                                                Tx
                                              </a>
                                            </div>
                                            {#if deployment.deploymentTxHash}
                                              <div class="font-mono text-[10px] opacity-70 truncate">
                                                TX: {deployment.deploymentTxHash.slice(0, 10)}...{deployment.deploymentTxHash.slice(-8)}
                                              </div>
                                            {/if}
                                            <div class="text-[10px] opacity-60">
                                              {new Date(deployment.deployedAt).toLocaleDateString()} {new Date(deployment.deployedAt).toLocaleTimeString()}
                                            </div>
                                              {#if deployment.campaignName}
                                                <div class="mt-1 text-sm font-semibold">{deployment.campaignName}</div>
                                              {/if}
                                              {#if deployment.campaignDescription}
                                                <div class="text-xs opacity-80">{deployment.campaignDescription}</div>
                                              {/if}
                                          </div>
                                        {/each}
                                      </div>
                                    {/if}
                                    
                                    <p class="text-xs opacity-60 mt-2 pt-2 border-t border-base-300">
                                      Investors can contribute via <a href="/companies/{company.id}" class="link">company page</a> or <a href="/bounties" class="link">bounties page</a>
                                    </p>
                                  </div>
                                {:else}
                                  <div class="bg-warning/10 rounded-lg p-3 border border-warning/30">
                                    <p class="text-xs opacity-80">
                                      ⏳ Contracts are being deployed... This may take a few moments. Refresh the page to see contract addresses.
                                    </p>
                                  </div>
                                {/if}
                              </div>
                            {/if}
                          </div>
                        {/each}
                      </div>
                    {:else}
                      <div class="text-center py-6 opacity-60">
                        <Target class="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p class="text-sm">No wishlist items yet. Add your first item above!</p>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>

            <div class="flex md:flex-col gap-2">
              <button 
                class="btn btn-sm btn-ghost"
                onclick={() => openForm(company)}
              >
                <Edit class="w-4 h-4" />
              </button>
              <button 
                class="btn btn-sm btn-ghost text-error"
                onclick={() => deleteCompany(company.id, company.name)}
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Create Bounty Modal -->
{#if selectedWishlistItem && selectedCompany}
  <CreateBountyModal
    bind:isOpen={bountyModalOpen}
    wishlistItem={selectedWishlistItem}
    companyName={selectedCompany.name}
    companyWallet={selectedCompany.ethAddress || selectedCompany.avaxAddress || ''}
    onSuccess={handleBountySuccess}
  />
{/if}

<!-- Create Bounty Modal X402 (USDC Payment) -->
{#if selectedWishlistItem && selectedCompany}
  <CreateBountyModalX402
    bind:isOpen={bountyModalX402Open}
    wishlistItem={selectedWishlistItem}
    companyName={selectedCompany.name}
    companyWallet={selectedCompany.ethAddress || selectedCompany.avaxAddress || ''}
    onSuccess={handleBountySuccess}
  />
{/if}

<!-- Delete Confirmation Modal for Wishlist Items -->
{#if showDeleteModal && itemToDelete}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-base-100 rounded-lg shadow-2xl max-w-md w-full mx-4 border border-base-300">
      <!-- Modal Header -->
      <div class="border-b border-base-300 p-6">
        <h2 class="text-xl font-bold">Delete Wishlist Item</h2>
      </div>

      <!-- Modal Body -->
      <div class="p-6 space-y-4">
        <div class="alert alert-warning">
          <AlertCircle class="w-5 h-5" />
          <div>
            <p class="font-semibold">Are you sure?</p>
            <p class="text-sm">Deleting <strong>"{itemToDelete.itemTitle}"</strong> cannot be undone.</p>
            {#if itemToDelete.hasEscrow}
              <p class="text-sm mt-2">
                ⚠️ This item has blockchain contracts deployed. Deleting it will not affect the contracts but will remove it from your wishlist.
              </p>
            {/if}
          </div>
        </div>

        <div>
          <label class="label" for="delete-confirm-input">
            <span class="label-text">Type <strong>"delete"</strong> to confirm</span>
          </label>
          <input
            id="delete-confirm-input"
            type="text"
            class="input input-bordered w-full"
            placeholder="Type 'delete' here"
            bind:value={deleteConfirmationText}
            autocomplete="off"
          />
          {#if deleteConfirmationText && deleteConfirmationText !== 'delete'}
            <p class="text-error text-xs mt-1">Incorrect confirmation text</p>
          {/if}
          {#if deleteConfirmationText === 'delete'}
            <p class="text-success text-xs mt-1">✓ Ready to delete</p>
          {/if}
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="border-t border-base-300 p-6 flex gap-3 justify-end">
        <button
          class="btn btn-ghost"
          onclick={cancelDeleteModal}
          disabled={isDeleting}
        >
          Cancel
        </button>
        <button
          class="btn btn-error"
          onclick={confirmDeleteWishlistItem}
          disabled={deleteConfirmationText !== 'delete' || isDeleting}
        >
          {#if isDeleting}
            <span class="loading loading-spinner loading-sm"></span>
            Deleting...
          {:else}
            Delete Item
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal for Companies -->
{#if showCompanyDeleteModal && companyToDelete}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-base-100 rounded-lg shadow-2xl max-w-md w-full mx-4 border border-base-300">
      <!-- Modal Header -->
      <div class="border-b border-base-300 p-6">
        <h2 class="text-xl font-bold">Delete Company</h2>
      </div>

      <!-- Modal Body -->
      <div class="p-6 space-y-4">
        <div class="alert alert-error">
          <AlertCircle class="w-5 h-5" />
          <div>
            <p class="font-semibold">Warning: This action cannot be undone</p>
            <p class="text-sm">You are about to permanently delete <strong>"{companyToDelete.name}"</strong> and all associated data.</p>
          </div>
        </div>

        <div>
          <label class="label" for="company-delete-confirm-input">
            <span class="label-text">Type <strong>"delete"</strong> to confirm</span>
          </label>
          <input
            id="company-delete-confirm-input"
            type="text"
            class="input input-bordered w-full"
            placeholder="Type 'delete' here"
            bind:value={companyDeleteConfirmationText}
            autocomplete="off"
          />
          {#if companyDeleteConfirmationText && companyDeleteConfirmationText !== 'delete'}
            <p class="text-error text-xs mt-1">Incorrect confirmation text</p>
          {/if}
          {#if companyDeleteConfirmationText === 'delete'}
            <p class="text-success text-xs mt-1">✓ Ready to delete</p>
          {/if}
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="border-t border-base-300 p-6 flex gap-3 justify-end">
        <button
          class="btn btn-ghost"
          onclick={cancelCompanyDeleteModal}
          disabled={isDeletingCompany}
        >
          Cancel
        </button>
        <button
          class="btn btn-error"
          onclick={confirmDeleteCompany}
          disabled={companyDeleteConfirmationText !== 'delete' || isDeletingCompany}
        >
          {#if isDeletingCompany}
            <span class="loading loading-spinner loading-sm"></span>
            Deleting Company...
          {:else}
            Delete Company
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
