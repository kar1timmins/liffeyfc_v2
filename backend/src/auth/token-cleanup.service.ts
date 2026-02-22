import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';

/**
 * Token Cleanup Service
 *
 * Automatically removes expired and revoked refresh tokens from the database
 * to prevent accumulation and maintain optimal performance.
 *
 * Why this is important:
 * - Performance: Prevents token table from growing indefinitely
 * - Security: Removes old tokens that are no longer needed
 * - Compliance: GDPR requires data minimization (don't keep data longer than necessary)
 * - Storage: Reduces database size and improves query performance
 *
 * Cleanup strategy:
 * - Runs daily at 3 AM (low traffic time)
 * - Deletes revoked tokens older than 7 days (keeps audit trail)
 * - Deletes expired tokens (no longer valid anyway)
 */
@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  /**
   * Clean up expired and old revoked tokens
   *
   * Runs daily at 3:00 AM (server time)
   * Uses CronExpression.EVERY_DAY_AT_3AM for clarity
   *
   * Can also be triggered manually via /auth/cleanup endpoint if needed
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    name: 'token-cleanup',
    timeZone: 'UTC', // Use UTC for consistency across deployments
  })
  async cleanupTokens(): Promise<{
    deletedExpired: number;
    deletedRevoked: number;
  }> {
    this.logger.log('🧹 Starting token cleanup job...');

    try {
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      // Delete expired tokens (expiresAt is in the past)
      const expiredResult = await this.refreshTokenRepository
        .createQueryBuilder()
        .delete()
        .from(RefreshToken)
        .where('expiresAt < :now', { now })
        .execute();

      const deletedExpired = expiredResult.affected || 0;

      // Delete revoked tokens older than 7 days (keep recent ones for audit trail)
      const revokedResult = await this.refreshTokenRepository
        .createQueryBuilder()
        .delete()
        .from(RefreshToken)
        .where('revoked = :revoked', { revoked: true })
        .andWhere('revokedAt < :sevenDaysAgo', {
          sevenDaysAgo: new Date(sevenDaysAgo),
        })
        .execute();

      const deletedRevoked = revokedResult.affected || 0;

      this.logger.log(
        `✅ Token cleanup completed: ${deletedExpired} expired tokens, ${deletedRevoked} old revoked tokens deleted`,
      );

      return {
        deletedExpired,
        deletedRevoked,
      };
    } catch (error) {
      this.logger.error(
        `❌ Token cleanup failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get statistics about tokens in the database
   * Useful for monitoring and alerting
   */
  async getTokenStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    revoked: number;
  }> {
    const now = Date.now();

    const [total, active, expired, revoked] = await Promise.all([
      this.refreshTokenRepository.count(),
      this.refreshTokenRepository.count({
        where: {
          revoked: false,
          expiresAt: LessThan(now),
        },
      }),
      this.refreshTokenRepository.count({
        where: {
          expiresAt: LessThan(now),
        },
      }),
      this.refreshTokenRepository.count({
        where: {
          revoked: true,
        },
      }),
    ]);

    return {
      total,
      active,
      expired,
      revoked,
    };
  }
}
