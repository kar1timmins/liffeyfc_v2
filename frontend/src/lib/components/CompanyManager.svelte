<script lang="ts">
  import { onMount } from 'svelte';
  import { Building2, Plus, Edit, Trash2, Globe, Linkedin, Twitter, X, Target, Wallet, AlertCircle } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { authStore } from '$lib/stores/auth';

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
    refreshWalletTrigger = 0
  }: { 
    companies: Company[], 
    onUpdate: () => void,
    refreshWalletTrigger?: number
  } = $props();

  let showForm = $state(false);
  let editingCompany = $state<Company | null>(null);
  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);
  let hasWallet = $state<boolean | null>(null);
  let isCheckingWallet = $state(false);
  let walletAddresses = $state<{ eth: string; avax: string } | null>(null);
  
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
        closeForm();
        onUpdate();
      } else {
        errorMessage = result.message || 'Failed to save company';
      }
    } catch (err: any) {
      errorMessage = err.message || 'An error occurred';
    } finally {
      isSubmitting = false;
    }
  }

  async function deleteCompany(companyId: string) {
    if (!confirm('Are you sure you want to delete this company?')) {
      return;
    }

    try {
      const token = $authStore.accessToken;
      if (!token) return;

      const response = await fetch(`${PUBLIC_API_URL}/companies/${companyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        onUpdate();
      } else {
        alert(result.message || 'Failed to delete company');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred');
    }
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

              <div class="flex flex-wrap gap-2 text-sm">
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
                onclick={() => deleteCompany(company.id)}
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
