import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CsrfTokenGenerator } from '../../config/cookie-security.config';

/**
 * Decorator to skip CSRF validation for specific endpoints
 * Use for GET/HEAD/OPTIONS or when other CSRF protection is in place
 */
export const SkipCsrf = () => Reflector.createDecorator<boolean>();

/**
 * CSRF Protection Guard
 *
 * Implements Double-Submit Cookie pattern:
 * 1. CSRF token stored in cookie (SameSite=Strict, httpOnly=false)
 * 2. Client must send same token in X-XSRF-TOKEN header
 * 3. Server validates cookie matches header
 *
 * This is defense-in-depth on top of SameSite cookies and JSON API.
 * Only applied to state-changing operations (POST/PUT/PATCH/DELETE).
 *
 * Note: This guard is OPTIONAL. Our current implementation relies on:
 * - SameSite=Lax cookies (primary CSRF protection)
 * - JSON API with Content-Type validation (secondary)
 * - Origin validation via CORS (tertiary)
 *
 * Enable this guard if you need maximum CSRF protection.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if CSRF validation should be skipped for this endpoint
    const skipCsrf = this.reflector.get(SkipCsrf, context.getHandler());
    if (skipCsrf) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    // Skip CSRF validation for safe HTTP methods (GET, HEAD, OPTIONS)
    // These don't modify state and are protected by SameSite anyway
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    // For state-changing methods (POST, PUT, PATCH, DELETE), validate CSRF token
    const cookieToken = request.cookies['XSRF-TOKEN'];
    const headerToken = request.headers['x-xsrf-token'] as string;

    // Both tokens must be present
    if (!cookieToken || !headerToken) {
      throw new ForbiddenException({
        message: 'CSRF token missing',
        code: 'CSRF_TOKEN_MISSING',
        hint: 'Include X-XSRF-TOKEN header with request',
      });
    }

    // Validate tokens match (constant-time comparison)
    if (!CsrfTokenGenerator.validate(cookieToken, headerToken)) {
      throw new ForbiddenException({
        message: 'CSRF token mismatch',
        code: 'CSRF_TOKEN_INVALID',
        hint: 'CSRF token does not match. Request may be forged.',
      });
    }

    return true;
  }
}

/**
 * Usage Example:
 *
 * 1. Apply globally in app.module.ts:
 *    {
 *      provide: APP_GUARD,
 *      useClass: CsrfGuard,
 *    }
 *
 * 2. Skip for specific endpoints:
 *    @SkipCsrf()
 *    @Get('public-data')
 *    getPublicData() { ... }
 *
 * 3. Client must include token in header:
 *    fetch('/api/auth/register', {
 *      method: 'POST',
 *      headers: {
 *        'Content-Type': 'application/json',
 *        'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
 *      },
 *      credentials: 'include',
 *      body: JSON.stringify(data),
 *    })
 */
