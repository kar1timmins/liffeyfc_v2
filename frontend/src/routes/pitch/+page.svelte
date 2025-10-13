<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { makeCrossfade, dur, crossEase } from '$lib/transitions';
  import { fade } from 'svelte/transition';
  import { goto, preloadCode } from '$app/navigation';
  import { MoveRight, ChevronLeft, ChevronRight, X as CloseIcon } from 'lucide-svelte';
  import { generateRandomCircles, animateCircles, type Circle } from '$lib/animations';

  // Using 9 images to match the collage layout in the reference photo
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
  ];

  // --- Static collage layout classes ---
  // Defines the grid-span for each of the 9 images to create the collage effect.
  const gridLayoutClasses = [
    'col-span-2 row-span-1', // Image 1
    'col-span-1 row-span-1', // Image 2
    'col-span-1 row-span-1', // Image 3
    'col-span-1 row-span-1', // Image 4
    'col-span-1 row-span-2', // Image 5 (the tall one)
    'col-span-2 row-span-1', // Image 6
    'col-span-1 row-span-1', // Image 7
    'col-span-1 row-span-1', // Image 8
    'col-span-1 row-span-1', // Image 9
  ];

  // Progressive image loading state
  let loadedImages = new Set<number>();
  let allImagesLoaded = false;
  
  // Preload critical images (first 3 visible)
  function preloadImages() {
    const criticalImages = images.slice(0, 3);
    criticalImages.forEach((src, index) => {
      const img = new Image();
      img.onload = () => {
        loadedImages.add(index);
        loadedImages = loadedImages; // Trigger reactivity
      };
      img.src = src;
    });
    
    // Lazy load remaining images
    setTimeout(() => {
      images.slice(3).forEach((src, index) => {
        const img = new Image();
        img.onload = () => {
          loadedImages.add(index + 3);
          loadedImages = loadedImages;
          if (loadedImages.size === images.length) {
            allImagesLoaded = true;
          }
        };
        img.src = src;
      });
    }, 300);
  }

  let showCarousel = true;
  let showStats = false;
  // Crossfade between the two sections
  let mountedPitch = false;
  const [send, receive] = makeCrossfade(() => mountedPitch, { duration: dur.crossfade + 180, fallbackDuration: dur.fast, easing: crossEase });

  onMount(() => {
    mountedPitch = true;
    // Preload images for faster rendering
    preloadImages();
    // Initialize floating circles
    initCircles();
    startAnimation();
  });

  onDestroy(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  });

  async function revealStats() {
    // Show stats immediately, then hide carousel on next microtask to allow overlap
    showStats = true;
    await tick();
    showCarousel = false;
  }

  // Prefetch Learn More for smoother nav from highlights
  async function prefetchLearnMore() {
    try { await preloadCode('/learnMore'); } catch {}
  }

  // Fade-out then navigate from highlights
  let navigating = false;
  let navTarget = '';
  function fadeOutThenGo(path: string) {
    navigating = true;
    navTarget = path;
    // trigger 'outro' by hiding stats block
    showStats = false;
  }
  // --- Lightbox (modal) for mosaic tiles ---
  let lightboxOpen = false;
  let lightboxIndex = 0;
  function openLightbox(index: number) {
    lightboxIndex = index;
    lightboxOpen = true;
  }
  function closeLightbox() { lightboxOpen = false; }
  function nextImage() { lightboxIndex = (lightboxIndex + 1) % images.length; }
  function prevImage() { lightboxIndex = (lightboxIndex - 1 + images.length) % images.length; }

  // Dynamic floating circles
  let circles: Circle[] = [];
  let animationFrame: number;

  function initCircles() {
    circles = generateRandomCircles(15); // More circles for pitch page
  }

  function startAnimation() {
    circles = animateCircles(circles);
    animationFrame = requestAnimationFrame(startAnimation);
  }

  function onKey(e: KeyboardEvent) {
    if (!lightboxOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); nextImage(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prevImage(); }
  }
  let touchStartX = 0;
  let touchStartY = 0;
  onMount(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  // Lock body scroll when lightbox is open
  $: {
    try {
      if (lightboxOpen) document.body.classList.add('overflow-hidden');
      else document.body.classList.remove('overflow-hidden');
    } catch {}
  }

  // --- Sequential video fade-in logic for Event Highlights background ---
  const videoNames = ['Bilal_Nasrullah', 'Kanupriya_Jamwal', 'Ricardo_Ionescu', 'Toby_Steele', 'Vishranth'];
  let showStatsVideos = Array(videoNames.length).fill(false) as boolean[];
  $: if (showStats) {
    showStatsVideos = Array(videoNames.length).fill(false) as boolean[];
    for (let i = 0; i < videoNames.length; i++) {
      setTimeout(() => (showStatsVideos[i] = true), i * 1600);
    }
  }
</script>

<svelte:head>
  <title>Startup Pitches - Liffey Founders Club | Dublin Entrepreneur Showcase</title>
  <meta name="description" content="Watch inspiring startup pitches from Dublin's emerging entrepreneurs. See how founders present their vision and connect with the investor community." />
  <link rel="canonical" href="https://liffeyfoundersclub.com/pitch" />
  <meta name="robots" content="index, follow" />
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://liffeyfoundersclub.com/pitch" />
  <meta property="og:title" content="Startup Pitches - Liffey Founders Club" />
  <meta property="og:description" content="Watch inspiring startup pitches from Dublin's emerging entrepreneurs." />
  <meta property="og:image" content="https://liffeyfoundersclub.com/img/event_june/image_1.jpg" />
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:url" content="https://liffeyfoundersclub.com/pitch" />
  <meta property="twitter:title" content="Startup Pitches - Liffey Founders Club" />
  <meta property="twitter:description" content="Watch inspiring startup pitches from Dublin's emerging entrepreneurs." />
  <meta property="twitter:image" content="https://liffeyfoundersclub.com/img/event_june/image_1.jpg" />

  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "itemListElement": [
        {
          "@type": "VideoObject",
          "name": "Pitch by Bilal Nasrullah",
          "description": "Startup pitch from a Liffey Founders Club event.",
          "thumbnailUrl": "https://liffeyfoundersclub.com/img/event_june/image_1.jpg",
          "uploadDate": "2025-10-08",
          "contentUrl": "https://liffeyfoundersclub.com/videos/pitches/Bilal_Nasrullah.webm",
          "publisher": {
            "@type": "Organization",
            "name": "Liffey Founders Club",
            "logo": {
              "@type": "ImageObject",
              "url": "https://liffeyfoundersclub.com/img/event_june/image_1.jpg"
            }
          }
        },
        {
          "@type": "VideoObject",
          "name": "Pitch by Kanupriya Jamwal",
          "description": "Startup pitch from a Liffey Founders Club event.",
          "thumbnailUrl": "https://liffeyfoundersclub.com/img/event_june/image_4.jpg",
          "uploadDate": "2025-10-08",
          "contentUrl": "https://liffeyfoundersclub.com/videos/pitches/Kanupriya_Jamwal.webm",
          "publisher": {
            "@type": "Organization",
            "name": "Liffey Founders Club",
            "logo": {
              "@type": "ImageObject",
              "url": "https://liffeyfoundersclub.com/img/event_june/image_1.jpg"
            }
          }
        },
        {
          "@type": "VideoObject",
          "name": "Pitch by Ricardo Ionescu",
          "description": "Startup pitch from a Liffey Founders Club event.",
          "thumbnailUrl": "https://liffeyfoundersclub.com/img/event_june/image_5.jpg",
          "uploadDate": "2025-10-08",
          "contentUrl": "https://liffeyfoundersclub.com/videos/pitches/Ricardo_Ionescu.webm",
          "publisher": {
            "@type": "Organization",
            "name": "Liffey Founders Club",
            "logo": {
              "@type": "ImageObject",
              "url": "https://liffeyfoundersclub.com/img/event_june/image_1.jpg"
            }
          }
        },
        {
          "@type": "VideoObject",
          "name": "Pitch by Toby Steele",
          "description": "Startup pitch from a Liffey Founders Club event.",
          "thumbnailUrl": "https://liffeyfoundersclub.com/img/event_june/image_6.jpg",
          "uploadDate": "2025-10-08",
          "contentUrl": "https://liffeyfoundersclub.com/videos/pitches/Toby_Steele.webm",
          "publisher": {
            "@type": "Organization",
            "name": "Liffey Founders Club",
            "logo": {
              "@type": "ImageObject",
              "url": "https://liffeyfoundersclub.com/img/event_june/image_1.jpg"
            }
          }
        },
        {
          "@type": "VideoObject",
          "name": "Pitch by Vishranth",
          "description": "Startup pitch from a Liffey Founders Club event.",
          "thumbnailUrl": "https://liffeyfoundersclub.com/img/event_june/image_7.jpg",
          "uploadDate": "2025-10-08",
          "contentUrl": "https://liffeyfoundersclub.com/videos/pitches/Vishranth.webm",
          "publisher": {
            "@type": "Organization",
            "name": "Liffey Founders Club",
            "logo": {
              "@type": "ImageObject",
              "url": "https://liffeyfoundersclub.com/img/event_june/image_1.jpg"
            }
          }
        }
      ]
    }
  </script>
