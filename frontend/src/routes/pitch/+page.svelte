
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  const images = ['/img/image_3.jpg', '/img/image_3.jpg', '/img/image_3.jpg'];
  let current = 0;
  let interval: ReturnType<typeof setInterval>;

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
  function goTo(idx: number) {
    current = idx;
    clearInterval(interval);
    interval = setInterval(next, 3500);
  }
</script>

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
    <a
      href="/contact"
      class="btn btn-accent px-8 py-3 rounded-full text-lg font-semibold shadow-xl flex items-center gap-2 transition-transform transform hover:scale-105 hover:bg-primary focus:outline-none focus:ring-4 focus:ring-primary/50 animate-bounce"
      data-sveltekit-preload-data
    >
      Get Investor Ready
    </a>
  </div>
</section>
