<script lang="ts">
  import { onMount } from 'svelte';
  import { Building2, Users, MapPin, Calendar, TrendingUp, Plus, Search, X, ArrowLeft } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { authStore } from '$lib/stores/auth';
  import { goto } from '$app/navigation';

  let companies = $state<any[]>([]);
  let filteredCompanies = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let selectedIndustry = $state('all');
  let selectedStage = $state('all');
  let selectedFunding = $state('all');

  const industries = ['Technology', 'Healthcare', 'Finance', 'E-commerce', 'Education', 'SaaS', 'AI/ML', 'Blockchain', 'Consumer', 'B2B', 'Energy', 'Real Estate', 'Media', 'Agriculture', 'Transportation', 'Other'];
  const stages = [
    { value: 'idea', label: 'Idea' },
    { value: 'mvp', label: 'MVP' },
    { value: 'early_stage', label: 'Early Stage' },
    { value: 'growth', label: 'Growth' },
    { value: 'scale', label: 'Scale' },
    { value: 'established', label: 'Established' }
  ];
  const fundingStages = [
    { value: 'bootstrapped', label: 'Bootstrapped' },
    { value: 'pre_seed', label: 'Pre-Seed' },
    { value: 'seed', label: 'Seed' },
    { value: 'series_a', label: 'Series A' },
    { value: 'series_b', label: 'Series B' },
    { value: 'series_c_plus', label: 'Series C+' }
  ];

  onMount(async () => {
    await fetchCompanies();
  });

  async function fetchCompanies() {
    isLoading = true;
    error = null;

    try {
      const params = new URLSearchParams();
      if (selectedIndustry !== 'all') params.append('industry', selectedIndustry);
      if (selectedStage !== 'all') params.append('stage', selectedStage);
      if (selectedFunding !== 'all') params.append('fundingStage', selectedFunding);

      const response = await fetch(`${PUBLIC_API_URL}/companies?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        companies = data.data;
        applySearch();
      } else {
        error = data.message || 'Failed to fetch companies';
      }
    } catch (err: any) {
      error = err.message || 'Failed to fetch companies';
    } finally {
      isLoading = false;
    }
  }

  function applySearch() {
    if (!searchQuery.trim()) {
      filteredCompanies = companies;
      return;
    }

    const query = searchQuery.toLowerCase();
    filteredCompanies = companies.filter(company => {
      return (
        company.name.toLowerCase().includes(query) ||
        company.description?.toLowerCase().includes(query) ||
        company.industry?.toLowerCase().includes(query) ||
        company.location?.toLowerCase().includes(query) ||
        company.tags?.some((tag: string) => tag.toLowerCase().includes(query))
      );
    });
  }

  function clearSearch() {
    searchQuery = '';
    applySearch();
  }

  function viewCompany(id: string) {
    goto(`/companies/${id}`);
  }

  function registerCompany() {
    if (!$authStore.isAuthenticated) {
      goto('/auth');
      return;
    }
    goto('/profile?tab=company');
  }

  $effect(() => {
    if (selectedIndustry || selectedStage || selectedFunding) {
      fetchCompanies();
    }
  });

  $effect(() => {
    if (searchQuery !== undefined) {
      applySearch();
    }
  });
</script>

<svelte:head>
  <title>Companies - Liffey Founders Club</title>
</svelte:head>

<div class="min-h-screen py-12">
  <div class="container mx-auto px-4">
    <!-- Header -->
    <div class="mb-8">
    	<button class="btn mb-6 btn-ghost" onclick={() => history.back()}>
				<ArrowLeft size={16} /> Back
			</button>
      <h1 class="text-4xl md:text-5xl font-bold mb-4">Companies</h1>
      <p class="text-lg opacity-80 mb-6">
        Discover innovative startups and businesses from the Liffey Founders Club community
      </p>

      <button
        class="btn btn-primary"
        onclick={registerCompany}
      >
        <Plus class="w-5 h-5" />
        Register Your Company
      </button>
    </div>

    <!-- Filters -->
    <div class="glass-subtle rounded-2xl p-6 mb-8">
      <!-- Search Bar -->
      <div class="relative mb-6">
        <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-50" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search companies by name, description, industry, location, or tags..."
          class="input input-bordered w-full pl-12 pr-12 text-base-content"
        />
        {#if searchQuery}
          <button
            onclick={clearSearch}
            class="absolute right-4 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
          >
            <X class="w-5 h-5" />
          </button>
        {/if}
      </div>

      <!-- Filter Selects -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="label" for="industry-select">
            <span class="label-text">Industry</span>
          </label>
          <select 
            id="industry-select"
            class="select select-bordered w-full"
            bind:value={selectedIndustry}
          >
            <option value="all">All Industries</option>
            {#each industries as industry}
              <option value={industry}>{industry}</option>
            {/each}
          </select>
        </div>

        <div>
          <label class="label" for="stage-select">
            <span class="label-text">Stage</span>
          </label>
          <select 
            id="stage-select"
            class="select select-bordered w-full"
            bind:value={selectedStage}
          >
            <option value="all">All Stages</option>
            {#each stages as stage}
              <option value={stage.value}>{stage.label}</option>
            {/each}
          </select>
        </div>

        <div>
          <label class="label" for="funding-select">
            <span class="label-text">Funding Stage</span>
          </label>
          <select 
            id="funding-select"
            class="select select-bordered w-full"
            bind:value={selectedFunding}
          >
            <option value="all">All Funding Stages</option>
            {#each fundingStages as funding}
              <option value={funding.value}>{funding.label}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- Results Count and Clear Filters -->
      {#if !isLoading && !error}
        <div class="mt-6 pt-6 border-t border-gray-200 flex items-center justify-between">
          <p class="text-sm text-gray-600">
            Showing <span class="font-semibold">{filteredCompanies.length}</span> {filteredCompanies.length === 1 ? 'company' : 'companies'}
          </p>
          {#if searchQuery || selectedIndustry !== 'all' || selectedStage !== 'all' || selectedFunding !== 'all'}
            <button
              onclick={() => {
                searchQuery = '';
                selectedIndustry = 'all';
                selectedStage = 'all';
                selectedFunding = 'all';
                fetchCompanies();
              }}
              class="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              Clear all filters
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Loading State -->
    {#if isLoading}
      <div class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    {/if}

    <!-- Error State -->
    {#if error}
      <div class="alert alert-error mb-8">
        <span>{error}</span>
      </div>
    {/if}

    <!-- Companies Grid -->
    {#if !isLoading && filteredCompanies.length > 0}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each filteredCompanies as company}
          <button
            class="glass-subtle rounded-2xl p-6 hover:scale-[1.02] transition-all text-left"
            onclick={() => viewCompany(company.id)}
          >
            <!-- Company Logo/Icon -->
            <div class="flex items-start gap-4 mb-4">
              {#if company.logoUrl}
                <img 
                  src={company.logoUrl} 
                  alt={company.name}
                  class="w-16 h-16 rounded-xl object-cover"
                />
              {:else}
                <div class="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Building2 class="w-8 h-8 text-white" />
                </div>
              {/if}

              <div class="flex-1">
                <h3 class="text-xl font-bold mb-1">{company.name}</h3>
                {#if company.industry}
                  <span class="badge badge-sm badge-primary">{company.industry}</span>
                {/if}
              </div>
            </div>

            <!-- Description -->
            <p class="text-sm opacity-80 mb-4 line-clamp-2">
              {company.description}
            </p>

            <!-- Company Info -->
            <div class="space-y-2 text-sm">
              {#if company.location}
                <div class="flex items-center gap-2 opacity-70">
                  <MapPin class="w-4 h-4" />
                  <span>{company.location}</span>
                </div>
              {/if}

              <div class="flex items-center gap-2 opacity-70">
                <Users class="w-4 h-4" />
                <span>{company.employeeCount} {company.employeeCount === 1 ? 'employee' : 'employees'}</span>
              </div>

              <div class="flex items-center gap-2 opacity-70">
                <TrendingUp class="w-4 h-4" />
                <span class="capitalize">{company.stage.replace('_', ' ')}</span>
              </div>
            </div>

            <!-- Tags -->
            {#if company.tags && company.tags.length > 0}
              <div class="flex flex-wrap gap-2 mt-4">
                {#each company.tags.slice(0, 3) as tag}
                  <span class="badge badge-sm badge-outline">{tag}</span>
                {/each}
              </div>
            {/if}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Empty State -->
    {#if !isLoading && !error && filteredCompanies.length === 0}
      <div class="text-center py-12">
        <Building2 class="w-16 h-16 mx-auto mb-4 opacity-50" />
        <h3 class="text-2xl font-bold mb-2">
          {searchQuery || selectedIndustry !== 'all' || selectedStage !== 'all' || selectedFunding !== 'all' 
            ? 'No companies match your search' 
            : 'No companies found'}
        </h3>
        <p class="opacity-70 mb-6">
          {searchQuery || selectedIndustry !== 'all' || selectedStage !== 'all' || selectedFunding !== 'all'
            ? 'Try adjusting your filters or search query'
            : 'Be the first to register your company!'}
        </p>
        <div class="flex gap-3 justify-center">
          {#if searchQuery || selectedIndustry !== 'all' || selectedStage !== 'all' || selectedFunding !== 'all'}
            <button
              class="btn btn-outline"
              onclick={() => {
                searchQuery = '';
                selectedIndustry = 'all';
                selectedStage = 'all';
                selectedFunding = 'all';
                fetchCompanies();
              }}
            >
              Clear Filters
            </button>
          {/if}
          <button class="btn btn-primary" onclick={registerCompany}>
            Register Your Company
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
