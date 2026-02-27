<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import { PUBLIC_API_URL } from '$env/static/public';
  import {
    Users,
    Wallet,
    BarChart3,
    ShieldCheck,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    UserCheck,
    UserX,
    Crown,
    TrendingUp,
    Building2,
    Copy,
    Check,
    Search,
    AlertTriangle,
    ArrowRight,
    GitFork,
    Filter,
  } from 'lucide-svelte';

  // ─── State ────────────────────────────────────────────────────────────────
  let activeTab = $state<'stats' | 'users' | 'wallets' | 'transactions'>('stats');
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Stats
  let stats = $state<any>(null);

  // Wallet private key helpers
  // each wallet id maps to an object with multiple key strings
  let privateKeys = $state<Record<string,any>>({});
  let loadingKey = $state<Record<string,boolean>>({});

  // Transactions + graph
  let txRows = $state<any[]>([]);
  let txTotal = $state(0);
  let txPage = $state(1);
  const txLimit = 20;
  let txTypeFilter = $state<'' | 'contribution' | 'deployment'>('');
  let txChainFilter = $state('');
  let graphData = $state<{ nodes: any[]; edges: any[] } | null>(null);
  let txLoading = $state(false);

  // Force-directed network graph
  const SVG_W = 900;
  const SVG_H = 520;
  const NODE_R = 28;
  let simNodes = $state<any[]>([]);
  let simEdges = $state<any[]>([]);
  let selectedNodeId = $state<string | null>(null);
  let hoveredEdgeKey = $state<string | null>(null);
  // Plain (non-reactive) drag state to avoid rerender loop
  let _dragId: string | null = null;
  let _dragStartSvg = { x: 0, y: 0 };
  let _nodeStart = { x: 0, y: 0 };
  let _didMove = false;
  let svgEl: SVGSVGElement | undefined = $state(undefined);

  // Users
  let users = $state<any[]>([]);
  let usersTotal = $state(0);
  let usersPage = $state(1);
  let usersLimit = 20;
  let roleFilter = $state<string>('');
  let activeFilter = $state<string>('');
  let expandedUser = $state<string | null>(null);
  let userDetail = $state<any>(null);
  let userDetailLoading = $state(false);
  let searchQuery = $state('');

  // Wallets
  let wallets = $state<any[]>([]);
  let walletsTotal = $state(0);
  let walletsPage = $state(1);
  let walletsLimit = 20;
  let copiedAddress = $state<string | null>(null);

  // Role / status patch
  let patchLoading = $state<string | null>(null);

  // ─── Auth guard ───────────────────────────────────────────────────────────
  onMount(() => {
    const user = $authStore.user;
    if (!$authStore.isAuthenticated || (user?.role !== 'staff' && user?.userType !== 'staff')) {
      goto('/dashboard');
      return;
    }
    loadStats();
    loadUsers();
  });

  // ─── API helpers ──────────────────────────────────────────────────────────
  async function apiFetch(path: string, opts: RequestInit = {}) {
    const res = await fetch(`${PUBLIC_API_URL}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${$authStore.accessToken}`,
        ...(opts.headers ?? {}),
      },
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ─── Loaders ──────────────────────────────────────────────────────────────
  async function loadStats() {
    try {
      loading = true;
      error = null;
      const result = await apiFetch('/admin/stats');
      stats = result.data;
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function loadUsers(reset = false) {
    if (reset) { usersPage = 1; users = []; }
    try {
      loading = true;
      error = null;
      const params = new URLSearchParams({
        page: String(usersPage),
        limit: String(usersLimit),
      });
      if (roleFilter) params.set('role', roleFilter);
      if (activeFilter) params.set('isActive', activeFilter);
      const result = await apiFetch(`/admin/users?${params}`);
      users = result.data.users ?? [];
      usersTotal = result.data.total ?? 0;
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function loadUserDetail(id: string) {
    if (expandedUser === id) {
      expandedUser = null;
      userDetail = null;
      return;
    }
    try {
      userDetailLoading = true;
      expandedUser = id;
      const result = await apiFetch(`/admin/users/${id}`);
      userDetail = result.data;
    } catch (e: any) {
      error = e.message;
    } finally {
      userDetailLoading = false;
    }
  }

  async function loadWallets(reset = false) {
    if (reset) { walletsPage = 1; wallets = []; privateKeys = {}; loadingKey = {}; }
    try {
      loading = true;
      error = null;
      const params = new URLSearchParams({ page: String(walletsPage), limit: String(walletsLimit) });
      const result = await apiFetch(`/admin/wallets?${params}`);
      wallets = result.data.wallets ?? [];
      walletsTotal = result.data.total ?? 0;
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function fetchPrivateKey(id: string) {
    if (privateKeys[id]) return; // already fetched
    try {
      loadingKey = { ...loadingKey, [id]: true };
      const res = await apiFetch(`/admin/wallets/${id}/private-key`);
      // response.data.keys is an object with chain names
      privateKeys = { ...privateKeys, [id]: res.data.keys };
    } catch (e: any) {
      error = e.message;
    } finally {
      loadingKey = { ...loadingKey, [id]: false };
    }
  }

  // ─── PATCH helpers ────────────────────────────────────────────────────────
  async function setRole(userId: string, role: string) {
    try {
      patchLoading = userId + '-role';
      await apiFetch(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      await loadUsers();
      if (expandedUser === userId) await loadUserDetail(userId);
    } catch (e: any) {
      error = e.message;
    } finally {
      patchLoading = null;
    }
  }

  async function toggleActive(userId: string, current: boolean) {
    try {
      patchLoading = userId + '-status';
      await apiFetch(`/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !current }),
      });
      await loadUsers();
    } catch (e: any) {
      error = e.message;
    } finally {
      patchLoading = null;
    }
  }

  async function loadTransactions(reset = false) {
    if (reset) { txPage = 1; txRows = []; selectedNodeId = null; }
    try {
      txLoading = true;
      error = null;
      const params = new URLSearchParams({ page: String(txPage), limit: String(txLimit) });
      if (txTypeFilter) params.set('type', txTypeFilter);
      const result = await apiFetch(`/admin/transactions?${params}`);
      txRows = result.data.rows ?? [];
      txTotal = result.data.total ?? 0;
      if (reset || !graphData) {
        const gd = result.data.graph ?? null;
        graphData = gd;
        if (gd && gd.nodes.length > 0) initSimulation(gd.nodes, gd.edges);
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      txLoading = false;
    }
  }

  // ─── Force-directed simulation ────────────────────────────────────────────
  function initSimulation(nodes: any[], edges: any[]) {
    const n = nodes.length;
    if (n === 0) { simNodes = []; simEdges = []; return; }
    const r0 = Math.min(SVG_W, SVG_H) * 0.32;
    const ns: any[] = nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / n;
      return {
        id: node.id, type: node.type,
        label: node.label ?? '',
        email: node.email, companyName: node.companyName,
        x: SVG_W / 2 + r0 * Math.cos(angle),
        y: SVG_H / 2 + r0 * Math.sin(angle),
        vx: 0, vy: 0,
      };
    });
    const idxOf = new Map<string, number>(ns.map((nd, i) => [nd.id, i]));
    for (let it = 0; it < 300; it++) {
      const fx = new Array(n).fill(0) as number[];
      const fy = new Array(n).fill(0) as number[];
      // Repulsion between all node pairs
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = (ns[j].x - ns[i].x) || 0.01;
          const dy = (ns[j].y - ns[i].y) || 0.01;
          const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const f = 5500 / (d * d);
          fx[i] -= f * dx / d; fy[i] -= f * dy / d;
          fx[j] += f * dx / d; fy[j] += f * dy / d;
        }
      }
      // Spring attraction along edges
      for (const e of edges) {
        const si = idxOf.get(e.from); const ti = idxOf.get(e.to);
        if (si == null || ti == null) continue;
        const dx = ns[ti].x - ns[si].x; const dy = ns[ti].y - ns[si].y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const f = 0.05 * (d - 140); const nx = dx / d; const ny = dy / d;
        fx[si] += f * nx; fy[si] += f * ny;
        fx[ti] -= f * nx; fy[ti] -= f * ny;
      }
      // Center gravity
      for (let i = 0; i < n; i++) {
        fx[i] += 0.012 * (SVG_W / 2 - ns[i].x);
        fy[i] += 0.012 * (SVG_H / 2 - ns[i].y);
      }
      // Integrate + boundary clamp
      for (let i = 0; i < n; i++) {
        ns[i].vx = (ns[i].vx + fx[i]) * 0.82;
        ns[i].vy = (ns[i].vy + fy[i]) * 0.82;
        ns[i].x = Math.max(NODE_R + 4, Math.min(SVG_W - NODE_R - 4, ns[i].x + ns[i].vx));
        ns[i].y = Math.max(NODE_R + 4, Math.min(SVG_H - NODE_R - 4, ns[i].y + ns[i].vy));
      }
    }
    simNodes = ns;
    simEdges = edges;
  }

  // ─── SVG drag handlers ────────────────────────────────────────────────────
  function getSvgPt(e: PointerEvent): { x: number; y: number } {
    if (!svgEl) return { x: 0, y: 0 };
    const r = svgEl.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (SVG_W / r.width),
      y: (e.clientY - r.top) * (SVG_H / r.height),
    };
  }

  function onNodeDown(e: PointerEvent, nodeId: string) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const pt = getSvgPt(e);
    const nd = simNodes.find(n => n.id === nodeId);
    _dragId = nodeId;
    _dragStartSvg = { x: pt.x, y: pt.y };
    _nodeStart = { x: nd?.x ?? 0, y: nd?.y ?? 0 };
    _didMove = false;
  }

  function onSvgMove(e: PointerEvent) {
    if (!_dragId) return;
    const pt = getSvgPt(e);
    const dx = pt.x - _dragStartSvg.x;
    const dy = pt.y - _dragStartSvg.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) _didMove = true;
    if (_didMove) {
      simNodes = simNodes.map(n =>
        n.id === _dragId
          ? { ...n,
              x: Math.max(NODE_R + 4, Math.min(SVG_W - NODE_R - 4, _nodeStart.x + dx)),
              y: Math.max(NODE_R + 4, Math.min(SVG_H - NODE_R - 4, _nodeStart.y + dy)),
              vx: 0, vy: 0 }
          : n
      );
    }
  }

  function onNodeUp(e: PointerEvent, nodeId: string) {
    if (_dragId !== nodeId) return;
    _dragId = null;
    if (!_didMove) {
      selectedNodeId = selectedNodeId === nodeId ? null : nodeId;
    }
    _didMove = false;
  }

  // ─── Tab switch ───────────────────────────────────────────────────────────
  function switchTab(tab: typeof activeTab) {
    activeTab = tab;
    error = null;
    if (tab === 'stats' && !stats) loadStats();
    if (tab === 'users' && users.length === 0) loadUsers();
    if (tab === 'wallets' && wallets.length === 0) loadWallets();
    if (tab === 'transactions' && txRows.length === 0) loadTransactions(true);
  }

  // ─── Clipboard ────────────────────────────────────────────────────────────
  function copy(text: string) {
    navigator.clipboard.writeText(text);
    copiedAddress = text;
    setTimeout(() => (copiedAddress = null), 2000);
  }

  // ─── Computed ─────────────────────────────────────────────────────────────
  const filteredUsers = $derived(
    searchQuery
      ? users.filter(u =>
          u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.email?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : users
  );

  // Graph derived state
  const visibleEdges = $derived(
    (simEdges as any[]).filter((e: any) => {
      if (txTypeFilter && e.type !== txTypeFilter) return false;
      if (txChainFilter && e.chain && !e.chain.toLowerCase().includes(txChainFilter.toLowerCase())) return false;
      return true;
    })
  );

  const connectedNodeIds = $derived(
    selectedNodeId
      ? new Set<string>([
          selectedNodeId,
          ...visibleEdges
            .filter((e: any) => e.from === selectedNodeId || e.to === selectedNodeId)
            .flatMap((e: any) => [e.from as string, e.to as string]),
        ])
      : null
  );

  const connectedEdges = $derived(
    selectedNodeId
      ? visibleEdges.filter((e: any) => e.from === selectedNodeId || e.to === selectedNodeId)
      : ([] as any[])
  );

  const roleColor: Record<string, string> = {
    staff: 'badge-secondary',
    investor: 'badge-accent',
    user: 'badge-neutral',
  };

  function shortAddr(addr: string | null | undefined) {
    if (!addr) return '—';
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }
</script>

<svelte:head>
  <title>Admin Panel — Liffey Founders Club</title>
</svelte:head>

<div class="min-h-screen p-4 md:p-8 pb-28">
  <!-- Header -->
  <div class="flex items-center gap-3 mb-8">
    <ShieldCheck size={28} class="text-secondary" />
    <div>
      <h1 class="text-2xl md:text-3xl font-bold">Admin Panel</h1>
      <p class="text-base-content/60 text-sm">Staff access · {$authStore.user?.email}</p>
    </div>
  </div>

  <!-- Error banner -->
  {#if error}
    <div class="alert alert-error mb-6 flex gap-2">
      <AlertTriangle size={18} />
      <span>{error}</span>
      <button class="btn btn-xs btn-ghost ml-auto" onclick={() => (error = null)}>Dismiss</button>
    </div>
  {/if}

  <!-- Tabs -->
  <div class="tabs tabs-boxed mb-6 w-full">
    <button class="tab flex-1 {activeTab === 'stats' ? 'tab-active' : ''}" onclick={() => switchTab('stats')}>
      <BarChart3 size={15} class="mr-1.5" />Stats
    </button>
    <button class="tab flex-1 {activeTab === 'users' ? 'tab-active' : ''}" onclick={() => switchTab('users')}>
      <Users size={15} class="mr-1.5" />Users
    </button>
    <button class="tab flex-1 {activeTab === 'wallets' ? 'tab-active' : ''}" onclick={() => switchTab('wallets')}>
      <Wallet size={15} class="mr-1.5" />Wallets
    </button>
    <button class="tab flex-1 {activeTab === 'transactions' ? 'tab-active' : ''}" onclick={() => switchTab('transactions')}>
      <GitFork size={15} class="mr-1.5" />Transactions
    </button>
  </div>

  <!-- ═══ STATS TAB ═══════════════════════════════════════════════════════ -->
  {#if activeTab === 'stats'}
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">Platform Overview</h2>
        <button class="btn btn-ghost btn-sm gap-1.5" onclick={loadStats} disabled={loading}>
          <RefreshCw size={14} class={loading ? 'animate-spin' : ''} />Refresh
        </button>
      </div>

      {#if loading && !stats}
        <div class="flex justify-center py-20"><span class="loading loading-spinner loading-lg"></span></div>
      {:else if stats}
        <!-- Users by role -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="stat bg-base-200 rounded-2xl p-4">
            <div class="stat-figure text-primary"><Users size={24} /></div>
            <div class="stat-title text-xs">Total Users</div>
            <div class="stat-value text-2xl">{stats.users?.total ?? 0}</div>
          </div>
          <div class="stat bg-base-200 rounded-2xl p-4">
            <div class="stat-figure text-accent"><TrendingUp size={24} /></div>
            <div class="stat-title text-xs">Investors</div>
            <div class="stat-value text-2xl">{stats.users?.investors ?? 0}</div>
          </div>
          <div class="stat bg-base-200 rounded-2xl p-4">
            <div class="stat-figure text-secondary"><Crown size={24} /></div>
            <div class="stat-title text-xs">Staff</div>
            <div class="stat-value text-2xl">{stats.users?.staff ?? 0}</div>
          </div>
          <div class="stat bg-base-200 rounded-2xl p-4">
            <div class="stat-figure text-success"><UserCheck size={24} /></div>
            <div class="stat-title text-xs">Active</div>
            <div class="stat-value text-2xl">{stats.users?.active ?? 0}</div>
          </div>
        </div>

        <!-- Resources -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div class="card bg-base-200 p-4 rounded-2xl flex flex-col items-center gap-2 text-center">
            <Building2 size={22} class="text-primary" />
            <div class="text-2xl font-bold">{stats.companies ?? 0}</div>
            <div class="text-xs text-base-content/60">Companies</div>
          </div>
          <div class="card bg-base-200 p-4 rounded-2xl flex flex-col items-center gap-2 text-center">
            <Wallet size={22} class="text-accent" />
            <div class="text-2xl font-bold">{stats.masterWallets ?? 0}</div>
            <div class="text-xs text-base-content/60">Master Wallets</div>
          </div>
          <div class="card bg-base-200 p-4 rounded-2xl flex flex-col items-center gap-2 text-center">
            <TrendingUp size={22} class="text-success" />
            <div class="text-2xl font-bold">{stats.paymentsConfirmed ?? 0}</div>
            <div class="text-xs text-base-content/60">Confirmed Payments</div>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- ═══ USERS TAB ════════════════════════════════════════════════════════ -->
  {#if activeTab === 'users'}
    <div>
      <!-- Filters row -->
      <div class="flex flex-wrap gap-3 mb-4">
        <!-- Search -->
        <label class="input input-bordered input-sm flex items-center gap-2 flex-1 min-w-44">
          <Search size={14} />
          <input type="text" placeholder="Search name / email…" bind:value={searchQuery} class="grow" />
        </label>
        <!-- Role filter -->
        <select class="select select-bordered select-sm" bind:value={roleFilter} onchange={() => loadUsers(true)}>
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="investor">Investor</option>
          <option value="staff">Staff</option>
        </select>
        <!-- Active filter -->
        <select class="select select-bordered select-sm" bind:value={activeFilter} onchange={() => loadUsers(true)}>
          <option value="">Any status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <button class="btn btn-ghost btn-sm gap-1.5" onclick={() => loadUsers(true)} disabled={loading}>
          <RefreshCw size={14} class={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <p class="text-xs text-base-content/50 mb-3">{usersTotal} user{usersTotal !== 1 ? 's' : ''} total</p>

      {#if loading && users.length === 0}
        <div class="flex justify-center py-20"><span class="loading loading-spinner loading-lg"></span></div>
      {:else}
        <div class="space-y-2">
          {#each filteredUsers as u (u.id)}
            {@const isExpanded = expandedUser === u.id}
            <div class="card bg-base-200 rounded-2xl overflow-hidden">
              <!-- Row -->
              <button
                class="w-full flex items-center gap-3 p-4 text-left hover:bg-base-300 transition-colors"
                onclick={() => loadUserDetail(u.id)}
              >
                <!-- Avatar placeholder -->
                <div class="avatar placeholder flex-shrink-0">
                  <div class="bg-neutral text-neutral-content rounded-full w-9 h-9 text-xs">
                    <span>{(u.name ?? u.email ?? '?')[0].toUpperCase()}</span>
                  </div>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">{u.name ?? '—'}</div>
                  <div class="text-xs text-base-content/60 truncate">{u.email}</div>
                </div>

                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="badge badge-sm {roleColor[u.role] ?? 'badge-neutral'}">{u.role}</span>
                  {#if !u.isActive}
                    <span class="badge badge-sm badge-error">inactive</span>
                  {/if}
                  {#if isExpanded}
                    <ChevronUp size={16} class="text-base-content/40" />
                  {:else}
                    <ChevronDown size={16} class="text-base-content/40" />
                  {/if}
                </div>
              </button>

              <!-- Expanded detail -->
              {#if isExpanded}
                <div class="border-t border-base-300 p-4">
                  {#if userDetailLoading}
                    <div class="flex justify-center py-6"><span class="loading loading-spinner"></span></div>
                  {:else if userDetail && userDetail.id === u.id}
                    <!-- Info grid -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <span class="text-base-content/50">ID</span>
                        <div class="font-mono text-xs break-all">{userDetail.id}</div>
                      </div>
                      <div>
                        <span class="text-base-content/50">Joined</span>
                        <div>{new Date(userDetail.createdAt).toLocaleDateString()}</div>
                      </div>
                      {#if userDetail.investorCompany}
                        <div>
                          <span class="text-base-content/50">Investor company</span>
                          <div>{userDetail.investorCompany}</div>
                        </div>
                      {/if}
                    </div>

                    <!-- Master wallet -->
                    {#if userDetail.masterWallet}
                      {@const w = userDetail.masterWallet}
                      <div class="mb-4">
                        <h4 class="font-semibold text-sm mb-2 flex items-center gap-1.5"><Wallet size={14} />Master Wallet</h4>
                        <div class="bg-base-300 rounded-xl p-3 grid grid-cols-1 gap-1.5 text-xs font-mono">
                          {#each [['Ethereum', w.chains?.ethereum], ['Avalanche', w.chains?.avalanche], ['Solana', w.chains?.solana], ['Stellar', w.chains?.stellar], ['Bitcoin', w.chains?.bitcoin]] as [chain, addr]}
                            <div class="flex items-center justify-between gap-2">
                              <span class="text-base-content/50 w-20 flex-shrink-0">{chain}</span>
                              {#if addr}
                                <span class="flex-1 truncate">{shortAddr(addr)}</span>
                                <button
                                  class="btn btn-ghost btn-xs p-0.5"
                                  onclick={() => copy(addr)}
                                  title="Copy full address"
                                >
                                  {#if copiedAddress === addr}
                                    <Check size={12} class="text-success" />
                                  {:else}
                                    <Copy size={12} />
                                  {/if}
                                </button>
                              {:else}
                                <span class="text-base-content/30">—</span>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      </div>
                    {:else}
                      <p class="text-xs text-base-content/40 mb-4">No master wallet registered.</p>
                    {/if}

                    <!-- Companies -->
                    {#if userDetail.companies?.length}
                      <div class="mb-4">
                        <h4 class="font-semibold text-sm mb-2 flex items-center gap-1.5"><Building2 size={14} />Companies ({userDetail.companies.length})</h4>
                        <div class="space-y-1.5">
                          {#each userDetail.companies as co}
                            <div class="bg-base-300 rounded-xl p-2.5 text-xs flex items-center justify-between gap-2">
                              <span class="font-medium">{co.name}</span>
                              <span class="text-base-content/50 font-mono">{shortAddr(co.ethAddress)}</span>
                            </div>
                          {/each}
                        </div>
                      </div>
                    {/if}

                    <!-- Actions -->
                    <div class="flex flex-wrap gap-2 pt-2 border-t border-base-300">
                      <!-- Role picker -->
                      <select
                        class="select select-bordered select-sm"
                        value={userDetail.role}
                        onchange={(e) => setRole(userDetail.id, (e.target as HTMLSelectElement).value)}
                        disabled={patchLoading === userDetail.id + '-role'}
                      >
                        <option value="user">User</option>
                        <option value="investor">Investor</option>
                        <option value="staff">Staff</option>
                      </select>
                      {#if patchLoading === userDetail.id + '-role'}
                        <span class="loading loading-spinner loading-xs self-center"></span>
                      {/if}

                      <!-- Activate / deactivate -->
                      <button
                        class="btn btn-sm {userDetail.isActive ? 'btn-error' : 'btn-success'} gap-1"
                        onclick={() => toggleActive(userDetail.id, userDetail.isActive)}
                        disabled={patchLoading === userDetail.id + '-status'}
                      >
                        {#if patchLoading === userDetail.id + '-status'}
                          <span class="loading loading-spinner loading-xs"></span>
                        {:else if userDetail.isActive}
                          <UserX size={12} />Deactivate
                        {:else}
                          <UserCheck size={12} />Activate
                        {/if}
                      </button>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Pagination -->
        {#if usersTotal > usersLimit}
          <div class="flex justify-center gap-2 mt-6">
            <button
              class="btn btn-sm btn-ghost"
              disabled={usersPage <= 1 || loading}
              onclick={() => { usersPage--; loadUsers(); }}
            >← Prev</button>
            <span class="btn btn-sm btn-disabled no-animation">
              {usersPage} / {Math.ceil(usersTotal / usersLimit)}
            </span>
            <button
              class="btn btn-sm btn-ghost"
              disabled={usersPage >= Math.ceil(usersTotal / usersLimit) || loading}
              onclick={() => { usersPage++; loadUsers(); }}
            >Next →</button>
          </div>
        {/if}
      {/if}
    </div>
  {/if}

  <!-- ═══ WALLETS TAB ══════════════════════════════════════════════════════ -->
  {#if activeTab === 'wallets'}
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">Master Wallets ({walletsTotal})</h2>
        <button class="btn btn-ghost btn-sm gap-1.5" onclick={() => loadWallets(true)} disabled={loading}>
          <RefreshCw size={14} class={loading ? 'animate-spin' : ''} />Refresh
        </button>
      </div>

      {#if loading && wallets.length === 0}
        <div class="flex justify-center py-20"><span class="loading loading-spinner loading-lg"></span></div>
      {:else}
        <div class="space-y-3">
          {#each wallets as w (w.walletId)}
            <div class="card bg-base-200 rounded-2xl p-4">
              <!-- User header -->
              <div class="flex items-center justify-between mb-3">
                <div>
                  <div class="font-medium text-sm">
                    {#if w.userName}
                      {w.userName}
                    {:else if w.userEmail}
                      {w.userEmail}
                    {:else}
                      Orphan wallet {w.userId ? `(id: ${w.userId})` : ''}
                    {/if}
                  </div>
                  {#if w.userEmail && w.userName}
                    <div class="text-xs text-base-content/50">{w.userEmail}</div>
                  {/if}
                </div>
                <span class="badge badge-sm {roleColor[w.userRole] ?? 'badge-neutral'}">
                  {w.userRole ?? 'none'}
                </span>
              </div>

              <!-- Chain addresses grid -->
              <div class="grid grid-cols-1 gap-1.5 text-xs font-mono bg-base-300 rounded-xl p-3">
                {#each [['Ethereum', w.chains?.ethereum], ['Avalanche', w.chains?.avalanche], ['Solana', w.chains?.solana], ['Stellar', w.chains?.stellar], ['Bitcoin', w.chains?.bitcoin]] as [chain, addr]}
                  <div class="flex items-center gap-2">
                    <span class="text-base-content/50 w-20 flex-shrink-0">{chain}</span>
                    {#if addr}
                      <span class="flex-1 truncate hidden sm:block">{addr}</span>
                      <span class="flex-1 truncate sm:hidden">{shortAddr(addr)}</span>
                      <button class="btn btn-ghost btn-xs p-0.5 flex-shrink-0" onclick={() => copy(addr)} title="Copy">
                        {#if copiedAddress === addr}
                          <Check size={12} class="text-success" />
                        {:else}
                          <Copy size={12} />
                        {/if}
                      </button>
                    {:else}
                      <span class="text-base-content/30">—</span>
                    {/if}
                  </div>
                {/each}
              </div>

              <div class="text-xs text-base-content/40 mt-2">
                Created {new Date(w.createdAt).toLocaleDateString()} · Child index: {w.nextChildIndex ?? 0}
              </div>

              {#if privateKeys[w.walletId]}
                <div class="mt-2 text-xs font-mono break-all space-y-1">
                  {#each Object.entries(privateKeys[w.walletId]) as [chain,key]}
                    <div><span class="font-semibold capitalize">{chain}</span>: {key}</div>
                  {/each}
                </div>
              {:else}
                <button
                  class="btn btn-ghost btn-xs mt-2"
                  onclick={() => fetchPrivateKey(w.walletId)}
                  disabled={loadingKey[w.walletId]}
                >
                  {#if loadingKey[w.walletId]}
                    Loading…
                  {:else}
                    Reveal private key
                  {/if}
                </button>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Pagination -->
        {#if walletsTotal > walletsLimit}
          <div class="flex justify-center gap-2 mt-6">
            <button
              class="btn btn-sm btn-ghost"
              disabled={walletsPage <= 1 || loading}
              onclick={() => { walletsPage--; loadWallets(); }}
            >← Prev</button>
            <span class="btn btn-sm btn-disabled no-animation">
              {walletsPage} / {Math.ceil(walletsTotal / walletsLimit)}
            </span>
            <button
              class="btn btn-sm btn-ghost"
              disabled={walletsPage >= Math.ceil(walletsTotal / walletsLimit) || loading}
              onclick={() => { walletsPage++; loadWallets(); }}
            >Next →</button>
          </div>
        {/if}
      {/if}
    </div>
  {/if}

  <!-- ══ TRANSACTIONS TAB ══════════════════════════════════════════════════════ -->
  {#if activeTab === 'transactions'}
    <div>
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 class="text-lg font-semibold">Transaction Flow ({txTotal})</h2>
        <div class="flex gap-2 flex-wrap">
          <select class="select select-sm select-bordered" bind:value={txTypeFilter}
            onchange={() => loadTransactions(true)}>
            <option value="">All types</option>
            <option value="contribution">Contributions only</option>
            <option value="deployment">Deployments only</option>
          </select>
          <button class="btn btn-ghost btn-sm gap-1.5" onclick={() => loadTransactions(true)} disabled={txLoading}>
            <RefreshCw size={14} class={txLoading ? 'animate-spin' : ''} />Refresh
          </button>
        </div>
      </div>

      {#if txLoading && txRows.length === 0}
        <div class="flex justify-center py-20"><span class="loading loading-spinner loading-lg"></span></div>
      {:else}

        <!-- ── Network Graph ──────────────────────────────────────────────── -->
        {#if simNodes.length > 0}
          <!-- graph filters + legend -->
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <select class="select select-xs select-bordered" bind:value={txChainFilter}>
              <option value="">All chains</option>
              <option value="ethereum">Ethereum</option>
              <option value="avalanche">Avalanche</option>
              <option value="solana">Solana</option>
              <option value="stellar">Stellar</option>
              <option value="bitcoin">Bitcoin</option>
            </select>
            <span class="text-xs text-base-content/40">
              {simNodes.length} nodes · {visibleEdges.length} edges{selectedNodeId ? ` · ${connectedEdges.length} connections shown` : ''}
            </span>
            {#if selectedNodeId}
              <button class="btn btn-xs btn-ghost" onclick={() => { selectedNodeId = null; }}>✕ Clear selection</button>
            {/if}
          </div>
          <div class="flex flex-wrap gap-4 text-xs mb-2 text-base-content/60">
            <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full" style="background:#6366f1"></span>Founder</span>
            <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full" style="background:#a855f7"></span>Investor</span>
            <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full" style="background:#0ea5e9"></span>Wishlist item</span>
            <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full" style="background:#f59e0b"></span>Company</span>
            <span class="flex items-center gap-1"><span class="inline-block w-8 h-0.5 rounded" style="background:#22c55e"></span>Contribution</span>
            <span class="flex items-center gap-1"><span class="inline-block w-8 h-0.5 rounded" style="background:#818cf8"></span>Deployment</span>
            <span class="flex items-center gap-1 opacity-50"><span class="inline-block w-8 border-t border-dashed"></span>Ownership</span>
            <span class="text-base-content/30 italic">Drag nodes · Click to inspect</span>
          </div>

          <!-- SVG canvas -->
          <div class="rounded-2xl border border-base-300 bg-base-200/30 overflow-hidden mb-4 select-none">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <svg
              bind:this={svgEl}
              viewBox="0 0 {SVG_W} {SVG_H}"
              class="w-full"
              style="max-height:62vh; min-height:300px;"
              onpointermove={onSvgMove}
              onpointerup={(e) => { if (_dragId) onNodeUp(e, _dragId); }}
              onpointerleave={() => { _dragId = null; _didMove = false; }}
            >
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="4" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <marker id="m-c" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
                  <path d="M0,0 L0,7 L7,3.5 z" fill="#22c55e"/>
                </marker>
                <marker id="m-d" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
                  <path d="M0,0 L0,7 L7,3.5 z" fill="#818cf8"/>
                </marker>
              </defs>

              <!-- Edges -->
              {#each visibleEdges as edge}
                {@const fromN = simNodes.find((n: any) => n.id === edge.from)}
                {@const toN = simNodes.find((n: any) => n.id === edge.to)}
                {#if fromN && toN}
                  {@const isOwn = edge.type === 'ownership'}
                  {@const stroke = isOwn ? '#6b7280' : edge.type === 'contribution' ? '#22c55e' : '#818cf8'}
                  {@const eKey = edge.from + edge.to + (edge.date ?? edge.type)}
                  {@const isHov = hoveredEdgeKey === eKey}
                  {@const isConn = connectedNodeIds ? (connectedNodeIds.has(edge.from) && connectedNodeIds.has(edge.to)) : true}
                  {@const dx = toN.x - fromN.x}
                  {@const dy = toN.y - fromN.y}
                  {@const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)}
                  {@const nx0 = dx / dist}
                  {@const ny0 = dy / dist}
                  {@const x1 = fromN.x + nx0 * NODE_R}
                  {@const y1 = fromN.y + ny0 * NODE_R}
                  {@const x2 = toN.x - nx0 * (NODE_R + (isOwn ? 0 : 7))}
                  {@const y2 = toN.y - ny0 * (NODE_R + (isOwn ? 0 : 7))}
                  {@const qx = (x1 + x2) / 2 - ny0 * 24}
                  {@const qy = (y1 + y2) / 2 + nx0 * 24}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <path
                    d="M{x1},{y1} Q{qx},{qy} {x2},{y2}"
                    fill="none"
                    stroke={stroke}
                    stroke-width={isHov ? 3 : isOwn ? 1 : 1.8}
                    stroke-dasharray={isOwn ? '4 3' : undefined}
                    opacity={isConn ? (isHov ? 1 : 0.65) : (selectedNodeId ? 0.06 : 0.3)}
                    marker-end={isOwn ? undefined : edge.type === 'contribution' ? 'url(#m-c)' : 'url(#m-d)'}
                    onmouseenter={() => (hoveredEdgeKey = eKey)}
                    onmouseleave={() => (hoveredEdgeKey = null)}
                    class="cursor-pointer"
                  />
                  {#if edge.label && (isHov || (isConn && selectedNodeId))}
                    <text x={qx} y={qy - 5} text-anchor="middle" font-size="9"
                      fill={stroke} opacity="0.9">{edge.label}</text>
                  {/if}
                {/if}
              {/each}

              <!-- Nodes -->
              {#each simNodes as node}
                {@const fill =
                  node.type === 'founder'  ? '#6366f1' :
                  node.type === 'investor' ? '#a855f7' :
                  node.type === 'wishlist' ? '#0ea5e9' :
                                             '#f59e0b'}
                {@const isSelected = selectedNodeId === node.id}
                {@const isFaded = connectedNodeIds != null && !connectedNodeIds.has(node.id)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <g
                  transform="translate({node.x},{node.y})"
                  style="cursor: grab; opacity: {isFaded ? 0.18 : 1}; transition: opacity 0.2s"
                  onpointerdown={(e: PointerEvent) => onNodeDown(e, node.id)}
                  onpointerup={(e: PointerEvent) => onNodeUp(e, node.id)}
                >
                  {#if isSelected}
                    <circle r={NODE_R + 8} fill={fill} opacity="0.18" filter="url(#glow)"/>
                    <circle r={NODE_R + 5} fill="none" stroke={fill} stroke-width="2.5" opacity="0.5"
                      stroke-dasharray="none"/>
                  {/if}
                  <circle r={NODE_R} fill={fill} opacity="0.9"/>
                  <text y="-7" text-anchor="middle" font-size="10" fill="white" font-weight="700"
                    pointer-events="none">
                    {node.label.length > 13 ? node.label.slice(0, 12) + '…' : node.label}
                  </text>
                  <text y="7" text-anchor="middle" font-size="8" fill="white" opacity="0.7"
                    pointer-events="none">
                    {node.type === 'wishlist' ? (node.companyName ?? '').slice(0, 15) : (node.email ?? '').slice(0, 17)}
                  </text>
                  <text y="20" text-anchor="middle" font-size="7.5" fill="white" opacity="0.45"
                    font-style="italic" pointer-events="none">{node.type}</text>
                </g>
              {/each}
            </svg>
          </div>

          <!-- Detail panel (shown when a node is selected) -->
          {#if selectedNodeId}
            {@const selNode = simNodes.find((n: any) => n.id === selectedNodeId)}
            {@const fill =
              selNode?.type === 'founder'  ? '#6366f1' :
              selNode?.type === 'investor' ? '#a855f7' :
              selNode?.type === 'wishlist' ? '#0ea5e9' :
                                             '#f59e0b'}
            <div class="rounded-2xl border-2 mb-5 overflow-hidden" style="border-color:{fill}44">
              <!-- Panel header -->
              <div class="flex items-center justify-between px-4 py-3"
                style="background:{fill}15">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="inline-block w-3 h-3 rounded-full flex-shrink-0" style="background:{fill}"></span>
                  <span class="font-semibold truncate">{selNode?.label}</span>
                  <span class="badge badge-xs capitalize" style="background:{fill}25; color:{fill}">{selNode?.type}</span>
                  {#if selNode?.email}
                    <span class="text-xs text-base-content/50 hidden sm:inline truncate">{selNode.email}</span>
                  {/if}
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="text-xs text-base-content/40">{connectedEdges.length} transaction{connectedEdges.length !== 1 ? 's' : ''}</span>
                  <button class="btn btn-xs btn-ghost" onclick={() => { selectedNodeId = null; }}>✕</button>
                </div>
              </div>

              {#if connectedEdges.length === 0}
                <p class="text-sm text-base-content/40 px-4 py-4">No transactions match current filters for this node.</p>
              {:else}
                <div class="divide-y divide-base-300">
                  {#each connectedEdges as e}
                    {@const isFrom = e.from === selectedNodeId}
                    {@const otherId = isFrom ? e.to : e.from}
                    {@const other = simNodes.find((n: any) => n.id === otherId)}
                    {@const oFill =
                      other?.type === 'founder'  ? '#6366f1' :
                      other?.type === 'investor' ? '#a855f7' :
                      other?.type === 'wishlist' ? '#0ea5e9' :
                                                   '#f59e0b'}
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-base-200/50 transition-colors text-sm">
                      <!-- Direction arrow + edge type badge -->
                      <span class="badge badge-sm border-0 whitespace-nowrap flex-shrink-0
                        {e.type === 'contribution' ? 'text-green-400 bg-green-500/15' :
                         e.type === 'deployment'  ? 'text-indigo-400 bg-indigo-500/15' :
                         'badge-ghost'}">
                        {isFrom ? '→' : '←'} {e.type}
                      </span>
                      <!-- Other node pill -->
                      <span class="flex items-center gap-1.5">
                        <span class="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:{oFill}"></span>
                        <strong class="font-medium">{other?.label ?? shortAddr(otherId)}</strong>
                        <span class="text-xs text-base-content/45 capitalize">{other?.type ?? ''}</span>
                      </span>
                      <!-- Chain badge -->
                      {#if e.chain}
                        <span class="badge badge-xs badge-outline capitalize">{e.chain}</span>
                      {/if}
                      <!-- Amount -->
                      {#if e.label}
                        <span class="font-semibold font-mono text-sm">{e.label}</span>
                      {/if}
                      <!-- Status -->
                      {#if e.status && e.type === 'deployment'}
                        <span class="badge badge-xs {e.status === 'deployed' ? 'badge-success' : e.status === 'failed' ? 'badge-error' : 'badge-ghost'}">{e.status}</span>
                      {/if}
                      <!-- Tx hash -->
                      {#if e.txHash}
                        <span class="text-xs font-mono text-base-content/35" title={e.txHash}>{shortAddr(e.txHash)}</span>
                      {/if}
                      <!-- Date (right-aligned) -->
                      {#if e.date}
                        <span class="text-xs text-base-content/35 ml-auto">{new Date(e.date).toLocaleDateString()}</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}

        {:else if !txLoading}
          <div class="rounded-2xl border border-base-300 bg-base-200/40 p-10 text-center text-base-content/40 mb-6">
            No transaction data yet. Contributions and deployments will appear here.
          </div>
        {/if}

        <!-- ── Flat table ──────────────────────────────────────────────────── -->
        {#if txRows.length > 0}
          <div class="overflow-x-auto rounded-2xl border border-base-300">
            <table class="table table-sm w-full">
              <thead>
                <tr class="text-xs text-base-content/50">
                  <th>Type</th>
                  <th>Date</th>
                  <th>From (actor)</th>
                  <th>Wishlist item</th>
                  <th>Company</th>
                  <th>Chain</th>
                  <th>Amount</th>
                  <th>Status / Tx</th>
                </tr>
              </thead>
              <tbody>
                {#each txRows as row}
                  {@const actor = row.type === 'contribution' ? row.contributor : row.deployer}
                  {@const amount =
                    row.type === 'contribution'
                      ? (row.amountEur != null
                          ? `€${(row.amountEur as number).toFixed(2)}`
                          : row.amountEth != null
                            ? `${(row.amountEth as number).toFixed(4)} ${row.currencySymbol ?? ''}`
                            : '—')
                      : (row.amountUsdc != null ? `$${(row.amountUsdc as number).toFixed(2)} USDC` : '—')}
                  <tr class="hover">
                    <td>
                      <span class="badge badge-sm {row.type === 'contribution' ? 'text-green-400 bg-green-500/15' : 'text-indigo-400 bg-indigo-500/15'} border-0">
                        {row.type === 'contribution' ? '💰 Contrib' : '🚀 Deploy'}
                      </span>
                    </td>
                    <td class="text-xs opacity-60 whitespace-nowrap">{new Date(row.date).toLocaleDateString()}</td>
                    <td>
                      <div class="text-xs">
                        <div class="font-medium">{actor?.name ?? '—'}</div>
                        <div class="opacity-50">{actor?.email?.slice(0, 24) ?? (actor?.address ? shortAddr(actor.address) : '—')}</div>
                      </div>
                    </td>
                    <td class="text-xs max-w-[150px] truncate">{row.wishlistItem?.title ?? '—'}</td>
                    <td class="text-xs opacity-70">{row.company?.name ?? '—'}</td>
                    <td class="text-xs">
                      <span class="badge badge-xs badge-outline capitalize">{row.chain}</span>
                    </td>
                    <td class="text-xs font-semibold whitespace-nowrap">{amount}</td>
                    <td class="text-xs">
                      {#if row.type === 'contribution'}
                        {#if row.isRefunded}
                          <span class="badge badge-sm badge-warning">refunded</span>
                        {:else if row.txHash}
                          <span class="font-mono opacity-60" title={row.txHash}>{shortAddr(row.txHash)}</span>
                        {:else}
                          <span class="opacity-40">manual</span>
                        {/if}
                      {:else}
                        <span class="badge badge-sm {row.status === 'deployed' ? 'badge-success' : row.status === 'failed' ? 'badge-error' : 'badge-ghost'}">{row.status}</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          {#if txTotal > txLimit}
            <div class="flex justify-center gap-2 mt-4">
              <button class="btn btn-sm btn-ghost" disabled={txPage <= 1 || txLoading}
                onclick={() => { txPage--; loadTransactions(); }}>← Prev</button>
              <span class="btn btn-sm btn-disabled no-animation">{txPage} / {Math.ceil(txTotal / txLimit)}</span>
              <button class="btn btn-sm btn-ghost" disabled={txPage >= Math.ceil(txTotal / txLimit) || txLoading}
                onclick={() => { txPage++; loadTransactions(); }}>Next →</button>
            </div>
          {/if}
        {:else if !txLoading}
          <p class="text-center text-base-content/40 py-6">No records match the current filter.</p>
        {/if}
      {/if}
    </div>
  {/if}
</div>
