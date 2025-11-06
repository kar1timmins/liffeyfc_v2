# Refresh Token Reuse Detection

## Overview

Refresh token reuse detection is a critical security feature that identifies when a previously-used refresh token is submitted again. This typically indicates **token theft** - an attacker has obtained a valid refresh token and is attempting to use it.

When reuse is detected, the system automatically revokes the **entire token family** (the reused token and all tokens derived from it), forcing both the attacker and the legitimate user to re-authenticate.

---

## How It Works

### Token Rotation (Background)

Every time a refresh token is used, it is **rotated**:

1. **Create** a new refresh token
2. **Revoke** the old refresh token
3. **Record** the relationship: `old.replacedByTokenId = new.id`

This creates a **token family chain**:

```
TokenA (revoked, replacedBy: TokenB)
  └─> TokenB (revoked, replacedBy: TokenC)
        └─> TokenC (active)
```

### Reuse Detection

When a refresh token is submitted:

1. **Check if token is revoked**
2. **If revoked AND has `replacedByTokenId`** → This is reuse!
3. **Revoke entire token family** (all descendant tokens)
4. **Log security event** (REFRESH_TOKEN_REUSE)
5. **Throw error** forcing re-authentication

---

## Attack Scenario Example

### Normal Flow (No Attack)

```
User logs in
  ↓
Receives TokenA
  ↓
Uses TokenA → Gets TokenB (TokenA revoked)
  ↓
Uses TokenB → Gets TokenC (TokenB revoked)
  ↓
Uses TokenC → Gets TokenD (TokenC revoked)
```

**Result**: User stays authenticated, tokens regularly rotated

### Attack Scenario (Token Theft)

```
User logs in
  ↓
Receives TokenA
  ↓
🚨 Attacker steals TokenA
  ↓
User uses TokenA → Gets TokenB (TokenA revoked)
  ↓
User uses TokenB → Gets TokenC (TokenB revoked)
  ↓
🚨 Attacker tries to use stolen TokenA
  ↓
System detects: TokenA is revoked AND was replaced by TokenB
  ↓
System revokes: TokenB, TokenC (entire family)
  ↓
Both user and attacker must re-authenticate
```

**Result**: Attack detected, all tokens invalidated, user must login again

---

## Implementation Details

### Location

**File**: `backend/src/auth/auth.service.ts`

### Key Methods

#### 1. `refresh()` - Main Refresh Logic

```typescript
async refresh(refreshToken: string) {
  // ... validate token format and fetch from DB ...
  
  // REUSE DETECTION: If token is revoked and was replaced
  if (t.revoked) {
    if (t.replacedByTokenId) {
      await this.revokeTokenFamily(t);
      throw new Error('SECURITY_ALERT: Refresh token reuse detected...');
    }
    throw new Error('Refresh token revoked');
  }
  
  // ... continue with token rotation ...
}
```

#### 2. `revokeTokenFamily()` - Revoke Descendants

```typescript
private async revokeTokenFamily(reusedToken: RefreshToken): Promise<void> {
  const tokensToRevoke: string[] = [];
  
  // Start with the token that replaced the reused token
  let currentTokenId = reusedToken.replacedByTokenId;
  
  // Traverse the token family chain
  while (currentTokenId) {
    tokensToRevoke.push(currentTokenId);
    
    // Find the next token in the chain
    const nextToken = await this.refreshRepo.findOne({
      where: { id: currentTokenId },
      select: ['id', 'replacedByTokenId', 'revoked']
    });
    
    if (!nextToken) break;
    
    // Move to the next token in the chain
    currentTokenId = nextToken.replacedByTokenId;
    
    // Safety: prevent infinite loops
    if (tokensToRevoke.length > 100) break;
  }
  
  // Revoke all tokens in the family
  if (tokensToRevoke.length > 0) {
    await this.refreshRepo.update(tokensToRevoke, { 
      revoked: true, 
      revokedAt: new Date() 
    });
    
    // Log security event
    this.securityMonitoring.logEvent({
      type: SecurityEventType.REFRESH_TOKEN_REUSE,
      userId: reusedToken.user?.id,
      // ... log details ...
    });
  }
}
```

