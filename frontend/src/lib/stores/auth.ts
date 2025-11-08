import { writable } from 'svelte/store';
import { PUBLIC_API_URL } from '$env/static/public';

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
  // Initialize from localStorage if available
  let initialState: AuthState = {
    user: null,
    accessToken: null,
    isAuthenticated: false,
  };

  if (typeof window !== 'undefined') {
    const storedToken = localStorage.getItem('accessToken');
    if (storedToken) {
      initialState.accessToken = storedToken;
      const decoded = decodeJwt(storedToken);
      if (decoded) {
        initialState.isAuthenticated = true;
      }
    }
  }

  const { subscribe, set, update } = writable<AuthState>(initialState);

  /**
   * Set access token and persist to localStorage
   * Decode JWT to extract userType
   */
  async function setAccessToken(accessToken: string, user?: any) {
    const decoded = decodeJwt(accessToken);
    const enrichedUser = user ? { ...user, userType: decoded?.userType || 'user' } : null;
    
    // Store in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
    }
    
    update(s => ({ ...s, accessToken, user: enrichedUser || s.user, isAuthenticated: true }));
  }

  function clear() {
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
    }
    set({ user: null, accessToken: null, isAuthenticated: false });
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${PUBLIC_API_URL}/auth/login`, {
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
    const res = await fetch(`${PUBLIC_API_URL}/auth/register`, {
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
    
    // Try to get token from store first, then localStorage
    update(s => { 
      token = s.accessToken; 
      return s; 
    });
    
    if (!token && typeof window !== 'undefined') {
      token = localStorage.getItem('accessToken');
    }
    
    if (!token) return false;
    
    try {
      const res = await fetch(`${PUBLIC_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        const decoded = decodeJwt(token);
        const userData = { ...(json.data || json), userType: decoded?.userType || 'user' };
        update(s => ({ ...s, accessToken: token, user: userData, isAuthenticated: true }));
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
      const res = await fetch(`${PUBLIC_API_URL}/auth/refresh`, {
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
      await fetch(`${PUBLIC_API_URL}/auth/logout`, {
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
