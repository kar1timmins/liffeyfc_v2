import { Injectable, Logger } from '@nestjs/common';

export enum SecurityEventType {
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  REGISTRATION_FAILED = 'REGISTRATION_FAILED',
  REGISTRATION_SUCCESS = 'REGISTRATION_SUCCESS',
  REFRESH_TOKEN_REUSE = 'REFRESH_TOKEN_REUSE',
  REFRESH_TOKEN_INVALID = 'REFRESH_TOKEN_INVALID',
  JWT_VERIFICATION_FAILED = 'JWT_VERIFICATION_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  OAUTH_FAILED = 'OAUTH_FAILED',
  SIWE_FAILED = 'SIWE_FAILED',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',
  PASSWORD_RESET_FAILED = 'PASSWORD_RESET_FAILED',
}

export interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  email?: string;
  ip: string;
  userAgent?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

/**
 * Security monitoring service for tracking authentication events
 * 
 * Features:
 * - Logs security events (failed logins, token reuse, rate limiting)
 * - Tracks failed login attempts by IP and email
 * - Implements account lockout after repeated failures
 * - Can be extended to send alerts or integrate with SIEM systems
 */
@Injectable()
export class SecurityMonitoringService {
  private readonly logger = new Logger(SecurityMonitoringService.name);
  
  /**
   * In-memory storage for failed login attempts
   * Key: email or IP address
   * Value: { count, firstAttempt, lastAttempt, lockedUntil? }
   * 
   * Production: Move to Redis for persistence and multi-instance support
   */
  private failedLoginAttempts = new Map<string, {
    count: number;
    firstAttempt: Date;
    lastAttempt: Date;
    lockedUntil?: Date;
  }>();

  // Configuration
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  private readonly ATTEMPT_WINDOW = 30 * 60 * 1000; // 30 minutes

  /**
   * Log a security event
   */
  logEvent(event: SecurityEvent): void {
    const logData = {
      type: event.type,
      timestamp: event.timestamp.toISOString(),
      ip: event.ip,
      userId: event.userId,
      email: event.email,
      userAgent: event.userAgent,
      ...event.details,
    };

    // Log based on severity
    switch (event.type) {
      case SecurityEventType.LOGIN_FAILED:
      case SecurityEventType.REFRESH_TOKEN_INVALID:
      case SecurityEventType.JWT_VERIFICATION_FAILED:
        this.logger.warn('Security Event:', logData);
        break;
      
      case SecurityEventType.REFRESH_TOKEN_REUSE:
      case SecurityEventType.RATE_LIMIT_EXCEEDED:
      case SecurityEventType.ACCOUNT_LOCKED:
      case SecurityEventType.SUSPICIOUS_ACTIVITY:
        this.logger.error('Security Alert:', logData);
        break;
      
      case SecurityEventType.LOGIN_SUCCESS:
      case SecurityEventType.REGISTRATION_SUCCESS:
        this.logger.log('Security Event:', logData);
        break;
      
      default:
        this.logger.debug('Security Event:', logData);
    }

    // TODO: In production, send to:
    // - Centralized logging system (ELK, Splunk)
    // - SIEM (Security Information and Event Management)
    // - Alert system (Slack, PagerDuty) for critical events
  }

  /**
   * Record a failed login attempt
   * Returns true if account should be locked
   */
  recordFailedLogin(identifier: string): boolean {
    const now = new Date();
    const existing = this.failedLoginAttempts.get(identifier);

    if (!existing) {
      // First failed attempt
      this.failedLoginAttempts.set(identifier, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      return false;
    }

    // Check if we're outside the attempt window (reset counter)
    const timeSinceFirst = now.getTime() - existing.firstAttempt.getTime();
    if (timeSinceFirst > this.ATTEMPT_WINDOW) {
      this.failedLoginAttempts.set(identifier, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      return false;
    }

    // Increment counter
    existing.count++;
    existing.lastAttempt = now;

    // Check if we should lock the account
    if (existing.count >= this.MAX_FAILED_ATTEMPTS) {
      existing.lockedUntil = new Date(now.getTime() + this.LOCKOUT_DURATION);
      this.failedLoginAttempts.set(identifier, existing);
      
      this.logEvent({
        type: SecurityEventType.ACCOUNT_LOCKED,
        email: identifier,
        ip: 'system',
        timestamp: now,
        details: {
          failedAttempts: existing.count,
          lockedUntil: existing.lockedUntil.toISOString(),
        },
      });
      
      return true;
    }

    this.failedLoginAttempts.set(identifier, existing);
    return false;
  }

  /**
   * Check if an account is currently locked
   */
  isAccountLocked(identifier: string): boolean {
    const existing = this.failedLoginAttempts.get(identifier);
    if (!existing?.lockedUntil) return false;

    const now = new Date();
    if (now < existing.lockedUntil) {
      return true;
    }

    // Lock expired, reset counter
    this.failedLoginAttempts.delete(identifier);
    return false;
  }

  /**
   * Get remaining lockout time in seconds
   */
  getLockoutRemaining(identifier: string): number {
    const existing = this.failedLoginAttempts.get(identifier);
    if (!existing?.lockedUntil) return 0;

    const now = new Date();
    const remaining = Math.max(0, existing.lockedUntil.getTime() - now.getTime());
    return Math.ceil(remaining / 1000);
  }

  /**
   * Reset failed login attempts (e.g., after successful login)
   */
  resetFailedAttempts(identifier: string): void {
    this.failedLoginAttempts.delete(identifier);
  }

  /**
   * Get failed attempt count
   */
  getFailedAttemptCount(identifier: string): number {
    return this.failedLoginAttempts.get(identifier)?.count || 0;
  }

  /**
   * Clean up old entries (called periodically)
   */
  cleanupOldEntries(): void {
    const now = new Date();
    const cutoff = now.getTime() - this.ATTEMPT_WINDOW;

    for (const [key, value] of this.failedLoginAttempts.entries()) {
      // Remove entries older than attempt window and not locked
      if (value.lastAttempt.getTime() < cutoff && !value.lockedUntil) {
        this.failedLoginAttempts.delete(key);
      }
      // Remove expired locks
      if (value.lockedUntil && now > value.lockedUntil) {
        this.failedLoginAttempts.delete(key);
      }
    }

    this.logger.debug(`Cleanup: ${this.failedLoginAttempts.size} entries remaining`);
  }
}
