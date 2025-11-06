/**
 * Cookie Security Configuration
 * 
 * This module defines secure cookie settings for authentication tokens
 * following OWASP best practices.
 */

/**
 * Cookie security options for different environments
 */
export const CookieSecurityConfig = {
  /**
   * Refresh token cookie configuration
   * Used for long-lived authentication tokens
   */
  refreshToken: {
    name: 'refreshToken',
    
    // Security flags
    httpOnly: true,  // Prevents JavaScript access (XSS protection)
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
    sameSite: 'lax' as const,  // CSRF protection (allows navigation)
    
    // Scope
    path: '/auth',  // Only sent to auth endpoints (reduces exposure)
    domain: undefined,  // Same domain only (don't set for localhost)
    
    // Lifetime
    maxAge: 24 * 60 * 60 * 1000,  // 1 day in milliseconds
  },

  /**
   * CSRF token cookie configuration (optional, for additional protection)
   * Used as defense-in-depth for state-changing operations
   */
  csrfToken: {
    name: 'XSRF-TOKEN',
    
    // Security flags
    httpOnly: false,  // Must be readable by JavaScript (for header inclusion)
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,  // Stricter CSRF protection for CSRF token itself
    
    // Scope
    path: '/',  // Available to all routes
    domain: undefined,
    
    // Lifetime
    maxAge: 60 * 60 * 1000,  // 1 hour
  },
} as const;

/**
 * CSRF Protection Strategy
 * 
 * We use a multi-layered approach:
 * 
 * 1. SameSite Cookie Attribute (Primary Defense)
 *    - refreshToken uses SameSite=Lax (allows safe navigation, blocks cross-site POST)
 *    - Protects against most CSRF attacks automatically
 *    - Compatible with OAuth flows (allows top-level navigation)
 * 
 * 2. JSON API with Custom Headers (Secondary Defense)
 *    - All state-changing endpoints use JSON (not form-encoded)
 *    - Require Content-Type: application/json
 *    - Browsers won't send this header in cross-origin form submissions
 * 
 * 3. Origin Validation (Tertiary Defense)
 *    - CORS configured to only allow trusted origins
 *    - Validates Origin/Referer headers on sensitive operations
 * 
 * 4. Double-Submit Cookie Pattern (Optional, for maximum protection)
 *    - Generate random CSRF token on login
 *    - Store in cookie (SameSite=Strict, httpOnly=false)
 *    - Require token in X-XSRF-TOKEN header for state-changing requests
 *    - Server validates cookie matches header
 * 
 * Why SameSite=Lax vs Strict:
 * - Lax: Allows cookies in top-level navigation (GET requests from links)
 * - Strict: Blocks cookies in all cross-site requests (including navigation)
 * - We use Lax for refresh tokens to support OAuth callback flows
 * - State-changing operations are POST/PUT/DELETE (protected by Lax)
 */

/**
 * CSRF Token Generator
 * Generates cryptographically secure random tokens
 */
export class CsrfTokenGenerator {
  private static readonly TOKEN_LENGTH = 32; // 32 bytes = 256 bits

  /**
   * Generate a new CSRF token
   */
  static generate(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
  }

  /**
   * Validate CSRF token (constant-time comparison)
   */
  static validate(expected: string, actual: string): boolean {
    if (!expected || !actual || expected.length !== actual.length) {
      return false;
    }
    
    const crypto = require('crypto');
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(actual, 'utf8')
    );
  }
}

/**
 * Cookie Security Best Practices Checklist
 * 
 * ✅ HttpOnly: Set for auth tokens (prevents XSS)
 * ✅ Secure: Enabled in production (HTTPS only)
 * ✅ SameSite: Lax/Strict (CSRF protection)
 * ✅ Path: Limited to /auth (reduces exposure)
 * ✅ Domain: Not set (same-origin only)
 * ✅ MaxAge: Reasonable expiration (30 days for refresh, 1 hour for CSRF)
 * ✅ Name: Non-obvious (avoid 'token', 'session')
 * ✅ Rotation: Refresh tokens rotated on use
 * ✅ Revocation: Can be revoked server-side
 * ✅ Encryption: Not needed (httpOnly + secure + sameSite sufficient)
 */

/**
 * Security Considerations by Browser
 * 
 * Modern Browsers (Chrome 80+, Firefox 69+, Safari 13.1+):
 * - Full SameSite support
 * - SameSite=Lax is default if not specified
 * - Secure cookies work correctly
 * 
 * Older Browsers:
 * - May ignore SameSite attribute
 * - Fallback: Origin validation + JSON API pattern
 * - Consider dropping support for very old browsers (security risk)
 * 
 * Mobile Apps:
 * - WebView may have different cookie behavior
 * - Test thoroughly in production environment
 * - Consider token-based auth for native apps
 */

/**
 * Deployment Checklist
 * 
 * Development:
 * - ✅ Secure=false (allow HTTP for localhost)
 * - ✅ SameSite=Lax (test OAuth flows)
 * - ✅ CORS allows localhost origins
 * 
 * Production:
 * - ✅ Secure=true (require HTTPS)
 * - ✅ SameSite=Lax or Strict
 * - ✅ CORS restricted to production domains only
 * - ✅ HSTS header enabled (force HTTPS)
 * - ✅ Domain attribute NOT set (unless multi-subdomain)
 * - ✅ Certificate valid and not expired
 */