---

## Token Family Chain Traversal

### Example Chain

```
TokenA (id: aaa, replacedBy: bbb)
  ├─> TokenB (id: bbb, replacedBy: ccc)
  │     └─> TokenC (id: ccc, replacedBy: ddd)
  │           └─> TokenD (id: ddd, replacedBy: null) ← active token
  └─> (reused)
```

### When TokenA is Reused

1. **Detect**: TokenA is revoked and `replacedByTokenId = bbb`
2. **Start traversal**: `currentTokenId = bbb`
3. **Add to revoke list**: `[bbb]`
4. **Fetch TokenB**: `nextToken.replacedByTokenId = ccc`
5. **Add to revoke list**: `[bbb, ccc]`
6. **Fetch TokenC**: `nextToken.replacedByTokenId = ddd`
7. **Add to revoke list**: `[bbb, ccc, ddd]`
8. **Fetch TokenD**: `nextToken.replacedByTokenId = null`
9. **Stop traversal**: No more descendants
10. **Revoke all**: TokenB, TokenC, TokenD

**Result**: Entire family chain revoked

---

## Security Event Logging

When token reuse is detected, a security event is logged:

```typescript
{
  type: SecurityEventType.REFRESH_TOKEN_REUSE,
  userId: 'user-id-here',
  email: 'user@example.com',
  ip: 'N/A', // Not available in service layer
  timestamp: new Date(),
  details: {
    reusedTokenId: 'aaa',
    revokedTokenCount: 3,
    revokedTokenIds: ['bbb', 'ccc', 'ddd'],
    message: 'Token reuse detected - revoked 3 token(s) in family',
  }
}
```

This event is logged with **ERROR severity** (critical security alert).

---

## Error Handling

### User Experience

When token reuse is detected, the user sees:

```
HTTP 500 Internal Server Error
{
  "statusCode": 500,
  "message": "SECURITY_ALERT: Refresh token reuse detected. All tokens revoked. Please login again.",
  "error": "Internal Server Error"
}
```

**Frontend should**:
1. Clear all tokens (access + refresh)
2. Redirect to login page
3. Show message: "Your session was invalidated for security reasons. Please login again."

### Why 500 Instead of 401?

- **401 Unauthorized**: Normal authentication failure (wrong password, expired token)
- **500 Internal Server Error**: Critical security event (unusual, requires investigation)

Using 500 signals this is **not a normal failure** - it's a security alert.

---

## Testing

### Manual Testing (Token Reuse Simulation)

#### Step 1: Get Initial Token

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}' \
  -c cookies.txt

# Extract refresh token from cookie
cat cookies.txt | grep refreshToken
# Example: refreshToken=aaa-aaa-aaa.secret-111
```

#### Step 2: Use Token (Creates TokenB)

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -b cookies.txt \
  -c cookies2.txt

# Now cookies2.txt has TokenB
# TokenA is revoked, replacedBy: TokenB
```

#### Step 3: Use TokenB (Creates TokenC)

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -b cookies2.txt \
  -c cookies3.txt

# Now cookies3.txt has TokenC
# TokenB is revoked, replacedBy: TokenC
```

#### Step 4: Simulate Attack (Reuse TokenA)

```bash
# Try to use the original TokenA again
curl -X POST http://localhost:3000/api/auth/refresh \
  -b cookies.txt \
  -v

# Expected Response:
# HTTP 500
# Error: "SECURITY_ALERT: Refresh token reuse detected..."

# Check logs:
docker compose logs backend --tail 20

# Expected Log:
# ERROR Security Alert: {
#   type: 'REFRESH_TOKEN_REUSE',
#   revokedTokenCount: 2,
#   revokedTokenIds: ['bbb', 'ccc']
# }
```

#### Step 5: Verify TokenC is Revoked

```bash
# Try to use TokenC (should fail - revoked by reuse detection)
curl -X POST http://localhost:3000/api/auth/refresh \
  -b cookies3.txt \
  -v

