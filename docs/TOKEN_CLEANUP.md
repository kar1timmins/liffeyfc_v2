# Token Cleanup Service

## Overview

The Token Cleanup Service automatically removes expired and old revoked refresh tokens from the database to maintain optimal performance, security, and compliance with data protection regulations.

## Why Token Cleanup is Important

### 1. Performance
- **Prevents Database Bloat**: Without cleanup, tokens accumulate indefinitely, leading to millions of rows
- **Faster Queries**: Smaller tables mean faster `SELECT`, `UPDATE`, and `DELETE` operations
- **Reduced Index Size**: Fewer rows = smaller indexes = faster lookups
- **Lower Memory Usage**: PostgreSQL buffers frequently accessed data in memory

### 2. Security
- **Reduces Attack Surface**: Old tokens that were never properly revoked are eliminated
- **Compliance**: Adheres to principle of data minimization
- **Audit Trail**: Keeps recent revoked tokens (7 days) for security investigations

### 3. Compliance
- **GDPR Article 5(1)(e)**: Data minimization - don't keep data longer than necessary
- **OWASP**: Recommends regular cleanup of authentication artifacts
- **SOC 2**: Demonstrates proper data lifecycle management
- **PCI-DSS**: Requirement 3.1 - Keep cardholder data retention to a minimum

### 4. Cost Savings
- **Storage Costs**: Fewer rows = less disk space (especially important for cloud databases)
- **Backup Costs**: Smaller databases = faster, cheaper backups
- **Replication Costs**: Less data to replicate across regions

## Implementation

### Automatic Cleanup (Cron Job)

The service runs automatically every day at 3:00 AM UTC:

```typescript
@Cron(CronExpression.EVERY_DAY_AT_3AM, {
  name: 'token-cleanup',
  timeZone: 'UTC',
})
async cleanupTokens()
```

### Cleanup Rules

1. **Expired Tokens**: Deleted immediately (no longer valid anyway)
   - `expiresAt < NOW()`

2. **Revoked Tokens**: Deleted after 7 days (keeps audit trail)
   - `revoked = true AND revokedAt < NOW() - INTERVAL '7 days'`

### Manual Cleanup

You can trigger cleanup manually for testing or emergency situations:

```bash
# Trigger cleanup
curl -X POST http://localhost:3000/auth/admin/cleanup-tokens

# Response
{
  "success": true,
  "data": {
    "message": "Token cleanup completed",
    "deletedExpired": 15,
    "deletedRevoked": 23,
    "total": 38
  }
}
```

### Monitoring

Check token statistics to monitor accumulation:

```bash
# Get token statistics
curl http://localhost:3000/auth/admin/token-stats

# Response
{
  "success": true,
  "data": {
    "total": 1250,      // Total tokens in database
    "active": 450,      // Valid, non-revoked tokens
    "expired": 300,     // Expired tokens (will be cleaned)
    "revoked": 500      // Revoked tokens (old ones will be cleaned)
  }
}
```

## Production Recommendations

### 1. Protect Admin Endpoints

Add authentication to the admin endpoints:

```typescript
@Post('admin/cleanup-tokens')
@UseGuards(JwtAuthGuard, AdminGuard) // Add admin guard
@Throttle({ default: { limit: 3, ttl: 60000 } })
async cleanupTokens() { ... }
```

### 2. Set Up Monitoring & Alerts

Create alerts for token accumulation:

```typescript
// Example alert condition
if (stats.total > 100000) {
  // Send alert to monitoring service
  logger.error('Token table has grown too large', stats);
}
```

### 3. Configure Retention Period

Adjust the 7-day retention period based on your requirements:

```typescript
// In token-cleanup.service.ts
const RETENTION_DAYS = parseInt(process.env.TOKEN_RETENTION_DAYS || '7', 10);
const retentionTime = now - RETENTION_DAYS * 24 * 60 * 60 * 1000;
```

