
<script lang="ts">
  import { routeOpacity } from '$lib/transitions';
  import '../app.css';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Home, Mic, Info, Sun, Moon, X, Menu, CheckCircle2, AlertTriangle, ArrowLeftRight } from 'lucide-svelte';

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

  <!-- Floating Action Button (FAB) Navigation -->
  <div class="fixed bottom-8 right-8 z-[9999] flex flex-col items-end gap-2">
    {#if fabOpen}
      <div class="flex flex-col items-center mb-2 p-3 rounded-2xl glass-subtle animate-fade-in">
  <button class="btn glass-subtle btn-neon-cool w-40 mb-2 flex items-center gap-2 border-0 hover:scale-105 transition-all duration-300" on:click={() => navTo('/')}><Home size={18}/> Home</button>
  <button class="btn glass-subtle btn-neon-cool w-40 mb-2 flex items-center gap-2 border-0 hover:scale-105 transition-all duration-300" on:click={() => navTo('/pitch')}><Mic size={18}/> Pitch</button>
  <button class="btn glass-subtle btn-neon-cool w-40 mb-2 flex items-center gap-2 border-0 hover:scale-105 transition-all duration-300" on:click={() => navTo('/learnMore')}><Info size={18}/> Learn More</button>
        <div class="w-full flex flex-col items-center mt-2">
          <button
            class="btn btn-circle glass-subtle border-0 hover:scale-110 transition-all duration-300"
            aria-label="Toggle light/dark theme"
            on:click={() => setTheme(selectedTheme === 'light' ? 'dark' : 'light')}
          >
            {#if selectedTheme === 'light'}
              <Sun class="h-6 w-6" />
            {:else}
              <Moon class="h-6 w-6" />
            {/if}
          </button>
        </div>
      </div>
    {/if}
    <button
      class="btn btn-circle btn-xl glass-subtle text-base-content shadow-lg hover:scale-110 transition-all duration-300 flex items-center justify-center text-3xl ring-2 ring-base-content/20 border-0 backdrop-blur-xl"
      style="width:4.5rem;height:4.5rem;border-radius:50%;"
      aria-label="Open navigation menu"
      on:click={() => fabOpen = !fabOpen}
    >
      {#if fabOpen}
        <X class="h-10 w-10" stroke-width={2.5} />
      {:else}
        <Menu class="h-10 w-10" stroke-width={2.5} />
      {/if}
    </button>
  </div>
</main>