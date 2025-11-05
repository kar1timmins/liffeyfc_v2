<script lang="ts">
  import { toastStore, type Toast } from '$lib/stores/toast';
  import { fly, fade } from 'svelte/transition';
  import { derived } from 'svelte/store';

  const toasts = toastStore;
  // reverse order so newest appear on top
  const items = derived(toasts, ($t) => [...$t].reverse());
</script>

<style>
  .toast-container {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 320px;
  }
  .toast {
    padding: 0.75rem 1rem;
    border-radius: 8px;
    box-shadow: 0 6px 18px rgba(0,0,0,0.08);
    color: white;
    font-weight: 500;
  }
  .success { background: #16a34a; }
  .info { background: #0ea5e9; }
  .warning { background: #f59e0b; }
  .error { background: #ef4444; }
</style>

<div class="toast-container" aria-live="polite">
  {#each $items as t (t.id)}
    <div
      class="toast {t.type}"
      in:fly={{ x: 100, duration: 220 }}
      out:fade={{ duration: 160 }}
      role="status"
    >
      {t.message}
    </div>
  {/each}
</div>
