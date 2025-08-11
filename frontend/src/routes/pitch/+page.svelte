<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { river } from '$lib/river';
  import { goto } from '$app/navigation';

  const images = [
    '/img/event_june/image_1.jpg',
    '/img/event_june/image_4.jpg',
    '/img/event_june/image_5.jpg',
    '/img/event_june/image_6.jpg',
    '/img/event_june/image_7.jpg',
    '/img/event_june/image_8.jpg',
    '/img/event_june/image_9.jpg',
    '/img/event_june/image_10.jpg',
    '/img/event_june/image_11.jpg',
    '/img/event_june/image_12.jpg',
  ];
  let current = 0;
  let interval: ReturnType<typeof setInterval> | null = null;

  let showCarousel = true;
  let showStats = false;

  function autoNext() {
    current = (current + 1) % images.length;
  }
  function startInterval() {
    if (interval) return;
    interval = setInterval(autoNext, 5000);
  }
  function clearIntervalTimer() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }
  function resetInterval() {
    clearIntervalTimer();
    startInterval();
  }

  onMount(() => {
    startInterval();
  });
  onDestroy(() => {
    clearIntervalTimer();
  });

  function revealStats() {
    showCarousel = false;
    setTimeout(() => {
      showStats = true;
    }, 600); // match river transition duration
  }

  function goTo(i: number) {
    current = i;
    resetInterval();
  }
  function navTo(path: string) { goto(path); }

  // --- Sequential video fade-in logic for Event Highlights background ---
  const videoNames = ['Bilal_Nasrullah', 'Kanupriya_Jamwal', 'Ricardo_Ionescu', 'Toby_Steele', 'Vishranth'];
  let showStatsVideos = Array(videoNames.length).fill(false) as boolean[];
  $: if (showStats) {
    showStatsVideos = Array(videoNames.length).fill(false) as boolean[];
    for (let i = 0; i < videoNames.length; i++) {
      setTimeout(() => (showStatsVideos[i] = true), i * 1200);
    }
  }
</script>


{#if showCarousel}
  <div in:river out:river>
  <section class="py-16 px-4 max-w-6xl mx-auto">
      <h2 class="text-4xl md:text-5xl font-extrabold mb-10 text-center tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent drop-shadow-lg">
        Visualize Your Pitch
      </h2>

  <div class="relative w-full h-[420px] md:h-[640px] flex items-center justify-center"
       role="region"
       aria-label="Pitch image carousel"
       on:mouseenter={clearIntervalTimer}
       on:mouseleave={startInterval}>
  <div class="relative w-full h-full bg-white/80 dark:bg-slate-900/80 rounded-3xl shadow-2xl overflow-hidden flex items-center justify-center border border-accent/20 backdrop-blur-md">
          {#each images as img, i}
            {#if i === current}
              <img src={img} class="w-full h-full object-cover transition-all duration-700 rounded-3xl shadow-xl" alt="Pitch Slide {i + 1}" />
            {/if}
          {/each}
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
  <div in:river out:river class="min-h-screen flex items-center justify-center relative overflow-hidden">
    <!-- Sequential Video Background -->
    <div class="absolute inset-0 w-full h-full flex items-stretch justify-stretch pointer-events-none select-none z-0">
      {#each videoNames as name, i}
        <video
          autoplay
          loop
          muted
          playsinline
          class="absolute top-0 left-0 h-full w-1/5 object-cover brightness-75 blur-[2px] shadow-xl rounded-none transition-opacity duration-1000"
          style="left:calc(20% * {i});opacity:{showStatsVideos[i] ? 1 : 0};z-index:{i+1};"
        >
          <source src={`/videos/pitches/${name}.webm`} type="video/webm" />
          <source src={`/videos/pitches/${name}.mp4`} type="video/mp4" />
        </video>
      {/each}
    </div>
    <!-- Event Highlights Foreground (always visible, no transition, no fade-in) -->
    <section id="event-stats" class="py-16 px-4 max-w-3xl w-full bg-base-200/90 backdrop-blur-md rounded-3xl shadow-2xl flex flex-col items-center relative z-10 border border-accent/30 text-base-content">
      <h3 class="text-2xl md:text-3xl font-bold mb-8 text-center">Event Highlights</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
        <div class="flex flex-col items-center">
          <span class="text-5xl font-extrabold text-primary">500+</span>
          <span class="mt-2 text-lg">Attendees</span>
        </div>
        <div class="flex flex-col items-center">
          <span class="text-5xl font-extrabold text-primary">40+</span>
          <span class="mt-2 text-lg">Businesses Pitched</span>
        </div>
        <div class="flex flex-col items-center">
          <span class="text-5xl font-extrabold text-primary">10+</span>
          <span class="mt-2 text-lg">Investors Attended</span>
        </div>
      </div>
      <div class="flex justify-center mt-8">
        <button
          class="btn btn-accent px-8 py-3 rounded-full text-lg font-semibold shadow-lg flex items-center gap-2 transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-accent/50"
          on:click={() => navTo('/learnMore')}
        >
          Learn More
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
        </button>
      </div>
    </section>
  </div>
{/if}


<!-- FAB removed; now provided globally in +layout.svelte -->
