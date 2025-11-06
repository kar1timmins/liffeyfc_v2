import { writable } from 'svelte/store';

type AuthState = {
  user: any | null;
  accessToken: string | null;
  isAuthenticated: boolean;
};

/**
 * Decode JWT token to extract payload
 */
function decodeJwt(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    accessToken: null,
    isAuthenticated: false,
  });

  /**
   * Set access token in memory only (no persistent storage)
   * Decode JWT to extract userType
   */
  async function setAccessToken(accessToken: string, user?: any) {
    const decoded = decodeJwt(accessToken);
    const enrichedUser = user ? { ...user, userType: decoded?.userType || 'user' } : null;
    update(s => ({ ...s, accessToken, user: enrichedUser || s.user, isAuthenticated: true }));
  }

  function clear() {
    set({ user: null, accessToken: null, isAuthenticated: false });
  }

  async function login(email: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Send cookies
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || 'Login failed');
    const payload = json.data || json;
    // Store access token in memory only; refresh token is in httpOnly cookie
    await setAccessToken(payload.accessToken, payload.user);
    return payload;
  }

  async function register(email: string, password: string, name?: string) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Send cookies
      body: JSON.stringify({ email, password, name }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || 'Registration failed');
    const payload = json.data || json;
    // Store access token in memory only; refresh token is in httpOnly cookie
    await setAccessToken(payload.accessToken, payload.user);
    return payload;
  }

  async function verify() {
    let ok = false;
    let token: string | null = null;
    update(s => { token = s.accessToken; return s; });
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        const decoded = decodeJwt(token);
        const userData = { ...(json.data || json), userType: decoded?.userType || 'user' };
        update(s => ({ ...s, user: userData, isAuthenticated: true }));
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

  /**
   * Refresh access token using httpOnly cookie
   * No need to send refresh token in body - it's sent automatically via cookie
   */
  async function tryRefresh() {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Send refresh token cookie
      });
      const json = await res.json();
      if (!res.ok) return false;
      const payload = json.data || json;
      // Update access token in memory; new refresh token is set via cookie
      await setAccessToken(payload.accessToken);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function logout() {
    try {
      // Tell backend to revoke refresh token and clear cookie
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Send refresh token cookie for revocation
      });
    } catch (e) {
      // ignore
    }
    clear();
  }

  return {
    subscribe,
    login,
    register,
    logout,
    verify,
    setAccessToken,
    clear,
  };
}

export const authStore = createAuthStore();

export default authStore;
