
<script lang="ts">
  import { routeOpacity } from '$lib/transitions';
  import '../app.css';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Home, Mic, Info, Sun, Moon, X, Menu, Wallet, User, Grid, Building2, Target, CreditCard, Trophy, Settings, ShieldCheck } from 'lucide-svelte';
  import Web3Modal from '$lib/components/Web3Modal.svelte';
  import { walletStore, formattedAddress } from '$lib/stores/walletStore';
  import { authStore } from '$lib/stores/auth';
  import Toast from '$lib/components/Toast.svelte';
  import type { Snippet } from 'svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  
  interface Props {
    children: Snippet;
  }
  
  let { children }: Props = $props();
  
  // Web3 Modal state
  let showWeb3Modal = $state(false);
  
  // User companies state for bounties access control
  let userCompanies = $state<any[]>([]);
  let companiesFetched = $state(false);
  
  // Force refresh companies (exported for use after company creation)
  export function refreshUserCompanies() {
    companiesFetched = false;
    fetchUserCompanies();
  }
  
  function openWeb3Modal() {
    showWeb3Modal = true;
    fabOpen = false;
  }

  let mounted = false;
  let fabContainer: HTMLElement;
  let bannerVisible = $state(true);
  let lastScrollY = 0;
  
  // Fetch user's companies to determine bounties access
  async function fetchUserCompanies() {
    if (!$authStore.isAuthenticated) return;
    
    try {
      const response = await fetch(`${PUBLIC_API_URL}/companies/my-companies`, {
        headers: { Authorization: `Bearer ${$authStore.accessToken}` },
        credentials: 'include',
      });
      
      if (response.ok) {
        const result = await response.json();
        userCompanies = result.data || [];
        companiesFetched = true;
        console.log('Fetched user companies:', userCompanies.length);
      }
    } catch (error) {
      console.error('Failed to fetch user companies:', error);
    }
  }
  
  onMount(() => { 
    mounted = true;
    
    // Fetch companies if user is authenticated
    if ($authStore.isAuthenticated) {
      fetchUserCompanies();
    }
    
    // Listen for custom event to refresh companies
    const handleRefresh = () => {
      console.log('Refreshing user companies from event');
      companiesFetched = false;
      fetchUserCompanies();
    };
    window.addEventListener('refresh-user-companies', handleRefresh);
    
    // Initialize theme
    if (typeof window !== 'undefined') {
      const current = document.documentElement.getAttribute('data-theme');
      if (current !== selectedTheme) setTheme(selectedTheme);
    }
    
    // Close FAB when clicking outside (with small delay to prevent immediate closure)
    const handleClickOutside = (event: MouseEvent) => {
      if (fabOpen && fabContainer && !fabContainer.contains(event.target as Node)) {
        fabOpen = false;
      }
    };
    
    // Add listener with a small delay to avoid capturing the initial click
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
    
    // Banner scroll hide/show logic
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show banner when scrolling up or at top
      if (currentScrollY < lastScrollY || currentScrollY < 100) {
        bannerVisible = true;
      } 
      // Hide banner when scrolling down past threshold
      else if (currentScrollY > lastScrollY && currentScrollY > 200) {
        bannerVisible = false;
      }
      
      lastScrollY = currentScrollY;
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('refresh-user-companies', handleRefresh);
    };
  });
  
  let selectedTheme = $state(typeof window !== 'undefined' && window.localStorage.getItem('theme') || 'light');
  function setTheme(theme: string) {
    selectedTheme = theme;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      window.localStorage.setItem('theme', theme);
    }
  }
  
  // FAB logic
  let fabOpen = $state(false);
  let group1Open = $state(false);
  let group2Open = $state(false);
  let group3Open = $state(false);
  
  // Toggle FAB with event stopping
  function toggleFab(event: MouseEvent) {
    event.stopPropagation();
    fabOpen = !fabOpen;
  }
  
  let showShell = $state(true);
  let pendingNav: string | null = null;
  function navTo(path: string) {
    if (pendingNav) return; // ignore double-clicks
    pendingNav = path;
    showShell = false; // trigger outro on wrapper
    fabOpen = false;
  }
  
  // Sign out handler for FAB -> calls auth store logout and navigate home
  function signOut() {
    // trigger logout (revokes tokens client-side and calls backend revoke if supported)
    authStore.logout();
    // reuse nav flow to preserve outro animation
    navTo('/');
  }
  function onShellOutro() {
    const target = pendingNav;
    pendingNav = null;
    showShell = true; // re-show wrapper for next route
    if (target) goto(target);
  }
  
  // Reactive effect to fetch companies when auth state changes
  $effect(() => {
    if ($authStore.isAuthenticated && !companiesFetched) {
      fetchUserCompanies();
    } else if (!$authStore.isAuthenticated) {
      // Reset companies when logged out
      userCompanies = [];
      companiesFetched = false;
    }
  });
