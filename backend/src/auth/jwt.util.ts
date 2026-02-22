import { sign, verify, type SignOptions } from 'jsonwebtoken';
import { JwtConfig } from '../config/jwt.config';
import { type JwtPayload, UserRole } from './types/user-type.interface';

/**
 * Sign a JWT token with secure configuration
 * @param userId - User ID
 * @param userRole - Role of user (user, investor, staff)
 * @param expiresIn - Token expiration (default: 15 minutes)
 * @param options - Optional issuer and audience
 * @returns Signed JWT token
 */
export function signJwt(
  userId: string,
  userRole: UserRole,
  expiresIn: string | number = '15m',
  options?: { issuer?: string; audience?: string },
) {
  const payload: JwtPayload = {
    sub: userId,
    userType: userRole,
  };

  const opts: SignOptions = {
    expiresIn: expiresIn as SignOptions['expiresIn'],
    ...(options?.issuer && { issuer: options.issuer }),
    ...(options?.audience && { audience: options.audience }),
  };

  return sign(payload, JwtConfig.getSecret(), opts);
}

/**
 * Verify and decode a JWT token
 * @param token - JWT token to verify
 * @param options - Verification options (issuer, audience)
 * @returns Decoded token payload or null if invalid
 */
export function verifyJwt(
  token: string,
  options?: { issuer?: string; audience?: string },
): JwtPayload | null {
  try {
    const decoded = verify(token, JwtConfig.getSecret(), {
      ...(options?.issuer && { issuer: options.issuer }),
      ...(options?.audience && { audience: options.audience }),
    });
    return decoded as JwtPayload;
  } catch (e) {
    // Log error details for debugging (without exposing to client)
    if (process.env.NODE_ENV !== 'production') {
      console.error('JWT verification failed:', e.message);
    }
    return null;
  }
}
