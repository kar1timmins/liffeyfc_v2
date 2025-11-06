import { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Rate limiting configuration for authentication endpoints
 * 
 * Strategy:
 * - Default: 100 requests per minute for general endpoints (lenient for normal usage)
 * - Auth endpoints: Stricter limits applied via @Throttle decorators
 * - Uses in-memory storage (upgrade to Redis for multi-instance deployments)
 */
export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      name: 'default',
      ttl: 60000, // 1 minute in milliseconds
      limit: 100, // 100 requests per minute (lenient for normal browsing)
    },
  ],
};

/**
 * Rate limit configurations by endpoint type
 */
export const RateLimitConfig = {
  // Login: Very strict to prevent brute-force
  LOGIN: {
    ttl: 60000, // 1 minute
    limit: 5, // 5 attempts
    blockDuration: 900000, // 15 minutes block after exceeding limit
  },
  
  // Token refresh: Moderate limits (legitimate users may refresh frequently)
  REFRESH: {
    ttl: 60000, // 1 minute
    limit: 10, // 10 refreshes per minute
  },
  
  // Registration: Prevent account creation spam
  REGISTER: {
    ttl: 3600000, // 1 hour
    limit: 3, // 3 registrations per hour per IP
  },
  
  // SIWE (Web3 sign-in): Moderate limits
  SIWE: {
    ttl: 60000, // 1 minute
    limit: 5, // 5 attempts per minute
  },
  
  // OAuth: Prevent callback abuse
  OAUTH: {
    ttl: 60000, // 1 minute
    limit: 10, // 10 OAuth attempts per minute
  },
  
  // Password reset / sensitive operations
  SENSITIVE: {
    ttl: 3600000, // 1 hour
    limit: 5, // 5 attempts per hour
  },
} as const;