</script>

<svelte:head>
  <!-- Meta - Prevent Search Template URL Indexing -->
  <meta name="robots" content="index, follow, noodp, noydir" />
  
  <!-- Favicons - Multi-platform support -->
  <link rel="icon" type="image/x-icon" href="/img/favicon_io/favicon.ico" />
  <link rel="icon" type="image/png" sizes="16x16" href="/img/favicon_io/favicon-16x16.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/img/favicon_io/favicon-32x32.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/img/favicon_io/apple-touch-icon.png" />
  <link rel="manifest" href="/img/favicon_io/site.webmanifest" />
  
  <!-- Organization Structured Data - Enhanced for Knowledge Panel -->
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Liffey Founders Club",
      "alternateName": ["Liffey FC", "Liffey Founders"],
      "url": "https://liffeyfoundersclub.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://liffeyfoundersclub.com/img/logo/Liffey_Founders_Club_Logo.png",
        "width": 1668,
        "height": 2388,
        "caption": "Liffey Founders Club Logo"
      },
      "image": "https://liffeyfoundersclub.com/img/logo/Liffey_Founders_Club_Logo.png",
      "description": "Dublin's premier startup community for founders, entrepreneurs, and investors. Practice your pitch, connect with the community, and grow your business.",
      "disambiguatingDescription": "Startup community and events platform in Dublin, Ireland for practicing pitches, connecting with investors, and networking with entrepreneurs.",
      "foundingDate": "2024",
      "foundingLocation": {
        "@type": "Place",
        "name": "Dublin",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Dublin",
          "addressCountry": "IE"
        }
      },
      "areaServed": {
        "@type": "Place",
        "name": "Dublin, Ireland"
      },
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Dublin",
        "addressCountry": "IE"
      },
      "sameAs": [
        "https://www.linkedin.com/company/liffey-founders-club/",
        "https://lu.ma/event/evt-Hs6RP2j7Bkc8jGQ"
      ],
      "contactPoint": [
        {
          "@type": "ContactPoint",
          "contactType": "Event Registration",
          "url": "https://liffeyfoundersclub.com/learnMore",
          "name": "Register Interest"
        },
        {
          "@type": "ContactPoint",
          "contactType": "Information",
          "url": "https://liffeyfoundersclub.com/",
          "name": "Learn More"
        }
      ],
      "hasOfferingDescription": [
        {
          "@type": "OfferingDescription",
          "name": "Startup Pitch Events",
          "description": "Quarterly events for entrepreneurs to practice pitches and connect with investors",
          "url": "https://liffeyfoundersclub.com/pitch"
        },
        {
          "@type": "OfferingDescription",
          "name": "Community Networking",
          "description": "Connect with founders, investors, and startup enthusiasts in Dublin",
          "url": "https://liffeyfoundersclub.com/"
        },
        {
          "@type": "OfferingDescription",
          "name": "Event Registration",
          "description": "Register to attend our upcoming startup events",
          "url": "https://liffeyfoundersclub.com/learnMore"
        }
      ],
      "knowsAbout": [
        "Startup Pitching",
        "Entrepreneurship",
        "Venture Capital",
        "Angel Investment",
        "Business Networking",
        "Startup Community",
        "Innovation",
        "Dublin Startups",
        "Tech Entrepreneurs",
        "Startup Events"
      ]
    }
  </script>
  
  <!-- Website Structured Data -->
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Liffey Founders Club",
      "url": "https://liffeyfoundersclub.com"
    }
  </script>
