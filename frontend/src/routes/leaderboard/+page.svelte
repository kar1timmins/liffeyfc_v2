<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import {
    Trophy,
    Building2,
    TrendingUp,
    CheckCircle,
    Target,
    RefreshCw,
    ArrowUpRight,
    Medal,
    ArrowLeft,
    Search,
    X,
    Share2,
    Check,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    Clock,
    Zap,
    Users,
    ExternalLink
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
    totalRaisedEur: number;
  }

  interface BountyInfo {
    id: string;
    title: string;
    description?: string;
    status: string;
    targetAmountEur: number;
    totalRaisedEur: number;
    progressPercentage: number;
    contributorCount: number;
    deadline: string;
    ethereumEscrowAddress?: string | null;
    avalancheEscrowAddress?: string | null;
    company?: { id: string; name: string };
  }

  type SortKey =
    | 'rank'
    | 'totalRaisedEur'
    | 'totalRaisedEth'
    | 'totalRaisedAvax'
    | 'completedBounties'
    | 'activeBounties';

  // ── Core data ──────────────────────────────────────────────────────────────
  let entries = $state<LeaderboardEntry[]>([]);
  let isLoading = $state(true);
  let isRefreshing = $state(false);
  let error = $state<string | null>(null);
  let lastUpdated = $state<Date | null>(null);
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  // ── Filters & sort ─────────────────────────────────────────────────────────
  let searchQuery = $state('');
  let selectedIndustry = $state<string | null>(null);
  let sortKey = $state<SortKey>('rank');
  let sortDir = $state<'asc' | 'desc'>('asc');

  // ── Rank delta tracker ─────────────────────────────────────────────────────
  let rankSnapshot = new Map<string, number>(); // id → rank before last refresh

  // ── "My company" highlight ─────────────────────────────────────────────────
  let myCompanyIds = $state<Set<string>>(new Set());

  // ── Animated EUR values ────────────────────────────────────────────────────
  let displayedEurMap = $state<Map<string, number>>(new Map());
  const tweenFrames = new Map<string, number>(); // rAF handles

  // ── Social share ───────────────────────────────────────────────────────────
  let copiedShareId = $state<string | null>(null);

  // ── Quick-view drawer ─────────────────────────────────────────────────────
  let quickViewEntry = $state<LeaderboardEntry | null>(null);
  let quickViewBounties = $state<BountyInfo[]>([]);
  let quickViewLoading = $state(false);
  // $state Map — Svelte 5 proxies .set()/.get() so template reads react automatically
  let quickViewCache = $state(new Map<string, BountyInfo[]>());

  // ── Expandable rows ───────────────────────────────────────────────────────
  let expandedIds = $state<Set<string>>(new Set());
  let expandingIds = $state<Set<string>>(new Set());

  async function toggleExpand(entry: LeaderboardEntry, e: MouseEvent | KeyboardEvent) {
    e.stopPropagation();
    if (expandedIds.has(entry.id)) {
      expandedIds = new Set([...expandedIds].filter((id) => id !== entry.id));
      return;
    }
    expandedIds = new Set([...expandedIds, entry.id]);
    if (!quickViewCache.has(entry.id)) {
      expandingIds = new Set([...expandingIds, entry.id]);
      try {
        const res = await fetch(`${PUBLIC_API_URL}/bounties/company/${entry.id}`);
        if (res.ok) {
          const body = await res.json();
          quickViewCache.set(entry.id, (body.data || []) as BountyInfo[]);
        }
      } catch { /* silent */ } finally {
        expandingIds = new Set([...expandingIds].filter((id) => id !== entry.id));
      }
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const industries = $derived(
    Array.from(new Set(entries.map((e) => e.industry).filter(Boolean) as string[])).sort()
  );

  const filteredEntries = $derived.by(() => {
    let list = entries;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.industry?.toLowerCase().includes(q)
      );
    }
    if (selectedIndustry) {
      list = list.filter((e) => e.industry === selectedIndustry);
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'rank') cmp = a.rank - b.rank;
      else if (sortKey === 'totalRaisedEur') cmp = a.totalRaisedEur - b.totalRaisedEur;
      else if (sortKey === 'totalRaisedEth') cmp = a.totalRaisedEth - b.totalRaisedEth;
      else if (sortKey === 'totalRaisedAvax') cmp = a.totalRaisedAvax - b.totalRaisedAvax;
      else if (sortKey === 'completedBounties') cmp = a.completedBounties - b.completedBounties;
      else if (sortKey === 'activeBounties') cmp = a.activeBounties - b.activeBounties;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  });

  const topThree = $derived(filteredEntries.slice(0, 3));
  const rest = $derived(filteredEntries.slice(3));

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
    fetchMyCompanies();
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    for (const handle of tweenFrames.values()) cancelAnimationFrame(handle);
  });

  async function fetchLeaderboard(silent = false) {
    if (!silent) isLoading = true;
    error = null;
    try {
      const res = await fetch(`${PUBLIC_API_URL}/bounties/leaderboard`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (body.success) {
        const incoming = body.data as LeaderboardEntry[];
        // snapshot current ranks before overwrite
        for (const e of entries) rankSnapshot.set(e.id, e.rank);
        // kick off EUR tweens
        for (const inc of incoming) {
          const prev = displayedEurMap.get(inc.id) ?? inc.totalRaisedEur;
          tweenEur(inc.id, prev, inc.totalRaisedEur);
        }
        entries = incoming;
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

  async function fetchMyCompanies() {
    const token = $authStore.accessToken;
    if (!token) return;
    try {
      const res = await fetch(`${PUBLIC_API_URL}/companies/my-companies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        myCompanyIds = new Set((data.data as any[]).map((c) => c.id));
      }
    } catch { /* silent */ }
  }

  // ── Animated number tween (ease-out cubic, 600 ms) ─────────────────────────
  function tweenEur(id: string, from: number, to: number) {
    const prev = tweenFrames.get(id);
    if (prev !== undefined) cancelAnimationFrame(prev);
    if (from === to) { displayedEurMap = new Map(displayedEurMap).set(id, to); return; }
    const duration = 600;
    const start = performance.now();
    function step(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      displayedEurMap = new Map(displayedEurMap).set(id, from + (to - from) * eased);
      if (t < 1) {
        tweenFrames.set(id, requestAnimationFrame(step));
      } else {
        tweenFrames.delete(id);
      }
    }
    tweenFrames.set(id, requestAnimationFrame(step));
  }

  // ── Quick-view drawer ───────────────────────────────────────────────────────
  async function openQuickView(entry: LeaderboardEntry, e?: MouseEvent | KeyboardEvent) {
    e?.stopPropagation();
    quickViewEntry = entry;
    quickViewBounties = quickViewCache.get(entry.id) ?? [];
    if (!quickViewCache.has(entry.id)) {
      quickViewLoading = true;
      try {
        const res = await fetch(`${PUBLIC_API_URL}/bounties/company/${entry.id}`);
        if (res.ok) {
          const body = await res.json();
          const data = (body.data || []) as BountyInfo[];
          quickViewCache.set(entry.id, data);
          quickViewBounties = data;
        }
      } catch { /* empty */ } finally {
        quickViewLoading = false;
      }
    }
  }

  function closeQuickView() {
    quickViewEntry = null;
    quickViewBounties = [];
  }

  // ── Column sort ────────────────────────────────────────────────────────────
  function setSort(key: SortKey) {
    if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = key; sortDir = key === 'rank' ? 'asc' : 'desc'; }
  }

  // ── Rank delta ─────────────────────────────────────────────────────────────
  function rankDelta(entry: LeaderboardEntry): number {
    const prev = rankSnapshot.get(entry.id);
    return prev === undefined ? 0 : prev - entry.rank; // positive = moved up
  }

  // ── Social share ────────────────────────────────────────────────────────────
  async function copyShareLink(entry: LeaderboardEntry, e: MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/companies/${entry.id}`;
    const text = `${entry.name} has raised ${formatEur(entry.totalRaisedEur)} in bounties on Liffey Founders Club! ${url}`;
    try {
      await navigator.clipboard.writeText(text);
      copiedShareId = entry.id;
      setTimeout(() => (copiedShareId = null), 2000);
    } catch { /* clipboard not available */ }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function nearestCountdown(bounties: BountyInfo[]): string | null {
    const active = bounties.filter((b) => b.status === 'active' && b.deadline);
    if (!active.length) return null;
    active.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    const ms = new Date(active[0].deadline).getTime() - Date.now();
    if (ms <= 0) return 'Ending soon';
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    const mins = Math.floor((ms % 3_600_000) / 60_000);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h ${mins}m`;
  }

  function daysLeft(deadline: string): string {
    const ms = new Date(deadline).getTime() - Date.now();
    if (ms <= 0) return 'Ended';
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  }

  function medalFor(rank: number) {
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
    if (val < 0.0001) return '< 0.0001';
    return `${val.toFixed(4)}`;
  }

  function formatEur(val: number): string {
    if (!val || val === 0) return '€0';
    return `€${val.toFixed(2)}`;
  }

  function fmtEurAnimated(entry: LeaderboardEntry): string {
    return formatEur(displayedEurMap.get(entry.id) ?? entry.totalRaisedEur);
  }

  const isInvestor = $derived(
    $authStore.isAuthenticated &&
      ($authStore.user?.role === 'investor' || $authStore.user?.role === 'staff')
  );
</script>

<svelte:head>
  <title>Leaderboard — Liffey Founders Club</title>
  <meta name="description" content="See which companies are leading the way in completing bounties and raising funds on the Liffey Founders Club platform." />
</svelte:head>

<!-- ── Quick-view drawer ───────────────────────────────────────────────────── -->
{#if quickViewEntry}
  <!-- backdrop -->
  <div
    class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
    role="button"
    tabindex="-1"
    onclick={closeQuickView}
    onkeydown={(e) => e.key === 'Escape' && closeQuickView()}
    aria-label="Close quick view"
  ></div>

  <!-- panel -->
  <aside
    class="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-base-100 shadow-2xl border-l border-base-300 flex flex-col overflow-y-auto"
  >
    <!-- header -->
    <div class="flex items-start justify-between p-5 border-b border-base-300 bg-base-200/60">
      <div class="flex-1 min-w-0 pr-3">
        <h2 class="font-bold text-lg leading-tight truncate">{quickViewEntry.name}</h2>
        {#if quickViewEntry.industry}
          <span class="badge badge-sm badge-outline mt-1">{quickViewEntry.industry}</span>
        {/if}
      </div>
      <button class="btn btn-sm btn-ghost btn-circle" onclick={closeQuickView} aria-label="Close">
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- body -->
    <div class="flex-1 p-5 space-y-5">
      {#if quickViewEntry.description}
        <p class="text-sm text-base-content/70 leading-relaxed">{quickViewEntry.description}</p>
      {/if}

      <!-- rank + stats row -->
      <div class="grid grid-cols-3 gap-2 text-center text-xs">
        <div class="bg-base-200 rounded-lg p-2">
          <div class="font-bold text-base">{medalFor(quickViewEntry.rank)?.emoji ?? `#${quickViewEntry.rank}`}</div>
          <div class="opacity-50">Rank</div>
        </div>
        <div class="bg-base-200 rounded-lg p-2">
          <div class="font-bold text-success text-base">{quickViewEntry.completedBounties}</div>
          <div class="opacity-50">Completed</div>
        </div>
        <div class="bg-base-200 rounded-lg p-2">
          <div class="font-bold text-primary text-base">{fmtEurAnimated(quickViewEntry)}</div>
          <div class="opacity-50">Raised</div>
        </div>
      </div>

      <!-- nearest countdown -->
      {#if nearestCountdown(quickViewBounties)}
        <div class="flex items-center gap-2 text-sm bg-warning/10 border border-warning/30 rounded-lg px-3 py-2">
          <Clock class="w-4 h-4 text-warning flex-shrink-0" />
          <span class="text-warning font-semibold">Nearest deadline: {nearestCountdown(quickViewBounties)}</span>
        </div>
      {/if}

      <!-- bounties -->
      <div>
        <h3 class="text-xs font-semibold uppercase tracking-widest text-base-content/40 mb-3 flex items-center gap-2">
          <Zap class="w-3 h-3" /> Active Bounties
        </h3>

        {#if quickViewLoading}
          <div class="flex justify-center py-8">
            <span class="loading loading-spinner loading-md text-primary"></span>
          </div>
        {:else if quickViewBounties.length === 0}
          <p class="text-sm text-base-content/40 text-center py-6">No bounties found.</p>
        {:else}
          <div class="space-y-3">
            {#each quickViewBounties as bounty (bounty.id)}
              <div class="bg-base-200/60 rounded-xl p-3 space-y-2">
                <div class="flex items-start justify-between gap-2">
                  <span class="text-sm font-medium leading-tight">{bounty.title}</span>
                  <span class="badge badge-xs flex-shrink-0
                    {bounty.status === 'active' ? 'badge-info' :
                     bounty.status === 'funded' ? 'badge-success' : 'badge-ghost'}">
                    {bounty.status}
                  </span>
                </div>

                <!-- progress bar -->
                <div>
                  <div class="flex justify-between text-xs opacity-60 mb-1">
                    <span>€{bounty.totalRaisedEur.toFixed(0)} raised</span>
                    <span>Goal €{bounty.targetAmountEur.toFixed(0)}</span>
                  </div>
                  <div class="w-full bg-base-300 rounded-full h-1.5">
                    <div
                      class="h-1.5 rounded-full {bounty.status === 'funded' ? 'bg-success' : 'bg-primary'}"
                      style="width: {Math.min(bounty.progressPercentage, 100)}%"
                    ></div>
                  </div>
                </div>

                <!-- deadline + contributors -->
                <div class="flex items-center justify-between text-xs opacity-50">
                  {#if bounty.deadline}
                    <span class="flex items-center gap-1">
                      <Clock class="w-3 h-3" /> {daysLeft(bounty.deadline)}
                    </span>
                  {/if}
                  <span class="flex items-center gap-1">
                    <Users class="w-3 h-3" /> {bounty.contributorCount} contributors
                  </span>
                </div>

                <!-- CTA: visible to investors only -->
                {#if isInvestor && bounty.status === 'active'}
                  <button
                    class="btn btn-xs btn-primary w-full mt-1 gap-1"
                    onclick={() => goto(`/companies/${quickViewEntry!.id}`)}
                  >
                    <ExternalLink class="w-3 h-3" /> Contribute
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- footer -->
    <div class="p-4 border-t border-base-300">
      <button
        class="btn btn-outline btn-sm w-full gap-2"
        onclick={() => { closeQuickView(); goto(`/companies/${quickViewEntry!.id}`); }}
      >
        <ExternalLink class="w-4 h-4" /> View Full Company Page
      </button>
    </div>
  </aside>
{/if}

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
          <RefreshCw class="w-3 h-3 {isRefreshing ? 'animate-spin' : ''}" />
          <span>Updated {lastUpdated.toLocaleTimeString()} · auto-refreshes every 30 s</span>
        </div>
      {/if}
    </div>
  </div>

  <div class="max-w-5xl mx-auto px-4 pt-8 space-y-6">

    <!-- Back + search row -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <button class="btn btn-ghost btn-sm gap-1" onclick={() => goto('/dashboard')}>
        <ArrowLeft class="w-4 h-4" /> Back
      </button>
      <div class="relative flex-1 w-full">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
        <input
          type="search"
          placeholder="Search companies…"
          bind:value={searchQuery}
          class="input input-bordered input-sm w-full pl-9"
        />
        {#if searchQuery}
          <button
            class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
            onclick={() => (searchQuery = '')}
          >
            <X class="w-3 h-3" />
          </button>
        {/if}
      </div>
    </div>

    <!-- Industry filter chips -->
    {#if industries.length > 0}
      <div class="flex flex-wrap gap-2">
        <button
          class="badge badge-md cursor-pointer {selectedIndustry === null ? 'badge-primary' : 'badge-outline'}"
          onclick={() => (selectedIndustry = null)}
        >
          All
        </button>
        {#each industries as ind}
          <button
            class="badge badge-md cursor-pointer {selectedIndustry === ind ? 'badge-primary' : 'badge-outline'}"
            onclick={() => (selectedIndustry = selectedIndustry === ind ? null : ind)}
          >
            {ind}
          </button>
        {/each}
      </div>
    {/if}

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
    {:else if filteredEntries.length === 0 && !error}
      <div class="text-center py-16 space-y-4">
        <Trophy class="w-16 h-16 mx-auto opacity-20" />
        <h2 class="text-xl font-semibold opacity-50">{searchQuery || selectedIndustry ? 'No results found' : 'No companies yet'}</h2>
        <p class="text-base-content/40 text-sm">
          {#if searchQuery || selectedIndustry}
            Try adjusting your search or filter.
          {:else}
            Be the first to raise funds and top the leaderboard!
          {/if}
        </p>
        {#if !searchQuery && !selectedIndustry}
          <button class="btn btn-primary mt-2" onclick={() => goto('/companies')}>Browse Companies</button>
        {/if}
      </div>
    {:else}
      <!-- Top 3 podium cards -->
      {#if topThree.length > 0}
        <section>
          <h2 class="text-sm font-semibold uppercase tracking-widest text-base-content/40 mb-4 flex items-center gap-2">
            <Medal class="w-4 h-4" /> Top Performers
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each topThree as entry (entry.id)}
              {@const medal = medalFor(entry.rank)}
              {@const isMyCompany = myCompanyIds.has(entry.id)}
              {@const countdown = nearestCountdown(quickViewCache.get(entry.id) ?? [])}
              <div
                class="glass-subtle rounded-2xl p-5 border {rowHighlight(entry.rank)} cursor-pointer hover:scale-[1.02] transition-transform {isMyCompany ? 'ring-2 ring-primary' : ''}"
                role="button"
                tabindex="0"
                onclick={() => goto(`/companies/${entry.id}`)}
                onkeydown={(e) => e.key === 'Enter' && goto(`/companies/${entry.id}`)}
              >
                <div class="flex items-start justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <span class="text-3xl">{medal?.emoji ?? `#${entry.rank}`}</span>
                    {#if isMyCompany}
                      <span class="badge badge-xs badge-primary">You</span>
                    {/if}
                  </div>
                  <div class="flex items-center gap-1">
                    {#if countdown}
                      <span class="badge badge-xs badge-warning gap-1 flex-shrink-0">
                        <Clock class="w-2.5 h-2.5" />{countdown}
                      </span>
                    {/if}
                    <button
                      class="btn btn-ghost btn-xs btn-circle"
                      onclick={(e) => copyShareLink(entry, e)}
                      title="Share"
                    >
                      {#if copiedShareId === entry.id}
                        <Check class="w-3.5 h-3.5 text-success" />
                      {:else}
                        <Share2 class="w-3.5 h-3.5 opacity-50" />
                      {/if}
                    </button>
                  </div>
                </div>
                <div class="mb-4">
                  <h3 class="font-bold text-lg leading-tight">{entry.name}</h3>
                  {#if entry.industry}
                    <span class="text-xs text-base-content/50">{entry.industry}</span>
                  {/if}
                </div>
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
                    <div class="font-bold text-primary text-base">{fmtEurAnimated(entry)}</div>
                    <div class="opacity-50 leading-tight">Raised</div>
                  </div>
                </div>
                <div class="mt-3 flex justify-between items-center">
                  <button
                    class="btn btn-xs btn-ghost gap-1 text-xs opacity-60 hover:opacity-100"
                    onclick={(e) => openQuickView(entry, e)}
                  >
                    <Zap class="w-3 h-3" /> Quick view
                  </button>
                  <span class="text-xs text-primary flex items-center gap-1 opacity-70 hover:opacity-100">
                    View <ArrowUpRight class="w-3 h-3" />
                  </span>
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Full rankings (all companies) -->
      {#if filteredEntries.length > 0}
        <section>
          <h2 class="text-sm font-semibold uppercase tracking-widest text-base-content/40 mb-4 flex items-center gap-2">
            <TrendingUp class="w-4 h-4" /> Full Rankings
            <span class="badge badge-sm badge-outline normal-case font-normal">{filteredEntries.length} compan{filteredEntries.length === 1 ? 'y' : 'ies'}</span>
          </h2>

          <!-- Desktop table -->
          <div class="hidden md:block overflow-x-auto rounded-2xl border border-base-300/50">
            <table class="table w-full">
              <thead class="bg-base-200">
                <tr>
                  <th class="w-20 text-center">
                    <button class="flex items-center justify-center gap-1 hover:text-primary transition-colors w-full" onclick={() => setSort('rank')}>
                      Rank
                      {#if sortKey === 'rank'}{#if sortDir === 'asc'}<ChevronUp class="w-3.5 h-3.5" />{:else}<ChevronDown class="w-3.5 h-3.5" />{/if}{:else}<ChevronsUpDown class="w-3.5 h-3.5 opacity-30" />{/if}
                    </button>
                  </th>
                  <th>Company</th>
                  <th class="text-center">
                    <button class="flex items-center justify-center gap-1 hover:text-primary transition-colors w-full" onclick={() => setSort('completedBounties')}>
                      <CheckCircle class="w-3.5 h-3.5 text-success" /> Done
                      {#if sortKey === 'completedBounties'}{#if sortDir === 'asc'}<ChevronUp class="w-3.5 h-3.5" />{:else}<ChevronDown class="w-3.5 h-3.5" />{/if}{:else}<ChevronsUpDown class="w-3.5 h-3.5 opacity-30" />{/if}
                    </button>
                  </th>
                  <th class="text-center">
                    <button class="flex items-center justify-center gap-1 hover:text-primary transition-colors w-full" onclick={() => setSort('activeBounties')}>
                      <Target class="w-3.5 h-3.5 text-info" /> Active
                      {#if sortKey === 'activeBounties'}{#if sortDir === 'asc'}<ChevronUp class="w-3.5 h-3.5" />{:else}<ChevronDown class="w-3.5 h-3.5" />{/if}{:else}<ChevronsUpDown class="w-3.5 h-3.5 opacity-30" />{/if}
                    </button>
                  </th>
                  <th class="text-right">
                    <button class="flex items-center justify-end gap-1 hover:text-primary transition-colors w-full" onclick={() => setSort('totalRaisedEur')}>
                      <TrendingUp class="w-3.5 h-3.5 text-primary" /> Total (€)
                      {#if sortKey === 'totalRaisedEur'}{#if sortDir === 'asc'}<ChevronUp class="w-3.5 h-3.5" />{:else}<ChevronDown class="w-3.5 h-3.5" />{/if}{:else}<ChevronsUpDown class="w-3.5 h-3.5 opacity-30" />{/if}
                    </button>
                  </th>
                  <th class="w-28 text-center text-xs opacity-50">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredEntries as entry (entry.id)}
                  {@const medal = medalFor(entry.rank)}
                  {@const delta = rankDelta(entry)}
                  {@const isMyCompany = myCompanyIds.has(entry.id)}
                  {@const isExpanded = expandedIds.has(entry.id)}
                  {@const isExpandLoading = expandingIds.has(entry.id)}
                  {@const cachedBounties = quickViewCache.get(entry.id) ?? []}

                  <!-- Main row -->
                  <tr
                    class="border-b border-base-300/40 {isMyCompany ? 'bg-primary/5' : ''} {isExpanded ? 'bg-base-200/60' : 'hover:bg-base-200/30'} cursor-pointer transition-colors"
                    onclick={(e) => toggleExpand(entry, e)}
                  >
                    <td class="text-center">
                      <div class="flex flex-col items-center">
                        {#if medal}<span class="text-xl">{medal.emoji}</span>{:else}<span class="font-bold text-base-content/60 text-sm">#{entry.rank}</span>{/if}
                        {#if delta > 0}<span class="text-xs text-success font-semibold leading-none mt-0.5">↑{delta}</span>{:else if delta < 0}<span class="text-xs text-error font-semibold leading-none mt-0.5">↓{Math.abs(delta)}</span>{/if}
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center gap-3">
                        <div class="avatar placeholder">
                          <div class="bg-primary/20 text-primary rounded-full w-9 h-9 flex items-center justify-center flex-shrink-0">
                            {#if entry.logoUrl}<img src={entry.logoUrl} alt={entry.name} class="rounded-full object-cover" />{:else}<Building2 class="w-5 h-5" />{/if}
                          </div>
                        </div>
                        <div class="min-w-0">
                          <div class="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                            {entry.name}
                            {#if isMyCompany}<span class="badge badge-xs badge-primary">You</span>{/if}
                          </div>
                          {#if entry.industry}<div class="text-xs opacity-50 truncate">{entry.industry}</div>{/if}
                        </div>
                      </div>
                    </td>
                    <td class="text-center"><span class="badge badge-success badge-sm font-semibold">{entry.completedBounties}</span></td>
                    <td class="text-center"><span class="badge badge-info badge-sm font-semibold">{entry.activeBounties}</span></td>
                    <td class="text-right">
                      <div class="font-mono font-semibold text-primary">{fmtEurAnimated(entry)}</div>
                      <div class="text-xs opacity-50">
                        {entry.totalRaisedEth.toFixed(3)} ETH{#if entry.totalRaisedAvax > 0} / {entry.totalRaisedAvax.toFixed(3)} AVAX{/if}
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-center gap-1" onclick={(e) => e.stopPropagation()} role="presentation">
                        <button class="btn btn-ghost btn-xs btn-circle" onclick={(e) => copyShareLink(entry, e)} title="Share">
                          {#if copiedShareId === entry.id}<Check class="w-3.5 h-3.5 text-success" />{:else}<Share2 class="w-3.5 h-3.5 opacity-40" />{/if}
                        </button>
                        <button class="btn btn-ghost btn-xs btn-circle" onclick={(e) => { e.stopPropagation(); goto(`/companies/${entry.id}`); }} title="View company">
                          <ExternalLink class="w-3.5 h-3.5 opacity-40" />
                        </button>
                        <button class="btn btn-ghost btn-xs btn-circle" onclick={(e) => toggleExpand(entry, e)} title="Expand">
                          <ChevronDown class="w-3.5 h-3.5 opacity-40 transition-transform {isExpanded ? 'rotate-180' : ''}" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  <!-- Expansion row -->
                  {#if isExpanded}
                    <tr class="bg-base-200/40 border-b border-base-300/40">
                      <td colspan="6" class="p-0">
                        <div class="px-6 py-4">
                          {#if isExpandLoading}
                            <div class="flex justify-center py-4">
                              <span class="loading loading-spinner loading-sm text-primary"></span>
                            </div>
                          {:else}
                            <!-- Summary stats row -->
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                              <div class="bg-base-100 rounded-xl p-3 text-center">
                                <div class="text-lg font-bold text-primary">{fmtEurAnimated(entry)}</div>
                                <div class="text-xs opacity-50 mt-0.5">Total Raised (EUR)</div>
                              </div>
                              <div class="bg-base-100 rounded-xl p-3 text-center">
                                <div class="text-lg font-bold font-mono">{entry.totalRaisedEth.toFixed(4)}</div>
                                <div class="text-xs opacity-50 mt-0.5">ETH Raised</div>
                              </div>
                              <div class="bg-base-100 rounded-xl p-3 text-center">
                                <div class="text-lg font-bold text-success">{entry.completedBounties}</div>
                                <div class="text-xs opacity-50 mt-0.5">Completed Bounties</div>
                              </div>
                              <div class="bg-base-100 rounded-xl p-3 text-center">
                                <div class="text-lg font-bold text-info">{entry.activeBounties}</div>
                                <div class="text-xs opacity-50 mt-0.5">Active Campaigns</div>
                              </div>
                            </div>

                            {#if entry.totalRaisedAvax > 0 || entry.totalRaisedManualEur > 0}
                              <div class="grid grid-cols-2 gap-3 mb-4">
                                {#if entry.totalRaisedAvax > 0}
                                  <div class="bg-base-100 rounded-xl p-3 text-center">
                                    <div class="text-base font-bold font-mono">{entry.totalRaisedAvax.toFixed(4)}</div>
                                    <div class="text-xs opacity-50 mt-0.5">AVAX Raised</div>
                                  </div>
                                {/if}
                                {#if entry.totalRaisedManualEur > 0}
                                  <div class="bg-base-100 rounded-xl p-3 text-center">
                                    <div class="text-base font-bold">{formatEur(entry.totalRaisedManualEur)}</div>
                                    <div class="text-xs opacity-50 mt-0.5">Non-EVM Contributions</div>
                                  </div>
                                {/if}
                              </div>
                            {/if}

                            <!-- Bounty list -->
                            {#if cachedBounties.length > 0}
                              <div>
                                <h4 class="text-xs font-semibold uppercase tracking-widest opacity-40 mb-2 flex items-center gap-1">
                                  <Zap class="w-3 h-3" /> Bounties
                                </h4>
                                <div class="space-y-2">
                                  {#each cachedBounties as bounty (bounty.id)}
                                    <div class="bg-base-100 rounded-xl p-3">
                                      <div class="flex items-start justify-between gap-2 mb-2">
                                        <span class="text-sm font-medium leading-snug">{bounty.title}</span>
                                        <div class="flex items-center gap-1.5 flex-shrink-0">
                                          <span class="badge badge-xs {bounty.status === 'active' ? 'badge-info' : bounty.status === 'funded' ? 'badge-success' : 'badge-ghost'}">{bounty.status}</span>
                                          {#if bounty.deadline && bounty.status === 'active'}
                                            <span class="badge badge-xs badge-warning gap-1">
                                              <Clock class="w-2.5 h-2.5" />{daysLeft(bounty.deadline)}
                                            </span>
                                          {/if}
                                        </div>
                                      </div>
                                      <div class="flex justify-between text-xs opacity-60 mb-1">
                                        <span>€{bounty.totalRaisedEur.toFixed(0)} raised</span>
                                        <span class="flex items-center gap-1"><Users class="w-3 h-3" /> {bounty.contributorCount} · Goal €{bounty.targetAmountEur.toFixed(0)}</span>
                                      </div>
                                      <div class="w-full bg-base-300 rounded-full h-1.5">
                                        <div
                                          class="h-1.5 rounded-full transition-all {bounty.status === 'funded' ? 'bg-success' : 'bg-primary'}"
                                          style="width: {Math.min(bounty.progressPercentage, 100)}%"
                                        ></div>
                                      </div>
                                      {#if isInvestor && bounty.status === 'active'}
                                        <button
                                          class="btn btn-xs btn-primary mt-2 gap-1"
                                          onclick={() => goto(`/companies/${entry.id}`)}
                                        >
                                          <ExternalLink class="w-3 h-3" /> Contribute
                                        </button>
                                      {/if}
                                    </div>
                                  {/each}
                                </div>
                              </div>
                            {:else}
                              <p class="text-xs text-base-content/40 text-center py-2">No bounties yet for this company.</p>
                            {/if}

                            <div class="mt-3 flex justify-end">
                              <button
                                class="btn btn-sm btn-outline gap-2"
                                onclick={() => goto(`/companies/${entry.id}`)}
                              >
                                <ExternalLink class="w-3.5 h-3.5" /> View Company Page
                              </button>
                            </div>
                          {/if}
                        </div>
                      </td>
                    </tr>
                  {/if}
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Mobile card list -->
          <div class="md:hidden space-y-2">
            {#each filteredEntries as entry (entry.id)}
              {@const medal = medalFor(entry.rank)}
              {@const delta = rankDelta(entry)}
              {@const isMyCompany = myCompanyIds.has(entry.id)}
              {@const isExpanded = expandedIds.has(entry.id)}
              {@const isExpandLoading = expandingIds.has(entry.id)}
              {@const cachedBounties = quickViewCache.get(entry.id) ?? []}
              <div class="rounded-xl border {rowHighlight(entry.rank)} {isMyCompany ? 'ring-2 ring-primary' : ''} overflow-hidden">
                <!-- Header row (tap to expand) -->
                <div
                  class="p-4 cursor-pointer flex items-center justify-between gap-3 {isExpanded ? 'bg-base-200/60' : ''}"
                  role="button"
                  tabindex="0"
                  onclick={(e) => toggleExpand(entry, e)}
                  onkeydown={(e) => e.key === 'Enter' && toggleExpand(entry, e)}
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="flex flex-col items-center w-8 flex-shrink-0">
                      <span class="text-xl text-center">{medal ? medal.emoji : `#${entry.rank}`}</span>
                      {#if delta > 0}<span class="text-xs text-success font-semibold leading-none">↑{delta}</span>{:else if delta < 0}<span class="text-xs text-error font-semibold leading-none">↓{Math.abs(delta)}</span>{/if}
                    </div>
                    <div class="min-w-0">
                      <div class="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                        {entry.name}
                        {#if isMyCompany}<span class="badge badge-xs badge-primary">You</span>{/if}
                      </div>
                      {#if entry.industry}<div class="text-xs opacity-50 truncate">{entry.industry}</div>{/if}
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <div class="text-right">
                      <div class="font-mono font-bold text-primary text-sm">{fmtEurAnimated(entry)}</div>
                      <div class="text-xs opacity-50">{entry.completedBounties} done · {entry.activeBounties} active</div>
                    </div>
                    <ChevronDown class="w-4 h-4 opacity-40 transition-transform flex-shrink-0 {isExpanded ? 'rotate-180' : ''}" />
                  </div>
                </div>

                <!-- Expanded section -->
                {#if isExpanded}
                  <div class="border-t border-base-300/40 bg-base-200/40 px-4 py-3 space-y-3">
                    {#if isExpandLoading}
                      <div class="flex justify-center py-3">
                        <span class="loading loading-spinner loading-sm text-primary"></span>
                      </div>
                    {:else}
                      <!-- Mobile stats grid -->
                      <div class="grid grid-cols-2 gap-2">
                        <div class="bg-base-100 rounded-lg p-2.5 text-center">
                          <div class="font-bold text-primary">{fmtEurAnimated(entry)}</div>
                          <div class="text-xs opacity-50">Total Raised</div>
                        </div>
                        <div class="bg-base-100 rounded-lg p-2.5 text-center">
                          <div class="font-bold font-mono text-sm">{entry.totalRaisedEth.toFixed(4)} ETH</div>
                          <div class="text-xs opacity-50">On-chain</div>
                        </div>
                        <div class="bg-base-100 rounded-lg p-2.5 text-center">
                          <div class="font-bold text-success">{entry.completedBounties}</div>
                          <div class="text-xs opacity-50">Completed</div>
                        </div>
                        <div class="bg-base-100 rounded-lg p-2.5 text-center">
                          <div class="font-bold text-info">{entry.activeBounties}</div>
                          <div class="text-xs opacity-50">Active</div>
                        </div>
                      </div>

                      <!-- Mobile bounty list -->
                      {#if cachedBounties.length > 0}
                        <div class="space-y-2">
                          {#each cachedBounties as bounty (bounty.id)}
                            <div class="bg-base-100 rounded-lg p-3">
                              <div class="flex items-start justify-between gap-2 mb-1.5">
                                <span class="text-xs font-medium leading-snug">{bounty.title}</span>
                                <span class="badge badge-xs flex-shrink-0 {bounty.status === 'active' ? 'badge-info' : bounty.status === 'funded' ? 'badge-success' : 'badge-ghost'}">{bounty.status}</span>
                              </div>
                              <div class="w-full bg-base-300 rounded-full h-1.5 mb-1">
                                <div class="h-1.5 rounded-full {bounty.status === 'funded' ? 'bg-success' : 'bg-primary'}" style="width: {Math.min(bounty.progressPercentage, 100)}%"></div>
                              </div>
                              <div class="flex justify-between text-xs opacity-50">
                                <span>€{bounty.totalRaisedEur.toFixed(0)} / €{bounty.targetAmountEur.toFixed(0)}</span>
                                {#if bounty.deadline && bounty.status === 'active'}<span>{daysLeft(bounty.deadline)} left</span>{/if}
                              </div>
                            </div>
                          {/each}
                        </div>
                      {/if}

                      <!-- Mobile action row -->
                      <div class="flex items-center gap-2 pt-1" onclick={(e) => e.stopPropagation()} role="presentation">
                        <button class="btn btn-outline btn-xs flex-1 gap-1" onclick={() => goto(`/companies/${entry.id}`)}>                          <ExternalLink class="w-3 h-3" /> View Page
                        </button>
                        <button class="btn btn-ghost btn-xs btn-circle" onclick={(e) => copyShareLink(entry, e)} title="Share">
                          {#if copiedShareId === entry.id}<Check class="w-3.5 h-3.5 text-success" />{:else}<Share2 class="w-3.5 h-3.5 opacity-50" />{/if}
                        </button>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </section>
      {/if}
    {/if}

  </div>
</div>
