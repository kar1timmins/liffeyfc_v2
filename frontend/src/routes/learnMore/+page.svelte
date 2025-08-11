<script lang="ts">
  import { river } from '$lib/river';
  let submitted = false;
  let step = 0;

  function handleSubmit(e: Event) {
    e.preventDefault();
    submitted = true;
  }
  const interests = [
    'Attending',
    'Pitching my business',
    'Investing / Partnering'
  ];
  let name = '';
  let email = '';
  let interest = interests[0];
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

<div in:river out:river>
<section class="min-h-screen flex flex-col items-center justify-center bg-base-200/80 px-4 py-16">
  <div class="max-w-3xl w-full bg-white/90 rounded-3xl shadow-2xl p-8 md:p-10 border border-accent/30">
      <h1 class="text-3xl md:text-4xl font-bold text-primary mb-3 text-center">Learn More</h1>
    <p class="text-lg text-slate-700 mb-8 text-center">
      Our events connect founders, investors, and the local community through focused, high-impact pitching sessions.
    </p>

    <div class="mb-10">
      <h2 class="text-2xl font-semibold text-slate-800 mb-3 text-center">Event Details <span class="ml-2 badge badge-outline">{year}</span></h2>
      <p class="text-slate-700 text-center">
        We host events on a quarterly basis (once per quarter: Q1, Q2, Q3, and Q4).<br>
        Register your interest below and we’ll keep you informed about the next date and how to get involved.
      </p>
      <div class="flex flex-wrap justify-center gap-3 mt-4">
        <span class="badge badge-lg {quarter === 1 ? 'badge-primary ring-2 ring-primary scale-110' : 'badge-ghost'}">Q1</span>
        <span class="badge badge-lg {quarter === 2 ? 'badge-secondary ring-2 ring-secondary scale-110' : 'badge-ghost'}">Q2</span>
        <span class="badge badge-lg {quarter === 3 ? 'badge-accent ring-2 ring-accent scale-110' : 'badge-ghost'}">Q3</span>
        <span class="badge badge-lg {quarter === 4 ? 'badge-info ring-2 ring-info scale-110' : 'badge-ghost'}">Q4</span>
      </div>
    </div>

    <div class="mb-6">
  <h2 class="text-2xl font-semibold text-slate-800 mb-4 text-center">Register your interest <span class="ml-2 badge badge-outline">{year}</span></h2>
      {#if submitted}
        <div class="alert alert-success shadow mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>Thanks! We'll be in touch with details for the next quarterly event.</span>
          <div class="mt-2 text-xs text-slate-500">Submitted: {timestamp} | Year: {year} | Quarter: Q{quarter}</div>
        </div>
      {:else}
        <ul class="steps w-full mb-6 text-slate-800">
          <li class="step {step >= 0 ? 'step-primary' : ''}">Start</li>
          <li class="step {step >= 1 ? 'step-primary' : ''}">Interest</li>
          <li class="step {step >= 2 ? 'step-primary' : ''}">Details</li>
          <li class="step {step >= 3 ? 'step-primary' : ''}">Message</li>
          <li class="step {step >= 4 ? 'step-primary' : ''}">Consent</li>
        </ul>

        {#if step === 0}
          <div class="text-center">
            <h3 class="text-xl font-semibold mb-3 text-slate-800">Have you pitched before?</h3>
            <div class="join">
              <button type="button" class="btn join-item {pitchedBefore === 'Yes' ? 'btn-primary' : 'btn-outline btn-neutral'}" on:click={() => { pitchedBefore = 'Yes'; next(); }}>Yes</button>
              <button type="button" class="btn join-item {pitchedBefore === 'No' ? 'btn-primary' : 'btn-outline btn-neutral'}" on:click={() => { pitchedBefore = 'No'; next(); }}>No</button>
            </div>
          </div>
        {:else if step === 1}
          <div>
            <h3 class="text-xl font-semibold mb-3 text-center text-slate-800">What are you interested in?</h3>
            <div class="flex flex-wrap justify-center gap-3">
              {#each interests as opt}
                <button type="button" class="btn {interest === opt ? 'btn-primary' : 'btn-outline btn-neutral'}" on:click={() => { interest = opt; next(); }}>{opt}</button>
              {/each}
            </div>
          </div>
        {:else if step === 2}
          <div>
            <h3 class="text-xl font-semibold mb-3 text-center text-slate-800">Your details</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label class="form-control">
                <div class="label"><span class="label-text text-slate-700">Full name</span></div>
                <input class="input input-bordered" bind:value={name} placeholder="Jane Doe" />
              </label>
              <label class="form-control">
                <div class="label"><span class="label-text text-slate-700">Email</span></div>
                <input type="email" class="input input-bordered" bind:value={email} placeholder="you@example.com" />
              </label>
            </div>
          </div>
        {:else if step === 3}
          <div>
            <h3 class="text-xl font-semibold mb-3 text-center text-slate-800">Message (optional)</h3>
            <div class="w-full max-w-xl mx-auto">
              <label class="form-control">
                <textarea class="textarea textarea-bordered min-h-28 w-full" bind:value={message} placeholder="Tell us a little about what you’re looking for..."></textarea>
              </label>
            </div>
          </div>
        {:else if step === 4}
          <div>
            <h3 class="text-xl font-semibold mb-3 text-center text-slate-800">Consent</h3>
            <label class="label cursor-pointer justify-center gap-3 text-slate-700">
              <input type="checkbox" class="checkbox checkbox-accent" bind:checked={consent} />
              <span class="label-text text-slate-700">I agree to be contacted about upcoming quarterly events.</span>
            </label>
          </div>
        {/if}

        <div class="mt-6 flex items-center justify-between">
          <button type="button" class="btn btn-outline btn-neutral" on:click={prev} disabled={step === 0}>Back</button>
          {#if step < 4}
            <button type="button" class="btn btn-primary" on:click={next} disabled={!canNext()}>Next</button>
          {:else}
            <button type="button" class="btn btn-primary" on:click={submitMulti} disabled={!consent}>Submit</button>
          {/if}
        </div>
      {/if}
    </div>

    <div class="flex justify-center">
        <a href="/pitch" class="btn btn-secondary">← Back to Pitch</a>
    </div>
  </div>
</section>
</div>