</svelte:head>


	<main class="pt-20 sm:pt-24 md:pt-28 flex flex-col min-h-screen">
  <!-- Sponsors Moving Banner -->
  <div 
    class="fixed top-0 left-0 right-0 w-full py-3 sm:py-3.5 md:py-4 overflow-hidden glass-subtle z-50 transition-transform duration-300 ease-in-out"
    class:-translate-y-full={!bannerVisible}
  >
    <div class="flex animate-scroll space-x-8 sm:space-x-10 md:space-x-12 lg:space-x-16 xl:space-x-20">
      {#each [1, 2, 3, 4, 5] as group}
        <div class="flex space-x-8 sm:space-x-10 md:space-x-12 lg:space-x-16 xl:space-x-20 flex-shrink-0">
          <!-- Fire and 5th -->
          <a href="https://fireand5th.com" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center justify-center min-w-[100px] sm:min-w-[120px] md:min-w-[140px] hover:scale-105 transition-transform duration-200">
            <img src="/img/logo/Fire5th-Arrow2_260x.avif" alt="Fire and 5th Logo" class="h-6 sm:h-7 md:h-8 lg:h-10 mb-1.5 sm:mb-2 object-contain" />
            <div class="text-center">
              <div class="text-[10px] sm:text-xs font-bold text-primary">Fire and 5th</div>
            </div>
          </a>
          
          <!-- Avalanche -->
          <a href="https://www.avax.network/" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center justify-center min-w-[100px] sm:min-w-[120px] md:min-w-[140px] hover:scale-105 transition-transform duration-200">
            <img src="/img/logo/avalanche_logo.png" alt="Avalanche Logo" class="h-6 sm:h-7 md:h-8 lg:h-10 mb-1.5 sm:mb-2 object-contain" />
            <div class="text-center">
              <div class="text-[10px] sm:text-xs font-bold text-fuchsia-600">Avalanche</div>
            </div>
          </a>
          
          <!-- Baseline -->
          <a href="https://www.baseline.community/" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center justify-center min-w-[100px] sm:min-w-[120px] md:min-w-[140px] hover:scale-105 transition-transform duration-200">
            <img src="/img/logo/baseline.png" alt="Baseline Logo" class="h-6 sm:h-7 md:h-8 lg:h-10 mb-1.5 sm:mb-2 object-contain" />
            <div class="text-center">
              <div class="text-[10px] sm:text-xs font-bold text-cyan-600">Baseline</div>
            </div>
          </a>

          <a href="https://boldbitcoinwallet.com/" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center justify-center min-w-[100px] sm:min-w-[120px] md:min-w-[140px] hover:scale-105 transition-transform duration-200">
            <img src="/img/logo/boldbitcoinwallet.png" alt="Bold Bitcoin Wallet Logo" class="h-6 sm:h-7 md:h-8 lg:h-10 mb-1.5 sm:mb-2 object-contain" />
            <div class="text-center">
              <div class="text-[10px] sm:text-xs font-bold text-emerald-600">Bold Bitcoin Wallet</div>
            </div>
          </a>

          <!-- Zingibeer -->
          <a href="https://zingibeer.ie/" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center justify-center min-w-[100px] sm:min-w-[120px] md:min-w-[140px] hover:scale-105 transition-transform duration-200">
            <img src="/img/logo/zingibeer_logo.webp" alt="Zingibeer Logo" class="h-6 sm:h-7 md:h-8 lg:h-10 mb-1.5 sm:mb-2 object-contain" />
            <div class="text-center">
              <div class="text-[10px] sm:text-xs font-bold text-secondary">Zingibeer</div>
            </div>
          </a>
        </div>
      {/each}
    </div>
  </div>

  {#if showShell}
    <div in:routeOpacity={{ delay: 100, duration: 620 }} out:routeOpacity onoutroend={onShellOutro} class="flex-1">
      {@render children()}
    </div>
  {/if}

  <!-- Footer - now within flex container, will push to bottom -->
  <footer class="bg-base-200 text-base-content py-10 mt-auto">
    <div class="container mx-auto px-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6 justify-items-center md:justify-items-stretch">
        <!-- About -->
        <div class="text-center md:text-left">
          <h3 class="text-lg font-semibold mb-3">About Liffey Founders Club</h3>
          <p class="text-sm text-base-content/70">Dublin's premier startup community for founders, entrepreneurs, and investors.</p>
        </div>
        
        <!-- Quick Links -->
        <div class="text-center">
          <h3 class="text-lg font-semibold mb-3">Quick Links</h3>
          <ul class="space-y-2 flex flex-col items-center">
            <li><a href="/" class="hover:text-primary transition-colors" data-sveltekit-prefetch aria-label="Home">Home</a></li>
            <li><a href="/pitch" class="hover:text-primary transition-colors" data-sveltekit-prefetch aria-label="Pitch">Pitch</a></li>
            <li><a href="/learnMore" class="hover:text-primary transition-colors" data-sveltekit-prefetch aria-label="Learn More">Learn More</a></li>
          </ul>
        </div>
        
        <!-- Social Links -->
        <div class="text-center md:text-right">
          <h3 class="text-lg font-semibold mb-3">Connect</h3>
          <ul class="space-y-2">
            <li><a href="https://www.linkedin.com/company/liffey-founders-club/" target="_blank" rel="external" class="hover:text-primary transition-colors" aria-label="LinkedIn">LinkedIn</a></li>
            <li><a href="https://luma.com/xd6tye51" target="_blank" rel="external" class="hover:text-primary transition-colors" aria-label="Luma">Luma</a></li>
          </ul>
        </div>
      </div>
      
      <!-- Copyright -->
      <div class="text-center text-sm text-base-content/60 pt-6 border-t border-base-300">
        <p>&copy; {new Date().getFullYear()} Liffey Founders Club. All rights reserved.</p>
      </div>
    </div>
  </footer>

  <!-- Floating Action Button (FAB) Navigation - Mobile Optimized -->
  <div bind:this={fabContainer} class="fixed fab-container bottom-6 right-6 md:bottom-8 md:right-8 z-[9999] flex flex-col items-end gap-2">
    {#if fabOpen}
      <div
        class="fab-menu flex flex-col items-start mb-2 p-2 md:p-3 rounded-2xl glass-fab animate-fade-in w-48 md:w-52 max-h-[80vh] overflow-y-auto"
        role="menu"
        aria-label="Navigation menu"
      >

        <!-- ── GROUP 1: Explore ─────────────────────────────── -->
        <button
          class="w-full flex items-center justify-between px-2 py-1.5 mb-1 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-xs font-semibold uppercase tracking-wide text-primary"
          onclick={() => (group1Open = !group1Open)}
          aria-expanded={group1Open}
        >
          <span>Explore</span>
          <span class="transition-transform duration-300" style="display:inline-block;transform:rotate({group1Open ? 90 : 0}deg)">▸</span>
        </button>

        {#if group1Open}
          <div class="w-full flex flex-col gap-1 mb-2 pl-1 animate-slide-down">
            <button class="btn glass-fab btn-neon-cool w-full flex items-center justify-start gap-2 border-0 hover:scale-[1.03] transition-all duration-200 text-xs py-1.5 px-2 min-h-0 h-auto" onclick={() => navTo('/')}>
              <Home size={14} class="flex-shrink-0"/>
              <span>Home</span>
            </button>
            {#if $authStore.isAuthenticated}
              <button class="btn glass-fab btn-neon-cool w-full flex items-center justify-start gap-2 border-0 hover:scale-[1.03] transition-all duration-200 text-xs py-1.5 px-2 min-h-0 h-auto" onclick={() => navTo('/companies')}>
                <Building2 size={14} class="flex-shrink-0"/>
                <span>Companies</span>
              </button>
              <button class="btn glass-fab btn-neon-cool w-full flex items-center justify-start gap-2 border-0 hover:scale-[1.03] transition-all duration-200 text-xs py-1.5 px-2 min-h-0 h-auto" onclick={() => navTo('/leaderboard')}>
                <Trophy size={14} class="flex-shrink-0"/>
                <span>Leaderboard</span>
              </button>
              {#if userCompanies.length > 0}
                <button class="btn glass-fab btn-neon-cool w-full flex items-center justify-start gap-2 border-0 hover:scale-[1.03] transition-all duration-200 text-xs py-1.5 px-2 min-h-0 h-auto" onclick={() => navTo('/bounties')}>
                  <Target size={14} class="flex-shrink-0"/>
                  <span>Bounties</span>
                </button>
              {/if}
              {#if $authStore.user?.role === 'staff' || $authStore.user?.userType === 'staff'}
                <button class="btn glass-fab btn-neon-cool w-full flex items-center justify-start gap-2 border-0 hover:scale-[1.03] transition-all duration-200 text-xs py-1.5 px-2 min-h-0 h-auto" onclick={() => navTo('/admin')}>
                  <ShieldCheck size={14} class="flex-shrink-0"/>
                  <span>Admin</span>
                </button>
              {/if}
            {:else}
              <button class="btn glass-fab btn-neon-cool w-full flex items-center justify-start gap-2 border-0 hover:scale-[1.03] transition-all duration-200 text-xs py-1.5 px-2 min-h-0 h-auto" onclick={() => navTo('/pitch')}>
                <Mic size={14} class="flex-shrink-0"/>
                <span>Pitch</span>
              </button>
              <button class="btn glass-fab btn-neon-cool w-full flex items-center justify-start gap-2 border-0 hover:scale-[1.03] transition-all duration-200 text-xs py-1.5 px-2 min-h-0 h-auto" onclick={() => navTo('/learnMore')}>
                <Info size={14} class="flex-shrink-0"/>
                <span>Learn More</span>
              </button>
            {/if}
          </div>
        {/if}

        <!-- ── GROUP 2: My Account ──────────────────────────── -->
        <button
          class="w-full flex items-center justify-between px-2 py-1.5 mb-1 rounded-lg bg-secondary/10 hover:bg-secondary/20 transition-colors text-xs font-semibold uppercase tracking-wide text-secondary"
          onclick={() => (group2Open = !group2Open)}
          aria-expanded={group2Open}
        >
          <span>My Account</span>
          <span class="transition-transform duration-300" style="display:inline-block;transform:rotate({group2Open ? 90 : 0}deg)">▸</span>
        </button>

        {#if group2Open}
          <div class="w-full flex flex-col gap-1 mb-2 pl-1 animate-slide-down">
            {#if $authStore.isAuthenticated}
              <button class="btn glass-fab btn-neon-cool w-full flex items-center justify-start gap-2 border-0 hover:scale-[1.03] transition-all duration-200 text-xs py-1.5 px-2 min-h-0 h-auto" onclick={() => navTo('/buy-crypto')}>
                <CreditCard size={14} class="flex-shrink-0"/>
                <span>Buy Crypto</span>
              </button>
              <button class="btn glass-fab btn-neon-cool w-full flex items-center justify-start gap-2 border-0 hover:scale-[1.03] transition-all duration-200 text-xs py-1.5 px-2 min-h-0 h-auto" onclick={() => navTo('/dashboard')}>
                <Grid size={14} class="flex-shrink-0"/>
                <span>Dashboard</span>
              </button>
              <button class="btn glass-fab btn-neon-cool w-full flex items-center justify-start gap-2 border-0 hover:scale-[1.03] transition-all duration-200 text-xs py-1.5 px-2 min-h-0 h-auto" onclick={() => navTo('/profile')}>
                <User size={14} class="flex-shrink-0"/>
                <span class="truncate max-w-[7rem]">{$authStore.user?.name ?? 'Profile'}</span>
              </button>
            {:else}
              <button class="btn glass-fab btn-neon-cool w-full flex items-center justify-start gap-2 border-0 hover:scale-[1.03] transition-all duration-200 text-xs py-1.5 px-2 min-h-0 h-auto" onclick={() => navTo('/auth')}>
                <User size={14} class="flex-shrink-0"/>
                <span>Sign In</span>
              </button>
            {/if}
          </div>
        {/if}

        <!-- ── GROUP 3: Preferences ────────────────────────── -->
        {#if $authStore.isAuthenticated}
          <button
            class="w-full flex items-center justify-between px-2 py-1.5 mb-1 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors text-xs font-semibold uppercase tracking-wide text-accent"
            onclick={() => (group3Open = !group3Open)}
            aria-expanded={group3Open}
          >
            <span>Preferences</span>
            <span class="transition-transform duration-300" style="display:inline-block;transform:rotate({group3Open ? 90 : 0}deg)">▸</span>
          </button>

          {#if group3Open}
            <div class="w-full flex flex-col gap-1 mb-2 pl-1 animate-slide-down">
              <button class="btn glass-fab btn-neon-cool w-full flex items-center justify-start gap-2 border-0 hover:scale-[1.03] transition-all duration-200 text-xs py-1.5 px-2 min-h-0 h-auto" onclick={() => navTo('/settings')}>
                <Settings size={14} class="flex-shrink-0"/>
                <span>Settings</span>
              </button>
              <button class="btn glass-fab btn-neon-cool w-full flex items-center justify-start gap-2 border-0 hover:scale-[1.03] transition-all duration-200 text-xs py-1.5 px-2 min-h-0 h-auto" onclick={() => signOut()}>
                <span>Sign Out</span>
              </button>
            </div>
          {/if}
        {/if}

        <!-- ── Wallet summary + Theme toggle ──────────────── -->
        <div class="w-full border-t border-base-300/40 pt-2 mt-1 flex flex-col items-center gap-1.5">
          {#if $walletStore.isConnected}
            <div class="w-full text-xs text-base-content/70 text-center truncate">
              <div class="font-medium text-base-content truncate">{$formattedAddress}</div>
              <div>{$walletStore.balance ?? '—'} {$walletStore.chainName ?? ''}</div>
            </div>
          {/if}
          <button
            class="btn btn-circle glass-fab border-0 hover:scale-110 transition-all duration-300 w-8 h-8"
            aria-label="Toggle light/dark theme"
            onclick={() => setTheme(selectedTheme === 'light' ? 'dark' : 'light')}
          >
            {#if selectedTheme === 'light'}
              <Moon class="h-4 w-4"/>
            {:else}
              <Sun class="h-4 w-4"/>
            {/if}
          </button>
        </div>

      </div>
    {/if}
    <button
      class="fab-button btn btn-circle glass-fab text-base-content shadow-lg hover:scale-110 transition-all duration-300 flex items-center justify-center ring-2 ring-primary/30 border-0 backdrop-blur-xl w-14 h-14 md:w-[4.5rem] md:h-[4.5rem]"
      style="border-radius:50%;"
      aria-label="Open navigation menu"
      onclick={(e) => toggleFab(e)}
    >
      {#if fabOpen}
        <X class="h-7 w-7 md:h-10 md:w-10" stroke-width={2.5} />
      {:else}
        <Menu class="h-7 w-7 md:h-10 md:w-10" stroke-width={2.5} />
      {/if}
    </button>
  </div>

  <!-- Web3 Modal -->
  <Web3Modal bind:isOpen={showWeb3Modal} />
  <!-- Global Toasts -->
  <Toast />
</main>