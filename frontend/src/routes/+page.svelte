
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
  <meta name="robots" content="index, follow" />
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://liffeyfoundersclub.com/" />
  <meta property="og:title" content="Liffey Founders Club - Practice What You Pitch" />
  <meta property="og:description" content="Join Dublin's premier startup community. Practice your pitch, connect with investors, and grow your business." />
  <meta property="og:image" content="https://liffeyfoundersclub.com/img/logo/Liffey_Founders_Club_Logo.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Liffey Founders Club Logo" />
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:url" content="https://liffeyfoundersclub.com/" />
  <meta property="twitter:title" content="Liffey Founders Club - Practice What You Pitch" />
  <meta property="twitter:description" content="Join Dublin's premier startup community. Practice your pitch, connect with investors, and grow your business." />
  <meta property="twitter:image" content="https://liffeyfoundersclub.com/img/logo/Liffey_Founders_Club_Logo.png" />
  <meta property="twitter:image:alt" content="Liffey Founders Club Logo" />
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
    <h2 class="mt-4 text-lg md:text-xl max-w-xl mx-auto">
      Capture attention, showcase your vision, and connect with investors.
    </h2>
    <button
      type="button"
      class="btn btn-primary btn-neon mt-8 px-8 py-3 rounded-full text-lg font-semibold flex items-center gap-2 transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-primary/50 mx-auto"
      on:click={handleStartNow}
    >
      Start Now
    </button>
    
    <!-- Simple internal navigation links -->
    <div class="mt-6 flex flex-wrap justify-center gap-4 text-sm opacity-80">
      <a href="/pitch" class="hover:text-primary transition-colors">
        View Pitches
      </a>
      <span>•</span>
      <a href="/learnMore" class="hover:text-primary transition-colors">
        Join Community
      </a>
    </div>
    </div>
  </div>
</section>
{/if}
