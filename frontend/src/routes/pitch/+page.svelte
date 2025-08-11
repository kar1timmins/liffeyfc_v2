<script lang="ts">
  import { onMount } from 'svelte';
  import { river } from '$lib/river';

  const images = ['/img/image_3.jpg', '/img/image_3.jpg', '/img/image_3.jpg'];
  let current = 0;
  let interval: ReturnType<typeof setInterval>;

  let showCarousel = true;
  let showStats = false;

  function next() {
    current = (current + 1) % images.length;
  }
  function prev() {
    current = (current - 1 + images.length) % images.length;
  }

  onMount(() => {
    interval = setInterval(next, 3500);
    return () => clearInterval(interval);
  });

  function revealStats() {
    showCarousel = false;
    setTimeout(() => {
      showStats = true;
    }, 600); // match river transition duration
  }

  function goTo(i: number) {
    current = i;
  }


  import { goto } from '$app/navigation';
  let fabOpen = false;


  function navTo(path: string) {
    goto(path);
  }

  // DaisyUI theme toggle logic
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

  // --- Sequential video fade-in logic for Event Highlights background ---
  let showStatsVideos = [false, false, false, false, false];
  $: if (showStats) {
    showStatsVideos = [false, false, false, false, false];
    for (let i = 0; i < 5; i++) {
      setTimeout(() => showStatsVideos[i] = true, i * 1200);
    }
  }
</script>


{#if showCarousel}
  <div in:river out:river>
    <section class="py-16 px-4 max-w-4xl mx-auto">
      <h2 class="text-4xl md:text-5xl font-extrabold mb-10 text-center tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent drop-shadow-lg">
        Visualize Your Pitch
      </h2>

      <div class="relative w-full h-[420px] flex items-center justify-center">
        <div class="relative w-full h-full bg-white/80 dark:bg-slate-900/80 rounded-3xl shadow-2xl overflow-hidden flex items-center justify-center border border-accent/20 backdrop-blur-md">
          <button aria-label="Previous" class="absolute left-4 top-1/2 -translate-y-1/2 btn btn-circle btn-md z-10 bg-white/90 hover:bg-accent/80 shadow-lg border border-accent/30" on:click={prev}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          {#each images as img, i}
            {#if i === current}
              <img src={img} class="w-full h-full object-cover transition-all duration-700 rounded-3xl shadow-xl" alt="Pitch Slide {i + 1}" />
            {/if}
          {/each}
          <button aria-label="Next" class="absolute right-4 top-1/2 -translate-y-1/2 btn btn-circle btn-md z-10 bg-white/90 hover:bg-accent/80 shadow-lg border border-accent/30" on:click={next}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </button>
          <div class="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-3 z-10">
            {#each images as _, i}
              <button
                class="w-4 h-4 rounded-full border-2 border-accent bg-white/80 focus:outline-none transition-all duration-300 {i === current ? 'bg-accent scale-125 shadow-lg' : ''}"
                aria-label={`Go to slide ${i+1}`}
                on:click={() => goTo(i)}
              ></button>
            {/each}
          </div>
        </div>
      </div>

      <div class="mt-6 flex justify-center">
        <button
          class="btn btn-accent px-8 py-3 rounded-full text-lg font-semibold shadow-xl flex items-center gap-2 transition-transform transform hover:scale-105 hover:bg-primary focus:outline-none focus:ring-4 focus:ring-primary/50 animate-bounce"
          on:click={revealStats}
        >
          Get Investor Ready
        </button>
      </div>
    </section>
  </div>
{/if}


{#if showStats}
  <div class="min-h-screen flex items-center justify-center relative overflow-hidden">
    <!-- Sequential Video Background -->
    <div class="absolute inset-0 w-full h-full flex items-stretch justify-stretch pointer-events-none select-none z-0">
      {#each [0,1,2,3,4] as i}
        <video
          src="/videos/encoded_2.mp4"
          autoplay
          loop
          muted
          playsinline
          class="absolute top-0 left-0 h-full w-1/5 object-cover brightness-75 blur-[2px] shadow-xl rounded-none transition-opacity duration-1000"
          style="left:calc(20% * {i});opacity:{showStatsVideos[i] ? 1 : 0};z-index:{i+1};"
        ></video>
      {/each}
    </div>
    <!-- Event Highlights Foreground (always visible, no transition, no fade-in) -->
    <section id="event-stats" class="py-16 px-4 max-w-3xl w-full bg-base-200/90 backdrop-blur-md rounded-3xl shadow-2xl flex flex-col items-center relative z-10 border border-accent/30">
      <h3 class="text-2xl md:text-3xl font-bold mb-8 text-center text-white">Event Highlights</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
        <div class="flex flex-col items-center">
          <span class="text-5xl font-extrabold text-white">500+</span>
          <span class="mt-2 text-lg text-white">Attendees</span>
        </div>
        <div class="flex flex-col items-center">
          <span class="text-5xl font-extrabold text-white">40+</span>
          <span class="mt-2 text-lg text-white">Businesses Pitched</span>
        </div>
        <div class="flex flex-col items-center">
          <span class="text-5xl font-extrabold text-white">10+</span>
          <span class="mt-2 text-lg text-white">Investors Attended</span>
        </div>
      </div>
      <div class="flex justify-center mt-8">
        <button
          class="btn btn-outline btn-accent text-white px-8 py-3 rounded-full text-lg font-semibold shadow-lg flex items-center gap-2 transition-transform transform hover:scale-105 hover:bg-accent focus:outline-none focus:ring-4 focus:ring-accent/50"
          on:click={() => navTo('/learnMore')}
        >
          Learn More
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
        </button>
      </div>
    </section>
  </div>
{/if}


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
