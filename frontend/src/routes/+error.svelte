<script lang="ts">
  import { goto } from '$app/navigation';
  export let error: Error | null;
  export let status: number | undefined;

  // Normalise status: some SvelteKit flows may not populate `status` directly.
  // Prefer explicit `status`, otherwise fall back to `error.status` or 500.
  let displayStatus: number;
  $: displayStatus = typeof status === 'number' ? status : (error && (error as any).status) ?? 500;

  function goHome() {
    goto('/');
  }

  function goAuth() {
    goto('/auth');
  }
</script>

<style>
  /* minimal local styles to ensure centered layout */
  .error-container { max-width: 720px; margin: 40px auto; }
</style>

<main class="error-container px-4">
  {#if displayStatus === 404}
    <div class="card bg-base-100 shadow-lg p-8 text-center">
      <h1 class="text-4xl font-bold mb-2">404 — Page not found</h1>
      <p class="text-base-content/70 mb-4">We couldn't find the page you're looking for.</p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
        <button class="btn btn-primary" on:click={goHome}>Go home</button>
        <button class="btn btn-ghost" on:click={goAuth}>Sign in</button>
      </div>
    </div>
  {:else}
    <div class="card bg-base-100 shadow-lg p-8">
      <h1 class="text-3xl font-semibold mb-2">Something went wrong</h1>
      <p class="text-base-content/70 mb-4">Sorry — we couldn't complete that action right now. You can try the following:</p>
      <ul class="list-disc list-inside text-base-content/70 space-y-2 mb-4">
        <li>Refresh the page.</li>
        <li>Return to the homepage and try the action again.</li>
        <li>If the problem persists, sign in and retry or contact the team for help.</li>
      </ul>

      {#if error}
        <details class="collapse collapse-arrow border border-base-200 bg-base-100 p-3 rounded-md">
          <summary class="cursor-pointer">Show technical details (hidden)</summary>
          <pre class="whitespace-pre-wrap text-xs mt-2">{error.message}</pre>
        </details>
      {/if}

      <div class="mt-4 flex flex-wrap gap-3">
        <button class="btn btn-primary" on:click={goHome}>Go home</button>
        <button class="btn btn-ghost" on:click={goAuth}>Sign in</button>
      </div>
    </div>
  {/if}
</main>
