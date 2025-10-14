
<script lang="ts">
  import { routeOpacity } from '$lib/transitions';
  import '../app.css';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Home, Mic, Info, Sun, Moon, X, Menu, Wallet } from 'lucide-svelte';
  
  // Simple wallet connect without Web3Modal to avoid build-time dependency issues
  let account = '';
  async function open() {
    try {
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        console.warn('No injected wallet found');
        return;
      }
      const accounts: string[] = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      account = accounts?.[0] ?? '';
    } catch (e) {
      console.error('Wallet connect failed', e);
    }
  }

  let mounted = false;
  let fabContainer: HTMLElement;
  
  onMount(() => { 
    mounted = true;
    
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
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
  
  let selectedTheme = typeof window !== 'undefined' && window.localStorage.getItem('theme') || 'light';
  function setTheme(theme: string) {
    selectedTheme = theme;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      window.localStorage.setItem('theme', theme);
    }
  }
  if (typeof window !== 'undefined') {
    // Only apply if missing or different to avoid repaint on hydration
    const current = document.documentElement.getAttribute('data-theme');
    if (current !== selectedTheme) setTheme(selectedTheme);
  }
  // Icons
  // FAB logic
  let fabOpen = false;
  
  // Toggle FAB with event stopping
  function toggleFab(event: MouseEvent) {
    event.stopPropagation();
    fabOpen = !fabOpen;
  }
  
  let showShell = true;
  let pendingNav: string | null = null;
  function navTo(path: string) {
    if (pendingNav) return; // ignore double-clicks
    pendingNav = path;
    showShell = false; // trigger outro on wrapper
    fabOpen = false;
  }
  function onShellOutro() {
    const target = pendingNav;
    pendingNav = null;
    showShell = true; // re-show wrapper for next route
    if (target) goto(target);
  }
</script>

<svelte:head>
  <!-- Favicons - Multi-platform support -->
  <link rel="icon" type="image/x-icon" href="/img/favicon_io/favicon.ico" />
  <link rel="icon" type="image/png" sizes="16x16" href="/img/favicon_io/favicon-16x16.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/img/favicon_io/favicon-32x32.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/img/favicon_io/apple-touch-icon.png" />
  <link rel="manifest" href="/img/favicon_io/site.webmanifest" />
  
  <!-- Organization Structured Data -->
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Liffey Founders Club",
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
      "foundingDate": "2024",
      "sameAs": [
        "https://www.linkedin.com/company/liffey-founders-club/",
        "https://lu.ma/event/evt-Hs6RP2j7Bkc8jGQ"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "Event Registration",
        "url": "https://liffeyfoundersclub.com/learnMore"
      }
    }
  </script>
  
  <!-- Website Structured Data -->
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Liffey Founders Club",
      "url": "https://liffeyfoundersclub.com",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://liffeyfoundersclub.com/?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    }
  </script>
</svelte:head>


<main class="min-h-screen overflow-hidden">
  {#if showShell}
    <div in:routeOpacity={{ delay: 100, duration: 620 }} out:routeOpacity on:outroend={onShellOutro}>
      <slot />
    </div>
  {/if}

  <!-- Footer with internal navigation for SEO -->
  <footer class="bg-base-200/50 backdrop-blur-sm mt-auto py-8 px-4 border-t border-base-300">
    <div class="max-w-6xl mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
        <!-- About Section -->
        <div class="text-center md:text-left">
          <h3 class="text-lg font-semibold mb-3">Liffey Founders Club</h3>
          <p class="text-sm text-base-content/80">
            Liffey Founders Club is a premier, private, invite-only community for visionary founders and innovators in Ireland, dedicated to fostering collaboration and driving success.
          </p>
        </div>
        
        <!-- Quick Links -->
        <div class="text-center">
          <h3 class="text-lg font-semibold mb-3">Quick Links</h3>
          <ul class="space-y-2">
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
            <li><a href="https://lu.ma/event/evt-Hs6RP2j7Bkc8jGQ" target="_blank" rel="external" class="hover:text-primary transition-colors" aria-label="Luma">Luma</a></li>
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
      <div class="fab-menu flex flex-col items-center mb-2 p-2 md:p-3 rounded-2xl glass-subtle animate-fade-in w-44 md:w-48">
        <button class="btn glass-subtle btn-neon-cool w-full mb-2 flex items-center justify-center gap-2 border-0 hover:scale-105 transition-all duration-300 text-sm md:text-base" on:click={() => navTo('/')}>
          <Home size={16} class="md:w-[18px] md:h-[18px]"/> 
          Home
        </button>
        <button class="btn glass-subtle btn-neon-cool w-full mb-2 flex items-center justify-center gap-2 border-0 hover:scale-105 transition-all duration-300 text-sm md:text-base" on:click={() => navTo('/pitch')}>
          <Mic size={16} class="md:w-[18px] md:h-[18px]"/> 
          Pitch
        </button>
        <button class="btn glass-subtle btn-neon-cool w-full mb-2 flex items-center justify-center gap-2 border-0 hover:scale-105 transition-all duration-300 text-sm md:text-base" on:click={() => navTo('/learnMore')}>
          <Info size={16} class="md:w-[18px] md:h-[18px]"/> 
          Learn More
        </button>
        <button on:click={open} class="btn glass-subtle btn-neon-subtle w-full mb-2 flex items-center justify-center gap-2 border-0 hover:scale-105 transition-all duration-300 text-sm md:text-base">
          <Wallet size={16} class="md:w-[18px] md:h-[18px]" />
          Connect Wallet
        </button>
        <div class="w-full flex flex-col items-center mt-2">
          <button
            class="btn btn-circle glass-subtle border-0 hover:scale-110 transition-all duration-300 w-10 h-10 md:w-12 md:h-12"
            aria-label="Toggle light/dark theme"
            on:click={() => setTheme(selectedTheme === 'light' ? 'dark' : 'light')}
          >
            {#if selectedTheme === 'light'}
              <Sun class="h-5 w-5 md:h-6 md:w-6" />
            {:else}
              <Moon class="h-5 w-5 md:h-6 md:w-6" />
            {/if}
          </button>
        </div>
      </div>
    {/if}
    <button
      class="fab-button btn btn-circle glass-subtle text-base-content shadow-lg hover:scale-110 transition-all duration-300 flex items-center justify-center ring-2 ring-base-content/20 border-0 backdrop-blur-xl w-14 h-14 md:w-[4.5rem] md:h-[4.5rem]"
      style="border-radius:50%;"
      aria-label="Open navigation menu"
      on:click={toggleFab}
    >
      {#if fabOpen}
        <X class="h-7 w-7 md:h-10 md:w-10" stroke-width={2.5} />
      {:else}
        <Menu class="h-7 w-7 md:h-10 md:w-10" stroke-width={2.5} />
      {/if}
    </button>
  </div>
</main>