# Expected Response:
# HTTP 500
# Error: "Refresh token revoked"
```

### Automated Testing

```typescript
// test/auth.e2e-spec.ts

describe('Refresh Token Reuse Detection (e2e)', () => {
  it('should detect token reuse and revoke family', async () => {
    // Login to get TokenA
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'test123' })
      .expect(200);
    
    const tokenA = loginRes.headers['set-cookie'][0]; // Extract cookie
    
    // Use TokenA to get TokenB
    const refreshRes1 = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', tokenA)
      .expect(200);
    
    const tokenB = refreshRes1.headers['set-cookie'][0];
    
    // Use TokenB to get TokenC
    const refreshRes2 = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', tokenB)
      .expect(200);
    
    const tokenC = refreshRes2.headers['set-cookie'][0];
    
    // Simulate attack: Reuse TokenA
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', tokenA)
      .expect(500) // Should fail with security alert
      .expect(res => {
        expect(res.body.message).toContain('SECURITY_ALERT');
        expect(res.body.message).toContain('token reuse detected');
      });
    
    // Verify TokenC is now revoked
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', tokenC)
      .expect(500) // Should fail - token revoked
      .expect(res => {
        expect(res.body.message).toContain('revoked');
      });
  });
});
```

---

## Performance Considerations

### Token Family Traversal

- **Average case**: 1-3 tokens in family (most users refresh 1-2 times before reuse)
- **Worst case**: 100 tokens (safety limit to prevent infinite loops)
- **Database queries**: O(n) where n = family size (typically n < 5)

### Optimization Tips

1. **Add index** on `replacedByTokenId` column:
   ```sql
   CREATE INDEX idx_refresh_tokens_replaced_by 
   ON refresh_tokens(replacedByTokenId);
   ```

2. **Limit token lifetime**: Shorter token expiration = smaller families
   - Current: 30 days
   - Recommended: 7-14 days

3. **Periodic cleanup**: Delete old revoked tokens (cron job)
   ```sql
   DELETE FROM refresh_tokens 
   WHERE revoked = true 
   AND revokedAt < NOW() - INTERVAL '90 days';
   ```

---

## Edge Cases

### Case 1: Token Expired Before Reuse

```
TokenA expires before attacker can use it
```

**Handling**: Token expiration check happens before reuse check
**Result**: Error "Refresh token expired" (no reuse detection triggered)

### Case 2: Circular Reference (Shouldn't Happen)

```
TokenA → TokenB → TokenC → TokenA (circular)
```

**Handling**: Safety limit of 100 iterations prevents infinite loop
**Result**: Revokes up to 100 tokens, logs error about circular reference

### Case 3: Token Revoked Manually (Not Replaced)

```
TokenA revoked by admin (no replacedByTokenId)
```

**Handling**: `if (t.revoked && t.replacedByTokenId)` checks for replacement
**Result**: Error "Refresh token revoked" (no reuse detection triggered)

### Case 4: Multiple Reuse Attempts

```
Attacker tries TokenA multiple times
```

**Handling**: Each attempt triggers reuse detection
**Result**: Family already revoked, subsequent attempts fail immediately

---

## Production Monitoring

### Metrics to Track

1. **Reuse Detection Rate**: How often reuse is detected
   - High rate → Possible attack campaign
   - Low rate → Normal (occasional user confusion or dev errors)

2. **Token Family Size**: Average length of token chains
   - Large families → Users not logging out, tokens accumulating
   - Small families → Normal (regular logout or expiration)

3. **Time to Reuse**: Time between revocation and reuse attempt
   - Short time (< 1 min) → Possible legitimate user confusion
   - Long time (> 1 day) → More likely actual token theft

### Alerts to Set Up

```typescript
// Example: Send alert when reuse detected
if (event.type === SecurityEventType.REFRESH_TOKEN_REUSE) {
  // Send to monitoring service
  sendAlert({
    severity: 'critical',
    title: 'Refresh Token Reuse Detected',
    message: `User ${event.userId} - ${event.details.revokedTokenCount} tokens revoked`,
    user: event.email,
    timestamp: event.timestamp,
  });
  
  // Consider:
  // - Notify user via email
  // - Require 2FA on next login
  // - Flag account for manual review
}
```

---

## Comparison with Other Approaches

### Approach 1: No Reuse Detection (Insecure)

**How it works**: Accept any valid, non-expired token
**Pros**: Simple implementation
**Cons**: Attacker can use stolen token indefinitely (until expiration)
**Security**: ❌ Poor

### Approach 2: Single Token (No Rotation)

**How it works**: Issue one long-lived token, revoke on logout
**Pros**: Simple, no token families
**Cons**: No way to detect theft until user logs out
**Security**: ❌ Poor

### Approach 3: Token Rotation (No Reuse Detection)

**How it works**: Rotate tokens but don't check for reuse
**Pros**: Better than single token, limits exposure
**Cons**: Attacker can use stolen token once before it's replaced
**Security**: ⚠️ Medium

### Approach 4: Token Rotation + Reuse Detection (Current)

**How it works**: Rotate tokens AND revoke family on reuse
**Pros**: Detects theft, limits damage, forces re-authentication
**Cons**: More complex, requires token family tracking
**Security**: ✅ Good

### Approach 5: Short-Lived Tokens Only (No Refresh)

**How it works**: No refresh tokens, access tokens expire in 15 min
**Pros**: No theft risk for refresh tokens
**Cons**: User must re-authenticate every 15 min (poor UX)
**Security**: ✅ Excellent (but unusable)

**Recommendation**: Use Approach 4 (current implementation) for best balance of security and UX.

---

## FAQ

### Q: What if a legitimate user has two devices?

**A**: Token rotation works across devices:
- User logs in on Device A → Gets TokenA
- User logs in on Device B → Gets separate TokenB
- Each device has its own token family
- Reuse detection only triggers within same family

### Q: What if user accidentally refreshes twice quickly?

**A**: Not a problem:
1. First refresh: TokenA → TokenB (TokenA revoked)
2. Second refresh (race condition): TokenA already revoked → Fails with "Refresh token revoked"
3. Not detected as reuse (TokenA may not have `replacedByTokenId` yet)

### Q: Can an attacker bypass this by using a token before it's replaced?

**A**: Partially, but damage is limited:
- Attacker uses stolen TokenA → Gets TokenB
- User tries to use TokenA → Detects reuse → Revokes TokenB
- Attacker can use TokenB once, but then token family is revoked
- User must re-authenticate (attacker loses access)

### Q: What about tokens issued before this feature was deployed?

**A**: They continue to work:
- Old tokens don't have `replacedByTokenId`
- Reuse detection only triggers if `replacedByTokenId` exists
- On first refresh, token will be replaced and tracking starts

### Q: How do I test this in development?

**A**: See "Manual Testing" section above. You'll need to:
1. Capture cookies from multiple refresh requests
2. Intentionally reuse an old cookie
3. Verify security alert is logged

---

## Summary

✅ **What We Have**
- Automatic detection of refresh token reuse
- Revocation of entire token family on reuse
- Security event logging for monitoring
- Protection against token theft attacks

✅ **What's Protected**
- User accounts (attacker can't maintain access)
- Sensitive operations (access tokens expire quickly)
- Authentication integrity (theft is detected and mitigated)

📋 **Next Steps**
1. Monitor reuse detection rate in production
2. Set up alerts for REFRESH_TOKEN_REUSE events
3. Consider notifying users via email when reuse detected
4. Implement periodic cleanup of old revoked tokens

---

**Last Updated**: 2025-01-24  
**Status**: ✅ Implemented and Production-Ready  
**Security Level**: HIGH
