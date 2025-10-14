
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
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1668" />
  <meta property="og:image:height" content="2388" />
  <meta property="og:image:alt" content="Liffey Founders Club Logo" />
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary" />
  <meta property="twitter:url" content="https://liffeyfoundersclub.com/" />
  <meta property="twitter:title" content="Liffey Founders Club - Practice What You Pitch" />
  <meta property="twitter:description" content="Join Dublin's premier startup community. Practice your pitch, connect with investors, and grow your business." />
  <meta property="twitter:image" content="https://liffeyfoundersclub.com/img/logo/Liffey_Founders_Club_Logo.png" />
  <meta property="twitter:image:alt" content="Liffey Founders Club Logo" />
  
  <!-- Enhanced Structured Data for Google AI Overview -->
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Liffey Founders Club",
      "alternateName": "Liffey FC",
      "url": "https://liffeyfoundersclub.com",
      "logo": "https://liffeyfoundersclub.com/img/logo/Liffey_Founders_Club_Logo.png",
      "description": "Dublin's premier startup community for founders, entrepreneurs, and investors. Practice your pitch, connect with investors, and grow your business through quarterly networking events.",
      "foundingDate": "2024",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Dublin",
        "addressCountry": "IE"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "addressCountry": "IE"
      },
      "slogan": "Practice What You Pitch",
      "knowsAbout": [
        "Startup Pitching",
        "Entrepreneurship",
        "Venture Capital",
        "Angel Investment",
        "Business Networking",
        "Startup Community",
        "Innovation",
        "Dublin Startups"
      ],
      "memberOf": {
        "@type": "Organization",
        "name": "Dublin Startup Ecosystem"
      },
      "sameAs": [
        "https://www.linkedin.com/company/liffey-founders-club/",
        "https://lu.ma/event/evt-Hs6RP2j7Bkc8jGQ"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "Event Registration",
        "url": "https://liffeyfoundersclub.com/learnMore"
      }
    }
  </script>
  
  <!-- Event Structured Data -->
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": "Liffey Founders Club Q4 2025 Event",
      "description": "Join Dublin's premier startup community for an evening of networking, pitching, and connecting with investors and fellow entrepreneurs.",
      "startDate": "2025-12-09T18:00:00+00:00",
      "endDate": "2025-12-09T21:00:00+00:00",
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "location": {
        "@type": "Place",
        "name": "Dublin, Ireland",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Dublin",
          "addressCountry": "IE"
        }
      },
      "image": "https://liffeyfoundersclub.com/img/logo/Liffey_Founders_Club_Logo.png",
      "organizer": {
        "@type": "Organization",
        "name": "Liffey Founders Club",
        "url": "https://liffeyfoundersclub.com"
      },
      "offers": {
        "@type": "Offer",
        "url": "https://lu.ma/event/evt-Hs6RP2j7Bkc8jGQ",
        "price": "0",
        "priceCurrency": "EUR",
        "availability": "https://schema.org/InStock",
        "validFrom": "2025-10-14T00:00:00+00:00"
      }
    }
  </script>
  
  <!-- FAQPage Structured Data for AI Overview -->
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is Liffey Founders Club?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Liffey Founders Club is Dublin's premier startup community for founders, entrepreneurs, and investors. We host quarterly events where entrepreneurs can practice their pitch, connect with investors, and network with fellow innovators."
          }
        },
        {
          "@type": "Question",
          "name": "Who can join Liffey Founders Club?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Liffey Founders Club welcomes founders, entrepreneurs, startup employees, angel investors, venture capitalists, and anyone interested in the Dublin startup ecosystem. Whether you're pitching your business, looking to invest, or simply wanting to connect with the community, you're welcome to join our quarterly events."
          }
        },
        {
          "@type": "Question",
          "name": "When is the next Liffey Founders Club event?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Our next event is scheduled for December 9, 2025, in Dublin. We host quarterly events throughout the year. Registration is available at https://liffeyfoundersclub.com/learnMore"
          }
        },
        {
          "@type": "Question",
          "name": "How do I pitch my startup at Liffey Founders Club?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "To pitch your startup, register for our next event via the Learn More page and indicate your interest in pitching. Selected founders will receive an invitation to present their business to investors and the community at our quarterly events."
          }
        }
      ]
    }
  </script>
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
