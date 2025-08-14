<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { fade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  // Load Luma checkout script
  onMount(() => {
    // Check if script already exists
    if (document.getElementById('luma-checkout')) {
      return;
    }
    
    const script = document.createElement('script');
    script.id = 'luma-checkout';
    script.src = 'https://embed.lu.ma/checkout-button.js';
    script.async = true;
    script.onload = () => {
      console.log('Luma script loaded successfully');
      // Initialize Luma if needed
      if ((window as any).LumaCheckout) {
        (window as any).LumaCheckout.init();
      }
    };
    script.onerror = () => {
      console.error('Failed to load Luma script');
    };
    document.head.appendChild(script);
  });

  let submitted = false;
  let step = 0;
  let view: 'interest' | 'register' = 'interest';

  const interests = [
    'Attending',
    'Pitching my business',
    'Investing / Partnering'
  ];
  let name = '';
  let email = '';
  let interest: string | null = null;
  let message = '';
  let consent = false;

  type YesNo = 'Yes' | 'No' | null;
  let pitchedBefore: YesNo = null;

  function next() {
    if (step < 4) step += 1;
  }
  function prev() {
    if (step > 0) step -= 1;
  }
  function canNext() {
    if (step === 0) return pitchedBefore !== null;
    if (step === 1) return !!interest;
    if (step === 2) return !!name && !!email && /.+@.+\..+/.test(email);
    if (step === 3) return true; // message optional
    return false;
  }
  // Timestamp and event year/quarter logic
  let timestamp: string | null = null;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  let quarter = 1;
  if (month >= 0 && month <= 2) quarter = 1;
  else if (month >= 3 && month <= 5) quarter = 2;
  else if (month >= 6 && month <= 8) quarter = 3;
  else quarter = 4;

  function submitMulti() {
    if (consent) {
      timestamp = new Date().toISOString();
      submitted = true;
    }
  }
</script>

<svelte:head>
  <title>Learn More - Liffey FC</title>
  <meta name="description" content="Learn more about our events and register your interest." />
</svelte:head>

<section class="min-h-screen bg-base-200/80 px-4 py-16 flex items-center justify-center">
  <div class="max-w-3xl w-full">
    <div class="text-center mb-8">
      <h1 class="text-4xl md:text-5xl font-bold text-primary">Learn More</h1>
      <p class="text-lg text-base-content/80 mt-2">
        Connect with founders, investors, and the community.
      </p>
    </div>

    <div class="bg-base-100/90 rounded-3xl shadow-2xl border border-accent/30 overflow-hidden">
      <div class="p-8">
        <div role="tablist" class="tabs tabs-boxed grid grid-cols-2 bg-base-200/60">
          <button
            role="tab"
            class="tab text-base h-12"
            class:tab-active={view === 'interest'}
            on:click={() => view = 'interest'}
          >
            Register Interest
          </button>
          <button
            role="tab"
            class="tab text-base h-12"
            class:tab-active={view === 'register'}
            on:click={() => view = 'register'}
          >
            Event Registration
          </button>
        </div>
      </div>

      <div class="p-8 pt-0">
        {#if view === 'interest'}
          <div in:fade={{ duration: 300, delay: 150 }}>
            <h2 class="text-2xl font-semibold text-base-content mb-4 text-center">Register your interest <span class="ml-2 badge badge-outline">{year}</span></h2>
            {#if submitted}
              <div class="alert alert-success shadow mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <div>
                  <h3 class="font-bold">Thanks!</h3>
                  <div class="text-xs">We'll be in touch with details for the next quarterly event.</div>
                  <div class="mt-2 text-xs text-base-content/60">Submitted: {timestamp} | Year: {year} | Quarter: Q{quarter}</div>
                </div>
              </div>
            {:else}
              <ul class="steps w-full mb-6 text-base-content">
                <li class="step {step >= 0 ? 'step-primary' : ''}">Start</li>
                <li class="step {step >= 1 ? 'step-primary' : ''}">Interest</li>
                <li class="step {step >= 2 ? 'step-primary' : ''}">Details</li>
                <li class="step {step >= 3 ? 'step-primary' : ''}">Message</li>
                <li class="step {step >= 4 ? 'step-primary' : ''}">Consent</li>
              </ul>

              <div class="min-h-[180px]">
                {#if step === 0}
                  <div class="text-center" in:fade>
                    <h3 class="text-xl font-semibold mb-3 text-base-content">Have you pitched before?</h3>
                    <div class="join">
                      <button type="button" class="btn join-item {pitchedBefore === 'Yes' ? 'btn-primary' : 'btn-outline btn-base-300'}" on:click={() => { pitchedBefore = 'Yes'; next(); }}>Yes</button>
                      <button type="button" class="btn join-item {pitchedBefore === 'No' ? 'btn-primary' : 'btn-outline btn-base-300'}" on:click={() => { pitchedBefore = 'No'; next(); }}>No</button>
                    </div>
                  </div>
                {:else if step === 1}
                  <div in:fade>
                    <h3 class="text-xl font-semibold mb-3 text-center text-base-content">What are you interested in?</h3>
                    <div class="flex flex-wrap justify-center gap-3">
                      {#each interests as opt}
                        <button type="button" class="btn {interest === opt ? 'btn-primary' : 'btn-outline btn-base-300'}" on:click={() => { interest = opt; next(); }}>{opt}</button>
                      {/each}
                    </div>
                  </div>
                {:else if step === 2}
                  <div in:fade>
                    <h3 class="text-xl font-semibold mb-3 text-center text-base-content">Your details</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label class="form-control">
                        <div class="label"><span class="label-text text-base-content/80">Full name</span></div>
                        <input class="input input-bordered" bind:value={name} placeholder="Jane Doe" />
                      </label>
                      <label class="form-control">
                        <div class="label"><span class="label-text text-base-content/80">Email</span></div>
                        <input type="email" class="input input-bordered" bind:value={email} placeholder="you@example.com" />
                      </label>
                    </div>
                  </div>
                {:else if step === 3}
                  <div in:fade>
                    <h3 class="text-xl font-semibold mb-3 text-center text-base-content">Message (optional)</h3>
                    <div class="w-full max-w-xl mx-auto">
                      <label class="form-control">
                        <textarea class="textarea textarea-bordered min-h-28 w-full" bind:value={message} placeholder="Tell us a little about what you’re looking for..."></textarea>
                      </label>
                    </div>
                  </div>
                {:else if step === 4}
                  <div in:fade>
                    <h3 class="text-xl font-semibold mb-3 text-center text-base-content">Consent</h3>
                    <label class="label cursor-pointer justify-center gap-3 text-base-content/80">
                      <input type="checkbox" class="checkbox checkbox-accent" bind:checked={consent} />
                      <span class="label-text text-base-content/80">I agree to be contacted about upcoming quarterly events.</span>
                    </label>
                  </div>
                {/if}
              </div>

              <div class="mt-6 flex items-center justify-between">
                <button type="button" class="btn btn-outline btn-base-300" on:click={prev} disabled={step === 0}>Back</button>
                {#if step < 4}
                  <button type="button" class="btn btn-primary" on:click={next} disabled={!canNext()}>Next</button>
                {:else}
                  <button type="button" class="btn btn-primary" on:click={submitMulti} disabled={!consent}>Submit</button>
                {/if}
              </div>
            {/if}
          </div>
        {:else if view === 'register'}
          <div in:fade={{ duration: 300, delay: 150 }}>
            <h3 class="text-2xl font-bold text-center mb-4 text-base-content">Event Registration</h3>
            
            <div class="bg-base-200/80 rounded-xl p-6 mb-6 shadow-md border border-base-300">
              <div class="flex justify-center items-center mb-4">
                <h3 class="text-xl font-semibold">Next Event: Q{quarter} {year}</h3>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-base-content">
                <div class="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <div><span class="font-semibold">Date:</span> 9th September</div>
                </div>
                <div class="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div><span class="font-semibold">Time:</span> Evening Session</div>
                </div>
                <div class="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <div><span class="font-semibold">Location:</span> Baseline Community & Workspace, Dublin, Ireland</div>
                </div>
                <div class="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" /></svg>
                  <div><span class="font-semibold">Cost:</span> Free Event</div>
                </div>
              </div>
            </div>

            <div class="flex justify-center">
              <a
                href="https://lu.ma/event/evt-Hs6RP2j7Bkc8jGQ"
                class="luma-checkout--button btn btn-accent btn-lg px-8 py-3 rounded-full text-lg font-semibold shadow-xl flex items-center gap-2 transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-accent/50"
                data-luma-action="checkout"
                data-luma-event-id="evt-Hs6RP2j7Bkc8jGQ"
              >
                Register via Luma
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <div class="flex justify-center mt-8">
        <a href="/pitch" class="btn btn-ghost">← Back to Pitch</a>
    </div>
  </div>
</section>