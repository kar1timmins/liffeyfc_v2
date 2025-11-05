<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth';
  import { goto } from '$app/navigation';

  let user: any = null;

  onMount(async () => {
    const ok = await authStore.verify();
    if (!ok) {
      goto('/auth');
      return;
    }
    authStore.subscribe((s) => {
      user = s.user;
    })();
  });
</script>

<div class="container mx-auto p-6">
  <div class="card bg-base-100 shadow-md p-6 max-w-xl mx-auto">
    <h2 class="text-2xl font-bold mb-4">Your Profile</h2>
    {#if user}
      <div class="space-y-2">
        <div><strong>Name:</strong> {user.name || '—'}</div>
        <div><strong>Email:</strong> {user.email || '—'}</div>
        {#if user.provider}
          <div><strong>Signed in with:</strong> {user.provider}</div>
        {/if}
      </div>
    {:else}
      <p>Loading profile…</p>
    {/if}
  </div>
</div>
