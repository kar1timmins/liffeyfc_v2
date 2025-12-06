<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { Building2, MapPin, Users, TrendingUp, DollarSign, Calendar, Globe, Linkedin, Twitter, Target, CheckCircle, Circle, ArrowLeft } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { authStore } from '$lib/stores/auth';

  let company = $state<any>(null);
  let wishlistItems = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  const companyId = $derived($page.params.id);

  const stageLabels: Record<string, string> = {
    idea: 'Idea',
    mvp: 'MVP',
    early_stage: 'Early Stage',
    growth: 'Growth',
    scale: 'Scale',
    established: 'Established'
  };

  const fundingLabels: Record<string, string> = {
    bootstrapped: 'Bootstrapped',
    pre_seed: 'Pre-Seed',
    seed: 'Seed',
    series_a: 'Series A',
    series_b: 'Series B',
    series_c_plus: 'Series C+'
  };

  const categoryIcons: Record<string, any> = {
    funding: DollarSign,
    talent: Users,
    mentorship: Target,
    partnerships: Building2,
    resources: Globe,
    technology: Building2,
    marketing: TrendingUp,
    other: Circle
  };

  onMount(async () => {
    await fetchCompany();
  });

  async function fetchCompany() {
    isLoading = true;
    error = null;

    try {
      const response = await fetch(`${PUBLIC_API_URL}/companies/${companyId}?includeWishlist=true`);
      const data = await response.json();

      if (data.success) {
        company = data.data;
        wishlistItems = data.data.wishlistItems || [];
      } else {
        error = data.message || 'Company not found';
      }
    } catch (err: any) {
      error = err.message || 'Failed to fetch company';
    } finally {
      isLoading = false;
    }
  }

  function goBack() {
    goto('/companies');
  }
</script>

<svelte:head>
  <title>{company?.name || 'Company'} - Liffey Founders Club</title>
</svelte:head>

