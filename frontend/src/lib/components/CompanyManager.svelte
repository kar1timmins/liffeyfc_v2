<script lang="ts">
  import { Building2, Plus, Edit, Trash2, Globe, Linkedin, Twitter, X, Target } from 'lucide-svelte';
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
    tags?: string[];
    isPublic: boolean;
    wishlistItems?: any[];
  }

  let { companies = $bindable([]), onUpdate = () => {} }: { 
    companies: Company[], 
    onUpdate: () => void 
  } = $props();

  let showForm = $state(false);
  let editingCompany = $state<Company | null>(null);
  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);
  
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

  function openForm(company: Company | null = null) {
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
      <button class="btn btn-primary" onclick={() => openForm()}>
        <Plus class="w-5 h-5" />
        Register Company
      </button>
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
        <div class="alert alert-error mb-4">
          <span>{errorMessage}</span>
        </div>
      {/if}

      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
        <div class="form-control">
          <label class="label" for="company-name">
            <span class="label-text">Company Name *</span>
          </label>
          <input 
            type="text"
            id="company-name"
            class="input input-bordered"
            bind:value={name}
            required
          />
        </div>

        <div class="form-control">
          <label class="label" for="company-description">
            <span class="label-text">Description *</span>
          </label>
          <textarea 
            id="company-description"
            class="textarea textarea-bordered h-24"
            bind:value={description}
            required
          ></textarea>
        </div>

        <div class="form-control">
          <label class="label" for="company-industry">
            <span class="label-text">Industry</span>
          </label>
          <select 
            id="company-industry"
            class="select select-bordered"
            bind:value={industry}
          >
            <option value="">Select Industry</option>
            {#each industries as ind}
              <option value={ind}>{ind}</option>
            {/each}
          </select>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label" for="company-stage">
              <span class="label-text">Stage</span>
            </label>
            <select 
              id="company-stage"
              class="select select-bordered"
              bind:value={stage}
            >
              {#each stageOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>

          <div class="form-control">
            <label class="label" for="company-funding">
              <span class="label-text">Funding Stage</span>
            </label>
            <select 
              id="company-funding"
              class="select select-bordered"
              bind:value={fundingStage}
            >
              {#each fundingOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label" for="company-employees">
              <span class="label-text">Number of Employees</span>
            </label>
            <input 
              type="number"
              id="company-employees"
              class="input input-bordered"
              bind:value={employeeCount}
              min="1"
            />
          </div>

          <div class="form-control">
            <label class="label" for="company-location">
              <span class="label-text">Location</span>
            </label>
            <input 
              type="text"
              id="company-location"
              class="input input-bordered"
              placeholder="e.g., Dublin, Ireland"
              bind:value={location}
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label" for="company-founded">
              <span class="label-text">Founded Date</span>
            </label>
            <input 
              type="date"
              id="company-founded"
              class="input input-bordered"
              bind:value={foundedDate}
            />
          </div>

          <div class="form-control">
            <label class="label" for="company-website">
              <span class="label-text">Website</span>
            </label>
            <input 
              type="url"
              id="company-website"
              class="input input-bordered"
              placeholder="https://example.com"
              bind:value={website}
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label" for="company-linkedin">
              <span class="label-text">LinkedIn URL</span>
            </label>
            <input 
              type="url"
              id="company-linkedin"
              class="input input-bordered"
              placeholder="https://linkedin.com/company/..."
              bind:value={linkedinUrl}
            />
          </div>

          <div class="form-control">
            <label class="label" for="company-twitter">
              <span class="label-text">Twitter URL</span>
            </label>
            <input 
              type="url"
              id="company-twitter"
              class="input input-bordered"
              placeholder="https://x.com/..."
              bind:value={twitterUrl}
            />
          </div>
        </div>

        <div class="form-control">
          <label class="label" for="company-tags">
            <span class="label-text">Tags (comma-separated)</span>
          </label>
          <input 
            type="text"
            id="company-tags"
            class="input input-bordered"
            placeholder="e.g., AI, SaaS, B2B"
            bind:value={tagsInput}
          />
        </div>

        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-4">
            <input 
              type="checkbox"
              class="toggle toggle-primary"
              bind:checked={isPublic}
            />
            <span class="label-text">Make company profile public</span>
          </label>
          <span class="text-sm opacity-70 ml-1 mt-1">
            Public companies are visible on the Companies page to all users
          </span>
        </div>

        <div class="flex gap-3 pt-4">
          <button 
            type="submit"
            class="btn btn-primary"
            disabled={isSubmitting}
          >
            {#if isSubmitting}
              <span class="loading loading-spinner"></span>
            {/if}
            {editingCompany ? 'Save Changes' : 'Register Company'}
          </button>
          <button 
            type="button"
            class="btn btn-ghost"
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
