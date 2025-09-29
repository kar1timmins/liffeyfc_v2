
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
  onMount(() => { mounted = true; });
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



<main class="min-h-screen overflow-hidden">
  {#if showShell}
    <div in:routeOpacity={{ delay: 100, duration: 620 }} out:routeOpacity on:outroend={onShellOutro}>
      <slot />
    </div>
  {/if}

  <!-- Floating Action Button (FAB) Navigation - Mobile Optimized -->
  <div class="fixed fab-container bottom-6 right-6 md:bottom-8 md:right-8 z-[9999] flex flex-col items-end gap-2">
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
      on:click={() => fabOpen = !fabOpen}
    >
      {#if fabOpen}
        <X class="h-7 w-7 md:h-10 md:w-10" stroke-width={2.5} />
      {:else}
        <Menu class="h-7 w-7 md:h-10 md:w-10" stroke-width={2.5} />
      {/if}
    </button>
  </div>
</main>