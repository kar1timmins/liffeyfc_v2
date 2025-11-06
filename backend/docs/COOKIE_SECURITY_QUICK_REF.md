# Cookie Security - Quick Reference

> **TL;DR**: We use httpOnly cookies with SameSite=Lax for CSRF protection. This is production-ready and OAuth-compatible.

---

## 🍪 Current Cookie Configuration

```typescript
// Location: backend/src/config/cookie-security.config.ts

refreshToken: {
  name: 'refreshToken',
  httpOnly: true,        // ✅ XSS protection (JS can't read it)
  secure: isProduction,  // ✅ HTTPS only in production
  sameSite: 'lax',      // ✅ CSRF protection + OAuth compatible
  path: '/auth',        // ✅ Only sent to /auth/* routes
  maxAge: 30 days,      // ✅ Long-lived session
}
```

---

## 🛡️ How CSRF Protection Works

### Attack Scenario
```html
<!-- Attacker's website: evil.com -->
<form action="https://liffeyfc.com/api/auth/register" method="POST">
  <input name="email" value="hacker@evil.com">
</form>
<script>document.forms[0].submit();</script>
```

### Why It's Blocked

1. **SameSite=Lax** → Cookie not sent on cross-site POST ✅
2. **JSON API** → Form can't send `Content-Type: application/json` ✅
3. **CORS** → Origin validation fails ✅

**Result**: Attack fails at multiple layers 🎉

---

## 💻 Frontend Usage

### ✅ Correct Way (Let Browser Handle Cookies)

```typescript
// Login
const res = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  credentials: 'include', // ← Browser automatically sends/receives cookies
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});

// Refresh
await fetch('http://localhost:3000/api/auth/refresh', {
  method: 'POST',
  credentials: 'include', // ← Cookie sent automatically
});

// Get current user
await fetch('http://localhost:3000/api/auth/me', {
  credentials: 'include',
  headers: {
    'Authorization': `Bearer ${accessToken}`, // ← Access token from memory
  },
});
```

### ❌ Wrong Way (Don't Read httpOnly Cookies)

```typescript
// ❌ DON'T DO THIS: httpOnly cookies can't be read
const token = document.cookie.split('refreshToken=')[1]; // undefined!

// ❌ DON'T DO THIS: Forget credentials
fetch('/api/auth/refresh', {
  method: 'POST',
  // Missing: credentials: 'include'
}); // Cookie not sent!
```

---

## 🔧 Backend Usage

### Setting Cookie (Already Handled)

```typescript
// auth.controller.ts
import { CookieSecurityConfig } from '../config/cookie-security.config';

private setRefreshTokenCookie(res: Response, refreshToken: string) {
  const config = CookieSecurityConfig.refreshToken;
  res.cookie(config.name, refreshToken, config);
}
```

### Reading Cookie (Already Handled)

```typescript
// Any endpoint that needs refresh token
@Post('refresh')
async refresh(@Req() req: Request) {
  const refreshToken = req.cookies['refreshToken']; // ← Read from cookies
  // ... validate and issue new tokens
}
```

---

## 🚨 Common Issues

### Issue 1: Cookie Not Sent
**Symptom**: 401 Unauthorized on `/auth/refresh`  
**Cause**: Missing `credentials: 'include'` in fetch  
**Fix**: Always include `credentials: 'include'`

### Issue 2: Cookie Not Received
**Symptom**: No Set-Cookie header in response  
**Cause**: Backend not configured to send cookies  
**Fix**: Already fixed! `setRefreshTokenCookie()` handles it

### Issue 3: CORS Error
**Symptom**: "Access-Control-Allow-Origin" error  
**Cause**: Frontend origin not in CORS whitelist  
**Fix**: Add origin to `main.ts` CORS config

### Issue 4: OAuth Broken After SameSite
**Symptom**: User stays on login page after Google OAuth  
**Cause**: Using `SameSite=Strict` instead of `Lax`  
**Fix**: Already fixed! We use `Lax` (OAuth-compatible)

---

## 🧪 Quick Testing

### Test 1: Cookie Attributes
```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Expected Set-Cookie header:
# Set-Cookie: refreshToken=xxx; Path=/auth; HttpOnly; SameSite=Lax
```

### Test 2: Cookie Sent on Refresh
```bash
# Login first, copy refreshToken cookie, then:
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Cookie: refreshToken=xxx"

# Expected: 200 OK with new access token
```

### Test 3: Cookie NOT Sent Outside /auth
```bash
curl http://localhost:3000/api/users \
  -H "Cookie: refreshToken=xxx" -v

# Expected: Cookie not sent (path restriction)
```

---

## 📚 When to Read the Full Docs

- **Implementing new auth endpoint**: Read `CSRF_PROTECTION.md` sections 3-4
- **Adding CSRF tokens**: Read `CSRF_PROTECTION.md` section 3.4
- **Debugging CSRF issues**: Read `CSRF_PROTECTION.md` section 5
- **Deploying to production**: Read `CSRF_PROTECTION.md` section 6

---

## 🎯 Key Takeaways

1. **httpOnly cookies prevent XSS theft** → Refresh tokens safe from JavaScript
2. **SameSite=Lax prevents CSRF** → Cross-site attacks blocked automatically
3. **JSON API + CORS add defense-in-depth** → Multiple layers of protection
4. **OAuth still works** → `Lax` allows top-level navigation (callback flows)
5. **Always use `credentials: 'include'`** → Frontend must explicitly send cookies

---

## 🚀 Production Checklist

Before deploying:
- [ ] Change `secure: true` (HTTPS required)
- [ ] Update CORS to production domains only
- [ ] Enable HSTS header
- [ ] Verify SSL certificate valid
- [ ] Test OAuth flow in production

---

**Need more details?** See `backend/docs/CSRF_PROTECTION.md` (600+ lines)  
**Configuration**: `backend/src/config/cookie-security.config.ts`  
**Optional CSRF Guard**: `backend/src/auth/guards/csrf.guard.ts`
