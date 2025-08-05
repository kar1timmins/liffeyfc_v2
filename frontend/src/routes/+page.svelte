
<script lang="ts">
  import { goto } from '$app/navigation';
  function handleStartNow(e: Event) {
    e.preventDefault();
    goto('/pitch');
  }
</script>

<section class="relative h-screen w-full overflow-hidden flex items-center justify-center bg-black text-white">
  <video autoplay muted loop class="absolute w-full h-full object-cover object-center opacity-40">
    <source src="/videos/encoded_2_1.webm" type="video/webm" />
    <source src="/videos/encoded_2.mp4" type="video/mp4" />
  </video>
  <div class="relative z-10 text-center px-4 flex flex-col items-center">
    <h1 class="text-5xl md:text-7xl font-bold animate-fade">
      Pitch Your Startup
    </h1>
    <p class="mt-4 text-lg md:text-xl max-w-xl mx-auto">
      Capture attention, showcase your vision, and connect with investors.
    </p>
    <button
      type="button"
      class="btn btn-primary mt-8 px-8 py-3 rounded-full text-lg font-semibold shadow-xl flex items-center gap-2 transition-transform transform hover:scale-105 hover:bg-accent focus:outline-none focus:ring-4 focus:ring-accent/50 animate-bounce mx-auto"
      on:click={handleStartNow}
    >
      Start Now
    </button>
  </div>
</section>
