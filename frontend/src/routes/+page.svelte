
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

<svelte:head>
  <title>Liffey Founders Club - Practice What You Pitch | Startup Community Dublin</title>
  <meta name="description" content="Join Dublin's premier startup community. Practice your pitch, connect with investors, and grow your business. Quarterly events for entrepreneurs in Dublin, Ireland." />
  <link rel="canonical" href="https://liffeyfoundersclub.com/" />
</svelte:head>

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
    
    <!-- Enhanced content section -->
    <div class="mt-8 max-w-2xl mx-auto text-left">
      <h2 class="text-2xl md:text-3xl font-semibold mb-4 text-center">Dublin's Premier Startup Community</h2>
      <p class="text-base md:text-lg mb-6 opacity-90">
        Join Liffey Founders Club, where ambitious entrepreneurs gather quarterly to refine their pitches, 
        network with like-minded founders, and connect with potential investors. Whether you're seeking 
        your first round of funding or scaling your established startup, our community provides the 
        platform and connections you need to succeed.
      </p>
      
      <h2 class="text-xl md:text-2xl font-semibold mb-3 text-center">What You'll Get</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-sm md:text-base">
        <div class="glass-subtle rounded-lg p-4">
          <strong>Pitch Practice:</strong> Refine your presentation skills in a supportive environment
        </div>
        <div class="glass-subtle rounded-lg p-4">
          <strong>Investor Network:</strong> Connect with angels and VCs actively seeking opportunities
        </div>
        <div class="glass-subtle rounded-lg p-4">
          <strong>Peer Learning:</strong> Learn from successful founders and industry experts
        </div>
        <div class="glass-subtle rounded-lg p-4">
          <strong>Community Support:</strong> Join a network of entrepreneurs supporting each other's growth
        </div>
      </div>
    </div>
    
    <button
      type="button"
      class="btn btn-primary btn-neon mt-8 px-8 py-3 rounded-full text-lg font-semibold flex items-center gap-2 transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-primary/50 mx-auto"
      on:click={handleStartNow}
    >
      Start Now
    </button>
    
    <!-- Internal navigation links -->
    <div class="mt-6 flex flex-wrap justify-center gap-4 text-sm">
      <a href="/pitch" class="glass-subtle px-4 py-2 rounded-full hover:bg-white/20 transition-colors">
        View Pitches
      </a>
      <a href="/learnMore" class="glass-subtle px-4 py-2 rounded-full hover:bg-white/20 transition-colors">
        Join Community
      </a>
    </div>
    </div>
  </div>
</section>
{/if}