<div class="min-h-screen py-12">
  <div class="container mx-auto px-4 max-w-5xl">
    <!-- Back Button -->
    <button 
      class="btn btn-ghost mb-6"
      onclick={goBack}
    >
      <ArrowLeft class="w-5 h-5" />
      Back to Companies
    </button>

    <!-- Loading State -->
    {#if isLoading}
      <div class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    {/if}

    <!-- Error State -->
    {#if error}
      <div class="alert alert-error">
        <span>{error}</span>
      </div>
    {/if}

    <!-- Company Details -->
    {#if company && !isLoading}
      <!-- Company Header -->
      <div class="glass-subtle rounded-3xl p-8 mb-6">
        <div class="flex flex-col md:flex-row gap-6">
          <!-- Logo -->
          <div class="flex-shrink-0">
            {#if company.logoUrl}
              <img 
                src={company.logoUrl} 
                alt={company.name}
                class="w-24 h-24 rounded-2xl object-cover"
              />
            {:else}
              <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Building2 class="w-12 h-12 text-white" />
              </div>
            {/if}
          </div>

          <!-- Company Info -->
          <div class="flex-1">
            <h1 class="text-3xl md:text-4xl font-bold mb-2">{company.name}</h1>
            
            <div class="flex flex-wrap gap-2 mb-4">
              {#if company.industry}
                <span class="badge badge-primary">{company.industry}</span>
              {/if}
              <span class="badge badge-secondary">{stageLabels[company.stage] || company.stage}</span>
              <span class="badge badge-accent">{fundingLabels[company.fundingStage] || company.fundingStage}</span>
            </div>

            <p class="text-lg opacity-80 mb-4">{company.description}</p>

            <!-- Links -->
            <div class="flex flex-wrap gap-3">
              {#if company.website}
                <a 
                  href={company.website} 
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-sm btn-outline"
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
                  class="btn btn-sm btn-outline"
                >
                  <Linkedin class="w-4 h-4" />
                  LinkedIn
                </a>
              {/if}
              {#if company.twitterUrl}
                <a 
                  href={company.twitterUrl} 
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-sm btn-outline"
                >
                  <Twitter class="w-4 h-4" />
                  Twitter
                </a>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Company Stats -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="glass-subtle rounded-2xl p-6">
          <div class="flex items-center gap-3 mb-2">
            <Users class="w-6 h-6 text-primary" />
            <span class="text-sm opacity-70">Team Size</span>
          </div>
          <p class="text-2xl font-bold">{company.employeeCount} {company.employeeCount === 1 ? 'employee' : 'employees'}</p>
        </div>

        {#if company.location}
          <div class="glass-subtle rounded-2xl p-6">
            <div class="flex items-center gap-3 mb-2">
              <MapPin class="w-6 h-6 text-primary" />
              <span class="text-sm opacity-70">Location</span>
            </div>
            <p class="text-2xl font-bold">{company.location}</p>
          </div>
        {/if}

        {#if company.foundedDate}
          <div class="glass-subtle rounded-2xl p-6">
            <div class="flex items-center gap-3 mb-2">
              <Calendar class="w-6 h-6 text-primary" />
              <span class="text-sm opacity-70">Founded</span>
            </div>
            <p class="text-2xl font-bold">{new Date(company.foundedDate).getFullYear()}</p>
          </div>
        {/if}
      </div>

      <!-- Tags -->
      {#if company.tags && company.tags.length > 0}
        <div class="glass-subtle rounded-2xl p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">Tags</h2>
          <div class="flex flex-wrap gap-2">
            {#each company.tags as tag}
              <span class="badge badge-lg badge-outline">{tag}</span>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Wishlist -->
      {#if wishlistItems.length > 0}
        <div class="glass-subtle rounded-2xl p-6 mb-6">
          <div class="flex items-center gap-3 mb-6">
            <Target class="w-6 h-6 text-primary" />
            <h2 class="text-2xl font-bold">Company Wishlist</h2>
          </div>

          <p class="opacity-80 mb-6">
            Looking for support in the following areas:
          </p>

          <div class="space-y-4">
            {#each wishlistItems as item}
              {@const Icon = categoryIcons[item.category] || Circle}
              {@const priorityColors: Record<string, string> = {
                low: 'badge-ghost',
                medium: 'badge-info',
                high: 'badge-warning',
                critical: 'badge-error'
              }}
              
              <div class="glass-subtle rounded-xl p-4 {item.isFulfilled ? 'opacity-60' : ''}">
                <div class="flex items-start gap-4">
                  <div class="flex-shrink-0 mt-1">
                    {#if item.isFulfilled}
                      <CheckCircle class="w-6 h-6 text-success" />
                    {:else}
                      <Icon class="w-6 h-6 text-primary" />
                    {/if}
                  </div>

                  <div class="flex-1">
                    <div class="flex items-start justify-between gap-4 mb-2">
                      <h3 class="text-lg font-semibold">{item.title}</h3>
                      <div class="flex gap-2">
                        <span class="badge badge-sm {priorityColors[item.priority] || 'badge-ghost'}">{item.priority}</span>
                        <span class="badge badge-sm badge-outline capitalize">{item.category}</span>
                      </div>
                    </div>
                    
                    {#if item.description}
                      <p class="opacity-80">{item.description}</p>
                    {/if}

                    {#if item.isFulfilled}
                      <span class="text-success text-sm mt-2 inline-block">✓ Fulfilled</span>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Contact Section -->
      <div class="glass-subtle rounded-2xl p-6 text-center">
        <h2 class="text-2xl font-bold mb-4">Interested in connecting?</h2>
        <p class="opacity-80 mb-6">
          Reach out through the Liffey Founders Club community or contact the founder directly.
        </p>
        {#if $authStore.isAuthenticated}
          <button class="btn btn-primary">
            Send Message
          </button>
        {:else}
          <button class="btn btn-primary" onclick={() => goto('/auth')}>
            Sign In to Connect
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>
