import { sign, verify, type SignOptions } from 'jsonwebtoken';
import { JwtConfig } from '../config/jwt.config';

/**
 * Sign a JWT token with secure configuration
 * @param payload - Token payload (should include 'sub' for user ID)
 * @param expiresIn - Token expiration (default: 15 minutes)
 * @param issuer - Token issuer (optional, for added security)
 * @param audience - Token audience (optional, for added security)
 * @returns Signed JWT token
 */
export function signJwt(
  payload: object,
  expiresIn: string | number = '15m',
  options?: { issuer?: string; audience?: string }
) {
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
  options?: { issuer?: string; audience?: string }
) {
  try {
    return verify(token, JwtConfig.getSecret(), {
      ...(options?.issuer && { issuer: options.issuer }),
      ...(options?.audience && { audience: options.audience }),
    });
  } catch (e) {
    // Log error details for debugging (without exposing to client)
    if (process.env.NODE_ENV !== 'production') {
      console.error('JWT verification failed:', e.message);
    }
    return null;
  }
}