### 4. Schedule During Low Traffic

The default 3:00 AM UTC is chosen for low traffic, but adjust based on your user base:

```typescript
@Cron('0 3 * * *', { timeZone: 'America/New_York' }) // 3 AM EST
```

### 5. Add Database Indexes

Ensure these indexes exist for efficient cleanup:

```sql
-- Index for expired tokens cleanup
CREATE INDEX idx_refresh_tokens_expires_at 
ON refresh_tokens(expiresAt) 
WHERE revoked = false;

-- Index for revoked tokens cleanup
CREATE INDEX idx_refresh_tokens_revoked_at 
ON refresh_tokens(revokedAt) 
WHERE revoked = true;
```

## Expected Performance Impact

### With Short Token Expiry (2 hours)

Assuming 1000 active users, each logging in once per day:

- **Tokens created per day**: ~1000 refresh tokens + rotations = ~2000 tokens/day
- **Tokens with 2-hour expiry**: Most expire quickly (90%+ cleaned daily)
- **Revoked tokens (7-day retention)**: ~500-1000 tokens retained
- **Expected database size**: 2000-5000 tokens total (stable)

### Without Cleanup

Same scenario without cleanup:

- **Tokens accumulated per month**: ~60,000 tokens
- **Tokens accumulated per year**: ~730,000 tokens
- **5-year accumulation**: ~3.6 million tokens
- **Impact**: Significant performance degradation, increased costs

## Logging

The service logs cleanup operations:

```
🧹 Starting token cleanup job...
✅ Token cleanup completed: 15 expired tokens, 23 old revoked tokens deleted
```

Errors are logged with stack traces:

```
❌ Token cleanup failed: Database connection timeout
```

## Integration with Security Monitoring

The cleanup service works alongside:

1. **Refresh Token Reuse Detection**: Revokes tokens, then cleanup removes them after 7 days
2. **Short Token Expiry**: 2-hour tokens expire quickly, cleanup removes them daily
3. **Security Monitoring**: Keeps recent revoked tokens for audit trail

## Testing

Test the cleanup service in development:

```bash
# 1. Create test tokens (register users)
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "SecurePass123!"}'

# 2. Check token stats
curl http://localhost:3000/auth/admin/token-stats

# 3. Trigger manual cleanup
curl -X POST http://localhost:3000/auth/admin/cleanup-tokens

# 4. Verify cleanup (expired/old revoked tokens should be removed)
curl http://localhost:3000/auth/admin/token-stats
```

## FAQ

**Q: Why keep revoked tokens for 7 days instead of deleting immediately?**  
A: Security investigations may need to review recently revoked tokens to detect attack patterns (e.g., token theft, reuse attempts). After 7 days, the forensic value diminishes.

**Q: What happens if the cron job fails?**  
A: The job logs the error and will retry on the next scheduled run (24 hours later). Tokens will accumulate temporarily but won't cause immediate issues.

**Q: Can I run cleanup more frequently?**  
A: Yes, but it's usually unnecessary. Daily cleanup is sufficient for most applications. More frequent cleanup increases database load without significant benefit.

**Q: Will cleanup delete active user sessions?**  
A: No, cleanup only removes:
- Expired tokens (already invalid)
- Revoked tokens older than 7 days (already invalidated)

Active tokens are never touched.

**Q: How do I adjust the 7-day retention period?**  
A: Modify `RETENTION_DAYS` in `token-cleanup.service.ts` or make it configurable via environment variable.

**Q: Should I run cleanup on a primary or replica database?**  
A: Run on the primary (writable) database. DELETE operations must execute on the primary and will replicate to read replicas.

## See Also

- [Token Expiry Optimization](./TOKEN_EXPIRY_UPDATE.md)
- [Security Progress](./SECURITY_PROGRESS.md)
- [Refresh Token Reuse Detection](./SECURITY_PROGRESS.md#5-refresh-token-reuse-detection)
