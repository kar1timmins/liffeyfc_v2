<script lang="ts">
  import { onMount } from 'svelte';
  import { Building2, Users, MapPin, Calendar, TrendingUp, Target, Plus } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { authStore } from '$lib/stores/auth';
  import { goto } from '$app/navigation';

  let companies = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let selectedIndustry = $state('all');
  let selectedStage = $state('all');

  const industries = ['Technology', 'Healthcare', 'Finance', 'E-commerce', 'Education', 'Other'];
  const stages = [
    { value: 'idea', label: 'Idea' },
    { value: 'mvp', label: 'MVP' },
    { value: 'early_stage', label: 'Early Stage' },
    { value: 'growth', label: 'Growth' },
    { value: 'scale', label: 'Scale' },
    { value: 'established', label: 'Established' }
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

      const response = await fetch(`${PUBLIC_API_URL}/companies?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        companies = data.data;
      } else {
        error = data.message || 'Failed to fetch companies';
      }
    } catch (err: any) {
      error = err.message || 'Failed to fetch companies';
    } finally {
      isLoading = false;
    }
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
    if (selectedIndustry || selectedStage) {
      fetchCompanies();
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
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>
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
    {#if !isLoading && companies.length > 0}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each companies as company}
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

              {#if company.wishlistItems && company.wishlistItems.length > 0}
                <div class="flex items-center gap-2 opacity-70">
                  <Target class="w-4 h-4" />
                  <span>{company.wishlistItems.length} wishlist {company.wishlistItems.length === 1 ? 'item' : 'items'}</span>
                </div>
              {/if}
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
    {#if !isLoading && !error && companies.length === 0}
      <div class="text-center py-12">
        <Building2 class="w-16 h-16 mx-auto mb-4 opacity-50" />
        <h3 class="text-2xl font-bold mb-2">No companies found</h3>
        <p class="opacity-70 mb-6">Try adjusting your filters or be the first to register your company!</p>
        <button class="btn btn-primary" onclick={registerCompany}>
          Register Your Company
        </button>
      </div>
    {/if}
  </div>
</div>
