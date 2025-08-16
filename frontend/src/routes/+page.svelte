
<script lang="ts">
  import { goto } from '$app/navigation';
  import { routeOpacity } from '$lib/transitions';
  let show = true;
  function handleStartNow(e: Event) {
    e.preventDefault();
    show = false; // trigger outro
  }
  function onOutroEnd() {
    goto('/pitch');
  }
  </script>

{#if show}
<section class="relative h-screen w-full overflow-hidden flex items-center justify-center bg-black text-white" out:routeOpacity on:outroend={onOutroEnd}>
  <video autoplay muted loop class="absolute w-full h-full object-cover object-center opacity-40">
    <source src="/videos/encoded_2_1.webm" type="video/webm" />
    <source src="/videos/encoded_2.mp4" type="video/mp4" />
  </video>
  <div class="relative z-10 text-center px-4 flex flex-col items-center">
    <div class="glass-homepage rounded-3xl px-6 py-6 md:px-10 md:py-8 backdrop-blur-md">
    <h1 class="text-5xl md:text-7xl font-bold animate-fade">
      Practice What You Pitch
    </h1>
    <p class="mt-4 text-lg md:text-xl max-w-xl mx-auto">
      Capture attention, showcase your vision, and connect with investors.
    </p>
    <button
      type="button"
      class="btn btn-primary btn-neon mt-8 px-8 py-3 rounded-full text-lg font-semibold flex items-center gap-2 transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-primary/50 mx-auto"
      on:click={handleStartNow}
    >
      Start Now
    </button>
    </div>
  </div>
</section>
{/if}
