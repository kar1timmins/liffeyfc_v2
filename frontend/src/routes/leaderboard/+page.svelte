<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    Trophy,
    Building2,
    TrendingUp,
    CheckCircle,
    Target,
    RefreshCw,
    ArrowUpRight,
    Medal,
    ArrowLeft
  } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';

  interface LeaderboardEntry {
    rank: number;
    id: string;
    name: string;
    description?: string;
    industry?: string;
    logoUrl?: string;
    completedBounties: number;
    activeBounties: number;
    totalBounties: number;

    totalRaisedEth: number;
    totalRaisedAvax: number;
    totalRaisedManualEur: number;
    totalRaisedEur: number; // combined eur value for ranking/display
  }

  let entries = $state<LeaderboardEntry[]>([]);
  let isLoading = $state(true);
  let isRefreshing = $state(false);
  let error = $state<string | null>(null);
  let lastUpdated = $state<Date | null>(null);
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  const REFRESH_INTERVAL_MS = 30_000;

  onMount(async () => {
    await fetchLeaderboard();
    refreshInterval = setInterval(async () => {
      if (!isLoading) {
        isRefreshing = true;
        await fetchLeaderboard(true);
        isRefreshing = false;
      }
    }, REFRESH_INTERVAL_MS);
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
  });

  async function fetchLeaderboard(silent = false) {
    if (!silent) isLoading = true;
    error = null;
    try {
      const res = await fetch(`${PUBLIC_API_URL}/bounties/leaderboard`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (body.success) {
        entries = body.data;
        lastUpdated = new Date();
      } else {
        throw new Error(body.message || 'Failed to load leaderboard');
      }
    } catch (err: any) {
      error = err.message ?? 'Could not load leaderboard';
    } finally {
      isLoading = false;
    }
  }

  function medalFor(rank: number): { emoji: string; class: string } | null {
    if (rank === 1) return { emoji: '🥇', class: 'text-yellow-400' };
    if (rank === 2) return { emoji: '🥈', class: 'text-zinc-400' };
    if (rank === 3) return { emoji: '🥉', class: 'text-amber-600' };
    return null;
  }

  function rowHighlight(rank: number): string {
    if (rank === 1) return 'border-yellow-400/40 bg-yellow-400/5';
    if (rank === 2) return 'border-zinc-400/40 bg-zinc-400/5';
    if (rank === 3) return 'border-amber-600/40 bg-amber-600/5';
    return 'border-base-300/50 bg-base-200/30';
  }

  function formatEth(val: number): string {
    if (!val || val === 0) return '0';
    if (val < 0.0001) return `< 0.0001`;
    return `${val.toFixed(4)}`;
  }

  function formatEur(val: number): string {
    if (!val || val === 0) return '€0';
    return `€${val.toFixed(2)}`;
  }

  const topThree = $derived(entries.slice(0, 3));
  const rest = $derived(entries.slice(3));
</script>

<svelte:head>
  <title>Leaderboard — Liffey Founders Club</title>
  <meta name="description" content="See which companies are leading the way in completing bounties and raising funds on the Liffey Founders Club platform." />
</svelte:head>

<div class="min-h-screen bg-base-100 pb-24">
  <!-- Header -->
  <div class="bg-gradient-to-b from-primary/10 to-base-100 border-b border-base-300 pt-20 pb-10 px-4">
    <div class="max-w-5xl mx-auto text-center">
      <div class="flex items-center justify-center gap-3 mb-4">
        <Trophy class="w-10 h-10 text-yellow-400" />
        <h1 class="text-4xl font-bold tracking-tight">Leaderboard</h1>
      </div>
      <p class="text-base-content/70 text-lg max-w-xl mx-auto">
        Companies ranked by total funds raised on-chain. Positions update dynamically as contributions flow in.
      </p>
      {#if lastUpdated}
        <div class="mt-3 flex items-center justify-center gap-2 text-xs text-base-content/40">
          <RefreshCw
            class="w-3 h-3 {isRefreshing ? 'animate-spin' : ''}"
          />
          <span>Updated {lastUpdated.toLocaleTimeString()} · auto-refreshes every 30 s</span>
        </div>
      {/if}
    </div>
  </div>

  <div class="max-w-5xl mx-auto px-4 pt-10 space-y-8">

    <!-- Error state -->
    {#if error}
      <div class="alert alert-error shadow-lg">
        <span>{error}</span>
        <button class="btn btn-sm btn-ghost" onclick={() => fetchLeaderboard()}>Retry</button>
      </div>
    {/if}

    <!-- Loading skeletons -->
    {#if isLoading}
      <div class="space-y-4">
        {#each { length: 5 } as _}
          <div class="glass-subtle rounded-2xl p-5 border border-base-300/50 animate-pulse">
            <div class="flex items-center gap-4">
              <div class="rounded-full bg-base-300 w-10 h-10 flex-shrink-0"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 bg-base-300 rounded w-1/3"></div>
                <div class="h-3 bg-base-300 rounded w-1/5"></div>
              </div>
              <div class="h-4 bg-base-300 rounded w-20"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if entries.length === 0 && !error}
      <!-- Empty state -->
      <div class="text-center py-16 space-y-4">
        <Trophy class="w-16 h-16 mx-auto opacity-20" />
        <h2 class="text-xl font-semibold opacity-50">No companies yet</h2>
        <p class="text-base-content/40 text-sm">Be the first to raise funds and top the leaderboard!</p>
        <button class="btn btn-primary mt-2" onclick={() => goto('/companies')}>
          Browse Companies
        </button>
      </div>
    {:else}
      <!-- ── Top 3 podium cards ── -->
      {#if topThree.length > 0}
        <section>
      <button class="btn mb-6 btn-ghost" onclick={() => goto('/dashboard')}>
				<ArrowLeft size={16} /> Back
			</button>
          <h2 class="text-sm font-semibold uppercase tracking-widest text-base-content/40 mb-4 flex items-center gap-2">
            <Medal class="w-4 h-4" /> Top Performers
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each topThree as entry (entry.id)}
              {@const medal = medalFor(entry.rank)}
              <div
                class="glass-subtle rounded-2xl p-5 border {rowHighlight(entry.rank)} cursor-pointer hover:scale-[1.02] transition-transform"
                role="button"
                tabindex="0"
                onclick={() => goto(`/companies/${entry.id}`)}
                onkeydown={(e) => e.key === 'Enter' && goto(`/companies/${entry.id}`)}
              >
                <!-- Rank + medal -->
                <div class="flex items-start justify-between mb-3">
                  <span class="text-3xl">{medal?.emoji ?? `#${entry.rank}`}</span>
                  <span class="badge badge-sm badge-outline opacity-60">#{entry.rank}</span>
                </div>

                <!-- Name & industry -->
                <div class="mb-4">
                  <h3 class="font-bold text-lg leading-tight">{entry.name}</h3>
                  {#if entry.industry}
                    <span class="text-xs text-base-content/50">{entry.industry}</span>
                  {/if}
                </div>

                <!-- Stats grid -->
                <div class="grid grid-cols-3 gap-2 text-center text-xs">
                  <div class="bg-base-100/60 rounded-lg p-2">
                    <div class="font-bold text-success text-base">{entry.completedBounties}</div>
                    <div class="opacity-50 leading-tight">Completed</div>
                  </div>
                  <div class="bg-base-100/60 rounded-lg p-2">
                    <div class="font-bold text-info text-base">{entry.activeBounties}</div>
                    <div class="opacity-50 leading-tight">Active</div>
                  </div>
                  <div class="bg-base-100/60 rounded-lg p-2">
                    <div class="font-bold text-primary text-base">{formatEur(entry.totalRaisedEur)}</div>
                    <div class="opacity-50 leading-tight">
                      {entry.totalRaisedEth.toFixed(3)} ETH
                      {entry.totalRaisedAvax > 0 ? ` / ${entry.totalRaisedAvax.toFixed(3)} AVAX` : ''}
                      {#if entry.totalRaisedManualEur > 0}
                        <br />+ {formatEur(entry.totalRaisedManualEur)} non‑EVM
                      {/if}
                    </div>
                  </div>
                </div>

                <!-- View link -->
                <div class="mt-3 flex justify-end">
                  <span class="text-xs text-primary flex items-center gap-1 opacity-70 hover:opacity-100">
                    View <ArrowUpRight class="w-3 h-3" />
                  </span>
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- ── Full ranked list ── -->
      {#if entries.length > 0}
        <section>
          <h2 class="text-sm font-semibold uppercase tracking-widest text-base-content/40 mb-4 flex items-center gap-2">
            <TrendingUp class="w-4 h-4" /> Full Rankings
          </h2>

          <!-- Desktop table -->
          <div class="hidden md:block overflow-x-auto rounded-2xl border border-base-300/50">
            <table class="table table-zebra w-full">
              <thead class="bg-base-200">
                <tr>
                  <th class="w-16 text-center">Rank</th>
                  <th>Company</th>
                  <th class="text-center">
                    <span class="flex items-center justify-center gap-1">
                      <CheckCircle class="w-3.5 h-3.5 text-success" /> Completed
                    </span>
                  </th>
                  <th class="text-center">
                    <span class="flex items-center justify-center gap-1">
                      <Target class="w-3.5 h-3.5 text-info" /> Active
                    </span>
                  </th>
                  <th class="text-right">
                    <span class="flex items-center justify-end gap-1">
                      <TrendingUp class="w-3.5 h-3.5 text-primary" /> Total Raised (€)
                    </span>
                  </th>
                  <th class="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {#each entries as entry (entry.id)}
                  {@const medal = medalFor(entry.rank)}
                  <tr
                    class="hover cursor-pointer"
                    onclick={() => goto(`/companies/${entry.id}`)}
                  >
                    <td class="text-center font-bold">
                      {#if medal}
                        <span class="text-xl">{medal.emoji}</span>
                      {:else}
                        <span class="text-base-content/50">#{entry.rank}</span>
                      {/if}
                    </td>
                    <td>
                      <div class="flex items-center gap-3">
                        <div class="avatar placeholder">
                          <div class="bg-primary/20 text-primary rounded-full w-9 h-9 flex items-center justify-center">
                            {#if entry.logoUrl}
                              <img src={entry.logoUrl} alt={entry.name} class="rounded-full object-cover" />
                            {:else}
                              <Building2 class="w-5 h-5" />
                            {/if}
                          </div>
                        </div>
                        <div>
                          <div class="font-semibold text-sm">{entry.name}</div>
                          {#if entry.industry}
                            <div class="text-xs opacity-50">{entry.industry}</div>
                          {/if}
                        </div>
                      </div>
                    </td>
                    <td class="text-center">
                      <span class="badge badge-success badge-sm font-semibold">
                        {entry.completedBounties}
                      </span>
                    </td>
                    <td class="text-center">
                      <span class="badge badge-info badge-sm font-semibold">
                        {entry.activeBounties}
                      </span>
                    </td>
                    <td class="text-right font-mono font-semibold text-primary">
                      {formatEur(entry.totalRaisedEur)}
                      <div class="text-xs opacity-50">
                        {entry.totalRaisedEth.toFixed(3)} ETH
                        {#if entry.totalRaisedAvax > 0}
                          / {entry.totalRaisedAvax.toFixed(3)} AVAX
                        {/if}
                      </div>
                    </td>
                    <td>
                      <ArrowUpRight class="w-4 h-4 opacity-30" />
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Mobile card list -->
          <div class="md:hidden space-y-3">
            {#each entries as entry (entry.id)}
              {@const medal = medalFor(entry.rank)}
              <div
                class="glass-subtle rounded-xl p-4 border {rowHighlight(entry.rank)} cursor-pointer active:scale-[0.98] transition-transform"
                role="button"
                tabindex="0"
                onclick={() => goto(`/companies/${entry.id}`)}
                onkeydown={(e) => e.key === 'Enter' && goto(`/companies/${entry.id}`)}
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <span class="text-xl w-7 text-center">
                      {medal ? medal.emoji : `#${entry.rank}`}
                    </span>
                    <div>
                      <div class="font-semibold text-sm">{entry.name}</div>
                      {#if entry.industry}
                        <div class="text-xs opacity-50">{entry.industry}</div>
                      {/if}
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="font-mono font-bold text-primary text-sm">{formatEur(entry.totalRaisedEur)}</div>
                    <div class="text-xs opacity-50">
                      {entry.totalRaisedEth.toFixed(3)} ETH
                      {#if entry.totalRaisedAvax > 0}
                        / {entry.totalRaisedAvax.toFixed(3)} AVAX
                      {/if}
                      {#if entry.totalRaisedManualEur > 0}
                        • {formatEur(entry.totalRaisedManualEur)} non‑EVM
                      {/if}
                      • {entry.completedBounties} completed
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}
    {/if}

  </div>
</div>
