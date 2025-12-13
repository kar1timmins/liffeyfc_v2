<script lang="ts">
  import { toastStore, type Toast } from '$lib/stores/toast';
  import { fly, fade } from 'svelte/transition';
  import { derived } from 'svelte/store';

  const toasts = toastStore;
  // reverse order so newest appear on top
  const items = derived(toasts, ($t) => [...$t].reverse());

  function truncate(addr: string) {
    if (!addr) return '';
    return `${addr.slice(0,6)}...${addr.slice(-4)}`;
  }

  function explorerUrl(chain: string, address: string) {
    if (!address) return '#';
    return chain === 'ethereum'
      ? `https://sepolia.etherscan.io/address/${address}`
      : `https://testnet.snowtrace.io/address/${address}`;
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
  }
</script>

<style>
  .toast-container {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 380px;
    width: calc(min(95vw, 380px));
    pointer-events: none;
  }
  .toast {
    padding: 0.75rem 1rem;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(2,6,23,0.12);
    color: white;
    font-weight: 500;
    pointer-events: auto;
  }
  .success { background: linear-gradient(180deg,#16a34a,#0f9a3a); }
  .info { background: linear-gradient(180deg,#0ea5e9,#0891b2); }
  .warning { background: linear-gradient(180deg,#f59e0b,#d97706); }
  .error { background: linear-gradient(180deg,#ef4444,#dc2626); }

  .toast-rich {
    padding: 0.75rem;
    background: var(--tw-colors-base-200, #f8fafc);
    color: var(--tw-colors-base-content, #0f172a);
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(2,6,23,0.08);
  }
  .rich-header { display:flex; align-items:center; gap:0.5rem; justify-content:space-between }
  .rich-title { font-weight:700; font-size:0.95rem }
  .address-row { display:flex; align-items:center; justify-content:space-between; gap:0.5rem; margin-top:0.5rem }
  .address-left { display:flex; gap:0.75rem; align-items:center }
  .chip { background: rgba(0,0,0,0.04); padding:0.25rem 0.5rem; border-radius:6px; font-size:0.8rem }
  .small { font-size:0.85rem; opacity:0.8 }
  .toast-actions { display:flex; gap:0.5rem; margin-top:0.5rem }
  .btn-ghost { background:transparent; border:none; color:inherit; cursor:pointer; font-weight:600 }
</style>

<div class="toast-container" aria-live="polite">
  {#each $items as t (t.id)}
    {#if t.data && (t.data.addresses || t.data.campaignName)}
      <div class="toast-rich" in:fly={{ x: 100, duration: 220 }} out:fade={{ duration: 160 }} role="status">
        <div class="rich-header">
          <div class="rich-title">{t.message ?? t.data.campaignName ?? 'Contract Deployed'}</div>
          <button class="btn-ghost" aria-label="Dismiss" on:click={() => toastStore.remove(t.id)}>✕</button>
        </div>
        {#if t.data?.campaignDescription}
          <div class="small mt-1">{t.data.campaignDescription}</div>
        {/if}

        {#if t.data?.addresses}
          {#each t.data.addresses as addr}
            <div class="address-row">
              <div class="address-left">
                <div class="chip">{addr.chain}</div>
                <div class="small">{truncate(addr.address)}</div>
              </div>
              <div class="flex items-center gap-2">
                <button class="btn-ghost" on:click={() => copy(addr.address)}>Copy</button>
                <a class="btn-ghost" target="_blank" rel="noopener" href={explorerUrl(addr.chain, addr.address)}>Explorer</a>
              </div>
            </div>
          {/each}
        {/if}

      </div>
    {:else}
      <div
        class="toast {t.type}"
        in:fly={{ x: 100, duration: 220 }}
        out:fade={{ duration: 160 }}
        role="status"
      >
        <div class="flex items-center justify-between">
          <div>{t.message}</div>
          <button class="btn-ghost" aria-label="Dismiss" on:click={() => toastStore.remove(t.id)}>✕</button>
        </div>
      </div>
    {/if}
  {/each}
</div>
