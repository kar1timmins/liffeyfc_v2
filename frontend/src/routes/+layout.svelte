
<script lang="ts">
  import { river } from '$lib/river';
  const transition = (node: Element, params = {}) => river(node, params);
  // Ensure Tailwind/DaisyUI styles are bundled
  import '../app.css';

  // DaisyUI theme toggle logic (light/dark only)
  import { goto } from '$app/navigation';
  let selectedTheme = typeof window !== 'undefined' && window.localStorage.getItem('theme') || 'light';
  function setTheme(theme: string) {
    selectedTheme = theme;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      window.localStorage.setItem('theme', theme);
    }
  }
  if (typeof window !== 'undefined') {
    setTheme(selectedTheme);
  }
  // FAB logic
  let fabOpen = false;
  function navTo(path: string) {
    goto(path);
    fabOpen = false;
  }
</script>



<main in:transition out:transition class="min-h-screen bg-base-200 overflow-hidden">
  <slot />

  <!-- Floating Action Button (FAB) Navigation -->
  <div class="fixed bottom-8 right-8 z-[9999] flex flex-col items-end gap-2">
    {#if fabOpen}
      <div class="flex flex-col items-center mb-2 p-3 rounded-2xl shadow-xl bg-base-200 ring-2 ring-accent/40 animate-fade-in">
        <button class="btn btn-primary w-40 mb-2" on:click={() => navTo('/')}>🏠 Home</button>
        <button class="btn btn-accent w-40 mb-2" on:click={() => navTo('/pitch')}>🎤 Pitch</button>
        <button class="btn btn-info w-40 mb-2" on:click={() => navTo('/learnMore')}>ℹ️ Learn More</button>
        <div class="w-full flex flex-col items-center mt-2">
          <button
            class="btn btn-circle btn-outline btn-primary"
            aria-label="Toggle light/dark theme"
            on:click={() => setTheme(selectedTheme === 'light' ? 'dark' : 'light')}
          >
            {#if selectedTheme === 'light'}
              <!-- Sun icon -->
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364l-1.414 1.414M6.05 17.95l-1.414 1.414M17.95 17.95l-1.414-1.414M6.05 6.05L4.636 7.464" /><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2" fill="none"/></svg>
            {:else}
              <!-- Crescent moon icon -->
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/></svg>
            {/if}
          </button>
        </div>
      </div>
    {/if}
    <button
      class="btn btn-circle btn-xl bg-primary text-primary-content shadow-lg hover:scale-110 transition-all duration-300 flex items-center justify-center text-3xl ring-4 ring-accent/70 border-none"
      style="width:4.5rem;height:4.5rem;border-radius:50%;"
      aria-label="Open navigation menu"
      on:click={() => fabOpen = !fabOpen}
    >
      {#if fabOpen}
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
      {/if}
    </button>
  </div>
</main>