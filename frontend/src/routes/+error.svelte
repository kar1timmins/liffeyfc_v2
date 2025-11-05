<script lang="ts">
  import { goto } from '$app/navigation';
  export let error: Error | null;
  export let status: number;

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
  {#if status === 404}
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
      <p class="text-base-content/70 mb-4">An unexpected error occurred (status: {status}).</p>
      {#if error}
        <details class="collapse collapse-arrow border border-base-200 bg-base-100 p-3 rounded-md">
          <summary class="cursor-pointer">Error details</summary>
          <pre class="whitespace-pre-wrap text-xs mt-2">{error.message}</pre>
        </details>
      {/if}
      <div class="mt-4">
        <button class="btn btn-primary mr-2" on:click={goHome}>Go home</button>
      </div>
    </div>
  {/if}
</main>
