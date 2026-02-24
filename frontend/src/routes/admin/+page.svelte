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
  } from 'lucide-svelte';

  // ─── State ────────────────────────────────────────────────────────────────
  let activeTab = $state<'stats' | 'users' | 'wallets'>('stats');
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Stats
  let stats = $state<any>(null);

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
    if (reset) { walletsPage = 1; wallets = []; }
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

  // ─── Tab switch ───────────────────────────────────────────────────────────
  function switchTab(tab: typeof activeTab) {
    activeTab = tab;
    error = null;
    if (tab === 'stats' && !stats) loadStats();
    if (tab === 'users' && users.length === 0) loadUsers();
    if (tab === 'wallets' && wallets.length === 0) loadWallets();
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
  <div class="tabs tabs-boxed mb-6 w-full max-w-md">
    <button class="tab flex-1 {activeTab === 'stats' ? 'tab-active' : ''}" onclick={() => switchTab('stats')}>
      <BarChart3 size={15} class="mr-1.5" />Stats
    </button>
    <button class="tab flex-1 {activeTab === 'users' ? 'tab-active' : ''}" onclick={() => switchTab('users')}>
      <Users size={15} class="mr-1.5" />Users
    </button>
    <button class="tab flex-1 {activeTab === 'wallets' ? 'tab-active' : ''}" onclick={() => switchTab('wallets')}>
      <Wallet size={15} class="mr-1.5" />Wallets
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
            <div class="stat-value text-2xl">{stats.users?.byRole?.investor ?? 0}</div>
          </div>
          <div class="stat bg-base-200 rounded-2xl p-4">
            <div class="stat-figure text-secondary"><Crown size={24} /></div>
            <div class="stat-title text-xs">Staff</div>
            <div class="stat-value text-2xl">{stats.users?.byRole?.staff ?? 0}</div>
          </div>
          <div class="stat bg-base-200 rounded-2xl p-4">
            <div class="stat-figure text-success"><UserCheck size={24} /></div>
            <div class="stat-title text-xs">Active</div>
            <div class="stat-value text-2xl">{stats.users?.active ?? 0}</div>
          </div>
        </div>

        <!-- Resources -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div class="card bg-base-200 p-4 rounded-2xl flex items-center gap-3">
            <Building2 size={22} class="text-primary flex-shrink-0" />
            <div>
              <div class="text-2xl font-bold">{stats.companies ?? 0}</div>
              <div class="text-xs text-base-content/60">Companies</div>
            </div>
          </div>
          <div class="card bg-base-200 p-4 rounded-2xl flex items-center gap-3">
            <Wallet size={22} class="text-accent flex-shrink-0" />
            <div>
              <div class="text-2xl font-bold">{stats.masterWallets ?? 0}</div>
              <div class="text-xs text-base-content/60">Master Wallets</div>
            </div>
          </div>
          <div class="card bg-base-200 p-4 rounded-2xl flex items-center gap-3">
            <TrendingUp size={22} class="text-success flex-shrink-0" />
            <div>
              <div class="text-2xl font-bold">{stats.paymentsConfirmed ?? 0}</div>
              <div class="text-xs text-base-content/60">Confirmed Payments</div>
            </div>
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
                        class="select select-bordered select-xs"
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
                        class="btn btn-xs {userDetail.isActive ? 'btn-error' : 'btn-success'} gap-1"
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
                  <div class="font-medium text-sm">{w.user?.name ?? '—'}</div>
                  <div class="text-xs text-base-content/50">{w.user?.email ?? '—'}</div>
                </div>
                <span class="badge badge-sm {roleColor[w.user?.role] ?? 'badge-neutral'}">{w.user?.role ?? '?'}</span>
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
</div>
