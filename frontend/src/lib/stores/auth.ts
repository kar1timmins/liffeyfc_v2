import { writable } from 'svelte/store';

type AuthState = {
  user: any | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
};

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
  });

  function persistTokens(accessToken: string | null, refreshToken: string | null) {
    if (typeof window === 'undefined') return;
    if (accessToken) sessionStorage.setItem('jwt', accessToken); else sessionStorage.removeItem('jwt');
    if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken); else sessionStorage.removeItem('refreshToken');
  }

  async function loadFromStorage() {
    if (typeof window === 'undefined') return;
    const accessToken = sessionStorage.getItem('jwt');
    const refreshToken = sessionStorage.getItem('refreshToken');
    if (accessToken) {
      update(s => ({ ...s, accessToken, refreshToken }));
      await verify();
    }
  }

  async function setTokens(accessToken: string, refreshToken?: string, user?: any) {
    persistTokens(accessToken, refreshToken || null);
    update(s => ({ ...s, accessToken, refreshToken: refreshToken || null, user: user || s.user, isAuthenticated: true }));
  }

  function clear() {
    persistTokens(null, null);
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  }

  async function login(email: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || 'Login failed');
    const payload = json.data || json;
    await setTokens(payload.accessToken, payload.refreshToken, payload.user);
    return payload;
  }

  async function register(email: string, password: string, name?: string) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || 'Registration failed');
    return json.data || json;
  }

  async function verify() {
    let ok = false;
    let token: string | null = null;
    update(s => { token = s.accessToken; return s; });
    if (!token && typeof window !== 'undefined') token = sessionStorage.getItem('jwt');
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        update(s => ({ ...s, user: json.data || json, isAuthenticated: true }));
        ok = true;
      } else if (res.status === 401) {
        // try refresh
        const refreshed = await tryRefresh();
        ok = !!refreshed;
      }
    } catch (e) {
      ok = false;
    }
    if (!ok) clear();
    return ok;
  }

  async function tryRefresh() {
    const refreshToken = sessionStorage.getItem('refreshToken');
    if (!refreshToken) return false;
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const json = await res.json();
      if (!res.ok) return false;
      const payload = json.data || json;
      await setTokens(payload.accessToken, payload.refreshToken, payload.user);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function logout() {
    // optionally tell backend to revoke
    const refreshToken = sessionStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      } catch (e) {
        // ignore
      }
    }
    clear();
  }

  // initialize from storage (non-blocking)
  if (typeof window !== 'undefined') {
    loadFromStorage();
  }

  return {
    subscribe,
    login,
    register,
    logout,
    verify,
    setTokens,
    clear,
  };
}

export const authStore = createAuthStore();

export default authStore;