</svelte:head>

{#if showCarousel}
  <div out:send={{ key: 'pitch-sect' }} in:receive={{ key: 'pitch-sect' }}>
    <section class="py-16 px-4 max-w-6xl mx-auto relative overflow-hidden">
      <!-- Floating background elements for depth -->
      {#if !showStats}
        <div class="absolute inset-0 pointer-events-none">
          {#each circles as circle (circle.id)}
            <div 
              class="absolute rounded-full glass-subtle animate-pulse transition-all duration-1000 ease-out" 
              style="
                left: {circle.x}%; 
                top: {circle.y}%; 
                width: {circle.size}px; 
                height: {circle.size}px;
                animation-delay: {circle.animationDelay}s;
                transform: translate(-50%, -50%);
                opacity: {circle.opacity};
              "
            ></div>
          {/each}
        </div>
      {/if}

      <!-- SEO-optimized heading structure -->
      <div class="text-center mb-10 relative z-10">
        <h1 class="text-5xl md:text-6xl font-extrabold mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent drop-shadow-lg">
          Dublin Startup Pitches
        </h1>
        <h2 class="text-2xl md:text-3xl font-bold text-base-content/80">
          Visualize Your Pitch: See How Dublin Entrepreneurs Present Their Vision
        </h2>
        <p class="mt-4 text-lg text-base-content/70 max-w-2xl mx-auto">
          Explore inspiring startup pitches from Dublin's emerging entrepreneurs. Watch how founders capture attention, showcase their vision, and connect with the investor community at Liffey Founders Club quarterly events.
        </p>
      </div>

      <div
        class="relative w-full h-[60vh] md:h-[640px]"
        role="region"
        aria-label="Pitch image mosaic"
      >
  <div class="absolute inset-0 overflow-hidden p-2 md:p-3">
          <!-- Mobile: simple 2-col grid, no spans -->
          <div class="md:hidden grid grid-cols-2 gap-2 w-full h-full">
            {#each images as src, i}
              <button 
                class="relative w-full h-full rounded-lg overflow-hidden bg-base-200/60 focus:outline-none" 
                on:click={() => openLightbox(i)} 
                aria-label={`Open image ${i+1}`}
              >
                <!-- Blur placeholder while loading -->
                <div 
                  class="absolute inset-0 bg-gradient-to-br from-base-300 to-base-200 animate-pulse"
                  class:opacity-0={loadedImages.has(i)}
                  class:opacity-100={!loadedImages.has(i)}
                  style="transition: opacity 0.3s ease;"
                ></div>
                <!-- Actual image -->
                <img 
                  {src} 
                  alt={`Pitch event photo ${i + 1}`} 
                  class="absolute inset-0 w-full h-full object-cover transition-opacity duration-300" 
                  class:opacity-0={!loadedImages.has(i)}
                  class:opacity-100={loadedImages.has(i)}
                  in:fade={{ duration: 420, delay: Math.min(i * 50, 500), easing: crossEase }} 
                  loading={i < 3 ? 'eager' : 'lazy'}
                  decoding="async"
                  fetchpriority={i === 0 ? 'high' : 'auto'}
                />
              </button>
            {/each}
          </div>
          <!-- Desktop/tablet: collage with spans -->
          <div class="hidden md:grid grid-cols-4 grid-rows-3 gap-3 w-full h-full">
            {#each images as src, i}
              <button 
                class="relative w-full h-full rounded-lg overflow-hidden bg-base-200/60 {gridLayoutClasses[i]} focus:outline-none" 
                on:click={() => openLightbox(i)} 
                aria-label={`Open image ${i+1}`}
              >
                <!-- Blur placeholder while loading -->
                <div 
                  class="absolute inset-0 bg-gradient-to-br from-base-300 to-base-200 animate-pulse"
                  class:opacity-0={loadedImages.has(i)}
                  class:opacity-100={!loadedImages.has(i)}
                  style="transition: opacity 0.3s ease;"
                ></div>
                <!-- Actual image -->
                <img 
                  {src} 
                  alt={`Pitch event photo ${i + 1}`} 
                  class="absolute inset-0 w-full h-full object-cover transition-opacity duration-300" 
                  class:opacity-0={!loadedImages.has(i)}
                  class:opacity-100={loadedImages.has(i)}
                  in:fade={{ duration: 520, delay: Math.min(i * 60, 600), easing: crossEase }} 
                  loading={i < 3 ? 'eager' : 'lazy'}
                  decoding="async"
                  fetchpriority={i === 0 ? 'high' : 'auto'}
                />
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="mt-6 flex justify-center">
        <button
          class="btn glass-subtle btn-neon-accent px-8 py-3 rounded-full text-lg font-semibold shadow-lg flex items-center gap-2 transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-accent/50"
          on:click={revealStats}
        >
          Get Investor Ready
        </button>
      </div>
    </section>
  </div>
{/if}

{#if lightboxOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md"
    role="dialog"
    aria-modal="true"
    aria-label="Image viewer"
    tabindex="0"
    on:click={(e) => { if (e.currentTarget === e.target) closeLightbox(); }}
    on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeLightbox(); } }}
  >
  <div class="relative max-w-5xl w-[94vw] md:w-[92vw] h-[68dvh] md:h-[80vh] glass-subtle rounded-3xl shadow-2xl overflow-hidden flex items-center justify-center p-2 md:p-4 backdrop-blur-xl"
      on:touchstart={(e) => { if (e.touches?.length) { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; } }}
      on:touchend={(e) => { const t = e.changedTouches?.[0]; if (!t) return; const dx = t.clientX - touchStartX; const dy = t.clientY - touchStartY; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { dx < 0 ? nextImage() : prevImage(); } }}
    >
      <button class="absolute btn btn-sm md:btn-md glass-subtle border-0" style="top:max(env(safe-area-inset-top),0.75rem);right:max(env(safe-area-inset-right),0.75rem)" aria-label="Close" on:click={closeLightbox}>
        <CloseIcon class="h-5 w-5" />
      </button>
      <button class="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 btn btn-circle glass-subtle border-0 shadow-md" aria-label="Previous" on:click|stopPropagation={prevImage}>
        <ChevronLeft class="h-7 w-7" />
      </button>
      <button class="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 btn btn-circle glass-subtle border-0 shadow-md" aria-label="Next" on:click|stopPropagation={nextImage}>
        <ChevronRight class="h-7 w-7" />
      </button>
      <img src={images[lightboxIndex]} alt={`Image ${lightboxIndex + 1}`} class="max-w-full max-h-full w-auto h-auto object-contain select-none" draggable="false" />
    </div>
  </div>
{/if}

{#if showStats}
  <div out:send={{ key: 'pitch-sect' }} in:receive={{ key: 'pitch-sect' }} on:outroend={() => { if (navigating && navTarget) goto(navTarget); }} class="min-h-[100dvh] md:min-h-screen flex items-center justify-center relative overflow-hidden">
    <div class="absolute inset-0 w-full h-full flex items-stretch justify-stretch pointer-events-none select-none z-0">
      {#each videoNames as name, i}
        <video
          autoplay
          loop
          muted
          playsinline
          class="absolute top-0 left-0 h-full w-1/5 object-cover brightness-75 blur-[2px] shadow-xl rounded-none transition-opacity duration-[1600ms] ease-in-out"
          style="left:calc(20% * {i});opacity:{showStatsVideos[i] ? 1 : 0};z-index:{i+1};"
        >
          <source src={`/videos/pitches/${name}.webm`} type="video/webm" />
          <source src={`/videos/pitches/${name}.mp4`} type="video/mp4" />
        </video>
      {/each}
    </div>
  <section id="event-stats" class="py-10 md:py-16 px-4 max-w-3xl w-full glass-subtle rounded-3xl flex flex-col items-center relative z-10 text-base-content">
      <h3 class="text-xl md:text-3xl font-bold mb-6 md:mb-8 text-center">Event Highlights</h3>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 w-full">
        <div class="flex flex-col items-center">
          <span class="text-4xl md:text-5xl font-extrabold text-primary">500+</span>
          <span class="mt-1 md:mt-2 text-base md:text-lg">Attendees</span>
        </div>
        <div class="flex flex-col items-center">
          <span class="text-4xl md:text-5xl font-extrabold text-primary">40+</span>
          <span class="mt-1 md:mt-2 text-base md:text-lg">Businesses Pitched</span>
        </div>
        <div class="flex flex-col items-center col-span-2 md:col-span-1">
          <span class="text-4xl md:text-5xl font-extrabold text-primary">10+</span>
          <span class="mt-1 md:mt-2 text-base md:text-lg">Investors Attended</span>
        </div>
      </div>
      <div class="flex justify-center mt-6 md:mt-8">
        <button
          class="btn glass-subtle btn-neon-cool px-8 py-3 rounded-full text-lg font-semibold shadow-lg flex items-center gap-2 transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-primary/50"
            on:mouseenter={prefetchLearnMore}
            on:touchstart={prefetchLearnMore}
            on:click={() => fadeOutThenGo('/learnMore')}
        >
          Learn More <MoveRight class="h-5 w-5 ml-2" />
        </button>
      </div>
    </section>
  </div>
{/if}