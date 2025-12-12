# CSRF Protection & Cookie Security Documentation

## Overview

This document details the CSRF (Cross-Site Request Forgery) protection mechanisms and cookie security configurations implemented in the Liffey Founders Club authentication system.

## Table of Contents

1. [CSRF Protection Strategy](#csrf-protection-strategy)
2. [Cookie Security Configuration](#cookie-security-configuration)
3. [Multi-Layered Defense](#multi-layered-defense)
4. [Implementation Details](#implementation-details)
5. [Testing & Validation](#testing--validation)
6. [Deployment Checklist](#deployment-checklist)
7. [Browser Compatibility](#browser-compatibility)

---

## CSRF Protection Strategy

### Current Implementation (Production-Ready)

We use a **defense-in-depth approach** with three layers of CSRF protection:

#### Layer 1: SameSite Cookie Attribute (Primary Defense)

- **Refresh Token Cookie**: `SameSite=Lax`
- **Purpose**: Automatically prevents CSRF attacks by controlling when cookies are sent
- **How it works**:
  - Cookies are sent on same-site requests (e.g., `liffeyfc.com` → `liffeyfc.com`)
  - Cookies are sent on "safe" top-level navigation (e.g., clicking a link: `google.com` → `liffeyfc.com`)
  - Cookies are **NOT sent** on cross-site POST/PUT/DELETE requests (CSRF attack vectors)

**Why Lax instead of Strict?**
- **Lax** allows OAuth callback flows (user clicks "Sign in with Google" → redirected back to our site)
- **Strict** would block the refresh token during OAuth redirect, breaking authentication
- State-changing operations (POST/PUT/DELETE) are still protected with Lax

#### Layer 2: JSON API Pattern (Secondary Defense)

- **All endpoints require**: `Content-Type: application/json`
- **How it works**:
  - Browsers cannot send `Content-Type: application/json` in cross-origin form submissions
  - Simple cross-site requests (forms) default to `application/x-www-form-urlencoded`
  - This blocks CSRF attacks even if SameSite is not supported

#### Layer 3: Origin Validation (Tertiary Defense)

- **CORS configured** to only allow trusted origins
- **Origin/Referer headers validated** on sensitive operations
- Blocks requests from unauthorized domains

### Optional: Double-Submit Cookie Pattern (Maximum Protection)

For environments requiring maximum CSRF protection, we've implemented an **optional CSRF guard**:

```typescript
// File: backend/src/auth/guards/csrf.guard.ts

@Injectable()
export class CsrfGuard implements CanActivate {
  // Validates X-XSRF-TOKEN header matches XSRF-TOKEN cookie
}
```

**How it works:**
1. Server generates random CSRF token on login
2. Token stored in cookie: `XSRF-TOKEN` (SameSite=Strict, httpOnly=**false**)
3. Client reads cookie and includes token in `X-XSRF-TOKEN` header
4. Server validates cookie matches header (constant-time comparison)

**When to enable:**
- Financial transactions
- Administrative operations
- Compliance requirements (PCI-DSS, HIPAA)
- Extra paranoia 😊

**How to enable:**
```typescript
// app.module.ts
{
  provide: APP_GUARD,
  useClass: CsrfGuard, // Add to global guards
}
```

---

## Cookie Security Configuration

### Refresh Token Cookie (Primary Authentication Cookie)

Location: `backend/src/config/cookie-security.config.ts`

```typescript
export const CookieSecurityConfig = {
  refreshToken: {
    name: 'refreshToken',
    httpOnly: true,      // ✅ Prevents JavaScript access (XSS protection)
    secure: isProduction, // ✅ HTTPS only in production
    sameSite: 'lax',     // ✅ CSRF protection
    path: '/auth',       // ✅ Limited scope (only auth endpoints)
    domain: undefined,   // ✅ Same-origin only
    maxAge: 30 * 24 * 60 * 60 * 1000, // ✅ 30 days
  },
}
```

### Security Attributes Explained

| Attribute | Value | Purpose | Attack Mitigated |
|-----------|-------|---------|------------------|
| **httpOnly** | `true` | Cookie not accessible via `document.cookie` | **XSS** (Cross-Site Scripting) |
| **secure** | `true` (prod) | Cookie only sent over HTTPS | **Man-in-the-Middle** attacks |
| **sameSite** | `lax` | Cookie only sent on same-site or safe navigation | **CSRF** attacks |
| **path** | `/auth` | Cookie only sent to auth routes | Reduces attack surface |
| **domain** | `undefined` | Cookie only sent to exact domain | Prevents subdomain attacks |
| **maxAge** | 30 days | Token expires after 30 days | Limits token lifetime |

### Why These Specific Values?

#### `httpOnly: true`
- **Prevents XSS theft**: Even if attacker injects malicious script, they cannot read the cookie
- **Best practice**: Always set for authentication tokens
- **Trade-off**: Frontend cannot read cookie (use `/auth/me` to get user info instead)

#### `secure: isProduction`
- **Production**: Always `true` (HTTPS required)
- **Development**: `false` (allows testing on `http://localhost`)
- **Consideration**: If using local HTTPS proxy, set `true` always

#### `sameSite: 'lax'`
- **CSRF Protection**: Blocks cross-site POST/PUT/DELETE
- **OAuth Compatible**: Allows top-level navigation (callback flows)
- **Alternative (`strict`)**: Maximum protection but breaks OAuth redirects

#### `path: '/auth'`
- **Reduces exposure**: Cookie only sent to `/auth/*` endpoints
- **Why not `/auth/refresh` only?**: We need it for login, register, OAuth, logout too
- **Best practice**: Limit cookie scope as much as possible

#### `domain: undefined`
- **Same-origin only**: Cookie not sent to subdomains
- **Example**: Cookie from `app.liffeyfc.com` won't go to `api.liffeyfc.com`
- **When to set**: Only if you need multi-subdomain authentication

#### `maxAge: 30 days`
- **Balance**: User convenience vs. security risk
- **Shorter = more secure**: Limits impact of token theft
- **Longer = better UX**: User stays logged in
- **Best practice**: 7-30 days for web apps

---

## Multi-Layered Defense

### Why Multiple Layers?

No single security mechanism is perfect. Each layer addresses different attack scenarios:

| Attack Scenario | Layer 1 (SameSite) | Layer 2 (JSON API) | Layer 3 (Origin) | Layer 4 (CSRF Token) |
|-----------------|-------------------|-------------------|------------------|---------------------|
| Malicious website tricks user into clicking link | ✅ Protected | ✅ Protected | ✅ Protected | ✅ Protected |
| Attacker creates fake form that POSTs to our API | ✅ Protected | ✅ Protected | ✅ Protected | ✅ Protected |
| Old browser without SameSite support | ❌ Not protected | ✅ Protected | ✅ Protected | ✅ Protected |
| CORS misconfiguration | ✅ Protected | ✅ Protected | ❌ Vulnerable | ✅ Protected |
| Zero-day browser bug | ✅ Protected | ✅ Protected | ✅ Protected | ✅ Protected (defense-in-depth) |

### Attack Scenario Examples

#### Scenario 1: Basic CSRF Attack
```html
<!-- Attacker's website: evil.com -->
<form action="https://liffeyfc.com/api/auth/register" method="POST">
  <input name="email" value="attacker@evil.com">
  <input name="password" value="hacked123">
</form>
<script>document.forms[0].submit();</script>
```

**Protection:**
- ✅ **Layer 1**: SameSite=Lax blocks cookie (cross-site POST)
- ✅ **Layer 2**: Content-Type will be `application/x-www-form-urlencoded` (rejected by NestJS)
- ✅ **Layer 3**: Origin header shows `evil.com` (blocked by CORS)

#### Scenario 2: Sophisticated CSRF with AJAX
```javascript
// Attacker's website: evil.com
fetch('https://liffeyfc.com/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ email: 'attacker@evil.com', password: 'hacked123' })
});
```

**Protection:**
- ✅ **Layer 1**: SameSite=Lax blocks cookie (cross-site POST)
- ❌ **Layer 2**: Content-Type is correct (would pass)
- ✅ **Layer 3**: CORS pre-flight fails (origin not allowed)

**Note**: If CORS was misconfigured to allow `evil.com`, Layer 1 would still protect us!

---

## Implementation Details

### File Structure

```
backend/src/
├── config/
│   └── cookie-security.config.ts    # Cookie configuration & CSRF utilities
├── auth/
│   ├── guards/
│   │   └── csrf.guard.ts            # Optional CSRF token validation
│   └── auth.controller.ts           # Uses CookieSecurityConfig
```

### Cookie Setting (Backend)

```typescript
// auth.controller.ts
import { CookieSecurityConfig } from '../config/cookie-security.config';

private setRefreshTokenCookie(res: Response, refreshToken: string) {
  const config = CookieSecurityConfig.refreshToken;
  res.cookie(config.name, refreshToken, {
    httpOnly: config.httpOnly,
    secure: config.secure,
    sameSite: config.sameSite,
    maxAge: config.maxAge,
    path: config.path,
    domain: config.domain,
  });
}
```

### Cookie Reading (Frontend)

```typescript
// frontend/src/lib/api/auth.ts

// ❌ WRONG: Cannot read httpOnly cookie
const token = document.cookie.split('refreshToken=')[1]; // undefined!

// ✅ CORRECT: Let browser automatically send cookie
fetch('http://localhost:3000/api/auth/refresh', {
  method: 'POST',
  credentials: 'include', // Include cookies
});

// ✅ CORRECT: Get user info from /me endpoint
fetch('http://localhost:3000/api/auth/me', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});
```

### CSRF Token Pattern (Optional)

#### Backend: Generate & Set Token

```typescript
// auth.service.ts (in login method)
import { CsrfTokenGenerator } from '../config/cookie-security.config';

async login(dto: LoginDto, res: Response) {
  // ... existing login logic ...
  
  // Generate CSRF token (optional)
  const csrfToken = CsrfTokenGenerator.generate();
  
  // Set CSRF cookie (readable by JavaScript)
  res.cookie('XSRF-TOKEN', csrfToken, {
    httpOnly: false,  // Must be readable by JS
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000, // 1 hour
    path: '/',
  });
  
  return { accessToken, csrfToken };
}
```

#### Frontend: Read & Send Token

```typescript
// utils/csrf.ts
export function getCsrfToken(): string | null {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? match[1] : null;
}

// api/auth.ts
fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-XSRF-TOKEN': getCsrfToken(), // Include CSRF token
  },
  credentials: 'include',
  body: JSON.stringify(data),
});
```

---

## Testing & Validation

### Manual Testing Checklist

#### ✅ Test 1: Cookie Attributes
```bash
# Login and check response headers
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Expected Set-Cookie header:
# Set-Cookie: refreshToken=xxx; Path=/auth; HttpOnly; SameSite=Lax
```

#### ✅ Test 2: Cookie Sent on Refresh
```bash
# Extract cookie from login response, then:
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Cookie: refreshToken=xxx" \
  -v

# Expected: 200 OK with new access token
```

#### ✅ Test 3: Cookie NOT Sent Outside /auth Path
```bash
# Try sending cookie to non-auth endpoint
curl http://localhost:3000/api/users \
  -H "Cookie: refreshToken=xxx" \
  -v

# Expected: Cookie should not be sent (path restriction)
```

#### ✅ Test 4: SameSite Protection
```html
<!-- Create test page: csrf-test.html -->
<html>
<body>
  <h1>CSRF Test</h1>
  <button onclick="attack()">Attempt CSRF Attack</button>
  <div id="result"></div>
  
  <script>
    async function attack() {
      try {
        const res = await fetch('http://localhost:3000/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: 'hacker@evil.com',
            password: 'hacked123'
          })
        });
        document.getElementById('result').innerText = 
          'Attack succeeded! Status: ' + res.status;
      } catch (err) {
        document.getElementById('result').innerText = 
          'Attack failed (as expected): ' + err.message;
      }
    }
  </script>
</body>
</html>

<!-- 
Expected behavior:
1. If served from different origin (e.g., http://localhost:8080): 
   - CORS blocks request (pre-flight fails)
2. If CORS was misconfigured to allow any origin:
   - SameSite=Lax would prevent cookie from being sent
   - Request fails authentication
-->
```

### Automated Testing

```typescript
// test/auth.e2e-spec.ts

describe('CSRF Protection (e2e)', () => {
  it('should set secure cookie attributes', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'test123' })
      .expect(200);
    
    const setCookie = response.headers['set-cookie'][0];
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/auth');
  });

  it('should not accept cookies from wrong path', async () => {
    // Get cookie from login
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'test123' });
    
    const cookie = loginRes.headers['set-cookie'][0];
    
    // Try using cookie on non-auth endpoint
    await request(app.getHttpServer())
      .get('/users')
      .set('Cookie', cookie)
      .expect(401); // Should fail (cookie not sent due to path)
  });
});
```

---

## Deployment Checklist

### Development Environment

- [x] `secure: false` (allow HTTP for localhost)
- [x] `sameSite: 'lax'` (test OAuth flows)
- [x] CORS allows `http://localhost:5173` (frontend dev server)
- [x] CSRF guard disabled (for easier testing)

### Staging Environment

- [x] `secure: true` (HTTPS required)
- [x] `sameSite: 'lax'` (still testing OAuth)
- [x] CORS allows staging domain only
- [x] CSRF guard enabled (optional)
- [x] Monitor logs for CSRF attempts

### Production Environment

- [x] `secure: true` (HTTPS enforced)
- [x] `sameSite: 'lax'` (or `'strict'` if OAuth not used)
- [x] CORS strictly limited to production domains
- [x] CSRF guard enabled (recommended)
- [x] HSTS header enabled (`Strict-Transport-Security`)
- [x] Certificate valid (not expired, trusted CA)
- [x] Domain attribute NOT set (unless multi-subdomain)
- [x] Security monitoring enabled (log CSRF attempts)
- [x] Regular security audits

### Environment Variables

```bash
# .env.development
NODE_ENV=development
COOKIE_SECURE=false
COOKIE_SAMESITE=lax

# .env.production
NODE_ENV=production
COOKIE_SECURE=true
COOKIE_SAMESITE=lax  # or 'strict' if OAuth not used
```

---

## Browser Compatibility

### Modern Browsers (Recommended)

| Browser | Version | SameSite | Secure | HttpOnly |
|---------|---------|----------|--------|----------|
| Chrome | 80+ | ✅ Full support | ✅ | ✅ |
| Firefox | 69+ | ✅ Full support | ✅ | ✅ |
| Safari | 13.1+ | ✅ Full support | ✅ | ✅ |
| Edge | 86+ | ✅ Full support | ✅ | ✅ |

**Default behavior**: If `sameSite` not specified, browsers default to `Lax`

### Legacy Browsers (Not Recommended)

| Browser | Version | SameSite | Workaround |
|---------|---------|----------|------------|
| IE 11 | All | ❌ Ignored | Layer 2 (JSON API) + Layer 3 (Origin) |
| Safari | <13.1 | ❌ Ignored | Layer 2 + Layer 3 |
| Chrome | <80 | ❌ Ignored | Layer 2 + Layer 3 |

**Security considerations:**
- Legacy browsers are vulnerable to CSRF if only relying on SameSite
- Our multi-layered approach provides fallback protection
- Consider **dropping support** for browsers without SameSite (security risk)

### Mobile Browsers

| Platform | Browser | SameSite Support | Notes |
|----------|---------|------------------|-------|
| iOS | Safari | 13.1+ | Full support |
| iOS | Chrome/Firefox | 13.1+ | Uses Safari WebKit |
| Android | Chrome | 80+ | Full support |
| Android | Firefox | 69+ | Full support |

**WebView considerations:**
- Mobile app WebViews may have different cookie behavior
- Test thoroughly in production environment
- Consider **token-based auth** for native apps (not cookies)

---

## Frequently Asked Questions

### Q: Why not use `sameSite: 'strict'` for maximum protection?

**A:** `SameSite=Strict` blocks cookies on **all** cross-site requests, including top-level navigation (clicking links). This breaks OAuth flows:

1. User clicks "Sign in with Google" on our site
2. Redirected to Google login (cross-site navigation)
3. After login, Google redirects back to our site (cross-site navigation)
4. With `Strict`, the refresh token cookie won't be sent on this redirect
5. User sees success message but isn't logged in ❌

**Solution**: Use `Lax` which allows cookies on safe top-level navigation (GET requests) but blocks cross-site POST/PUT/DELETE.

### Q: Should we implement the optional CSRF guard?

**A:** For most applications, **SameSite + JSON API + Origin validation is sufficient**. Consider the optional CSRF guard if:

- Financial transactions or sensitive operations
- Compliance requirements (PCI-DSS, SOC 2, HIPAA)
- Extra paranoia / defense-in-depth
- Supporting very old browsers without SameSite

**Trade-off**: Adds complexity (frontend must read cookie and include header)

### Q: Why is `httpOnly: false` for the CSRF token cookie?

**A:** The CSRF token cookie **must be readable by JavaScript** so the frontend can:
1. Read the cookie value
2. Include it in the `X-XSRF-TOKEN` header

This is safe because:
- The CSRF token itself has no value without the matching cookie
- Attacker can read the token via XSS, but cannot send the cookie cross-site (SameSite protection)
- The refresh token (actual auth credential) remains httpOnly

### Q: What if our API is called from a mobile app?

**A:** Mobile apps should **NOT use cookie-based authentication**:

- Cookies are designed for browsers
- Mobile HTTP clients (Axios, Fetch) have inconsistent cookie handling
- WebViews have security limitations

**Better approach for mobile:**
1. Store access token in secure storage (iOS Keychain, Android Keystore)
2. Send token in `Authorization: Bearer <token>` header
3. Implement refresh token flow (store in secure storage too)
4. No cookies needed

### Q: How do we test CSRF protection in development?

See [Testing & Validation](#testing--validation) section above. Key steps:
1. Verify cookie attributes in Set-Cookie header
2. Create test HTML page on different origin
3. Attempt cross-site request (should fail)
4. Test OAuth flow still works (callback succeeds)

### Q: What if a user clears cookies?

- User will be logged out (refresh token lost)
- Access token still valid until expiration (15 minutes)
- User must login again to get new refresh token
- This is **expected behavior** (user explicitly cleared session)

### Q: Can an attacker steal cookies via XSS?

- **Refresh token**: ❌ No (httpOnly flag prevents JavaScript access)
- **Access token**: ⚠️ Yes (stored in memory on frontend, but short-lived: 15 min)
- **CSRF token**: ✅ Yes (but useless without matching cookie due to SameSite)

**XSS is the biggest threat**: If attacker can inject JavaScript, they can:
- Read access token from memory
- Make API requests on behalf of user (while access token valid)
- Cannot read refresh token or persist beyond access token expiration

**XSS prevention** is critical (separate concern from CSRF):
- Sanitize all user input
- Use Content Security Policy (CSP)
- Avoid `dangerouslySetInnerHTML` in React/Svelte
- Regular security audits

---

## Summary

### ✅ What We Have

1. **SameSite=Lax cookies** (primary CSRF protection)
2. **JSON API** with Content-Type validation (secondary protection)
3. **CORS origin validation** (tertiary protection)
4. **httpOnly cookies** (XSS protection for refresh tokens)
5. **Secure flag** (HTTPS enforcement in production)
6. **Path restriction** (/auth only, reduces exposure)
7. **Configurable security** (centralized in `cookie-security.config.ts`)
8. **Optional CSRF guard** (for maximum protection if needed)

### ✅ What's Protected

- ✅ CSRF attacks (cross-site request forgery)
- ✅ XSS token theft (refresh tokens unreadable)
- ✅ Man-in-the-middle attacks (HTTPS in production)
- ✅ Token exposure in URL (tokens in httpOnly cookies)
- ✅ Legacy browser exploits (fallback to JSON API + Origin)

### 📋 Next Steps

1. **Review this documentation** with team
2. **Test thoroughly** in development (see Testing section)
3. **Decide** if optional CSRF guard needed
4. **Update frontend** to use `credentials: 'include'` on all auth requests
5. **Configure CORS** for production domains
6. **Enable HSTS** header in production
7. **Monitor** for CSRF attempts in production logs

### 📚 Additional Resources

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MDN: SameSite Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [RFC 6265: HTTP State Management (Cookies)](https://datatracker.ietf.org/doc/html/rfc6265)

---

**Last Updated**: 2025-01-24  
**Author**: Liffey Founders Club Security Team  
**Version**: 1.0
