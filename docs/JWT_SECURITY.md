# JWT Security Configuration

## Overview

This application uses JSON Web Tokens (JWT) for authentication with secure configuration enforcement.

## Security Features

### 1. **Required JWT Secret**
- `JWT_SECRET` environment variable is **required** at startup
- Application will **fail to start** if `JWT_SECRET` is not set or is insecure
- No development fallback secrets (removed for security)

### 2. **Secret Validation**
The application validates `JWT_SECRET` at startup:
- **Minimum length**: 32 characters (256 bits of entropy)
- **Weak secret detection**: Warns if secret appears weak (e.g., all lowercase, no special characters)
- **Cryptographically random**: Recommends using secure random generation

### 3. **Algorithm**
- Uses **HS256** (HMAC SHA-256) symmetric signing
- Suitable for most applications where tokens are verified by the same service that issues them
- For multi-service architectures requiring key rotation, consider RS256 (asymmetric keys)

## Setup

### Generate a Secure JWT Secret

Run this command to generate a cryptographically secure 64-character hex string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Example output:
```
7b2a989f48a96936b8a1dbc68060b5cc9601f692d417a7adbfe58614eb2a204b
```

### Configure Environment

Add to your `.env` file:

```bash
# REQUIRED: JWT secret for token signing (minimum 32 characters)
JWT_SECRET=your_generated_secret_here

# Token expiration (default: 15m)
JWT_EXPIRES_IN=15m
```

### Docker Compose

For Docker deployments, ensure the `.env` file is in the project root:

```yaml
# docker-compose.yml
services:
  backend:
    env_file:
      - .env
    environment:
      - JWT_SECRET=${JWT_SECRET}
```

## Startup Validation

On application startup, you'll see:

### ✅ Success
```
🔐 Validating security configuration...
✅ JWT_SECRET validated successfully
   Length: 64 characters (minimum: 32)
   Algorithm: HS256
```

### ❌ Failure (Missing Secret)
```
🔐 Validating security configuration...
❌ FATAL: Security validation failed. Application cannot start.

FATAL: JWT_SECRET environment variable is not set.
Please set a secure random secret (at least 32 bytes).
You can generate one using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### ⚠️ Warning (Weak Secret)
```
✅ JWT_SECRET validated successfully
   Length: 32 characters (minimum: 32)
   Algorithm: HS256
⚠️  WARNING: JWT_SECRET appears to be weak.
Consider using a cryptographically random secret.
Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Token Structure

### Access Token
- **Expiration**: 15 minutes (configurable via `JWT_EXPIRES_IN`)
- **Payload**: `{ sub: userId }`
- **Optional claims**: `issuer`, `audience` (for enhanced security)

### Refresh Token
- Stored as hashed value in database
- Format: `{uuid}.{secret}` where secret is bcrypt-hashed
- Expiration: 30 days
- Rotated on every refresh (transactional)

## Advanced Configuration

### Adding Issuer and Audience Claims

For additional security, you can add issuer and audience claims:

```typescript
// In auth.service.ts
const accessToken = signJwt(
  { sub: user.id },
  '15m',
  {
    issuer: 'liffey-founders-club',
    audience: 'liffey-app'
  }
);
```

Then verify with matching claims:

```typescript
// In jwt.strategy.ts
const payload = verifyJwt(token, {
  issuer: 'liffey-founders-club',
  audience: 'liffey-app'
});
```

### Key Rotation (Future Enhancement)

For RS256 (asymmetric) keys with rotation support:

1. Generate key pair:
```bash
# Private key
openssl genrsa -out private.pem 2048

# Public key
openssl rsa -in private.pem -pubout -out public.pem
```

2. Update configuration to support multiple keys with Key IDs (KID)
3. Implement key rotation strategy (e.g., generate new keys monthly)
4. Maintain public key registry for verification

## Production Checklist

- [ ] Generate cryptographically secure `JWT_SECRET` (>=32 chars)
- [ ] Store `JWT_SECRET` in secure secrets manager (AWS Secrets Manager, Azure Key Vault, etc.)
- [ ] Never commit `.env` file with real secrets to version control
- [ ] Use different `JWT_SECRET` for each environment (dev, staging, production)
- [ ] Rotate `JWT_SECRET` periodically (every 90 days recommended)
- [ ] Monitor failed JWT verification attempts
- [ ] Set appropriate CORS origins for production
- [ ] Configure short access token expiration (15 minutes recommended)

## Security Best Practices

### ✅ Do
- Use cryptographically random secrets
- Store secrets in environment variables or secrets managers
- Use short-lived access tokens (15 minutes or less)
- Rotate refresh tokens on use
- Validate token claims (issuer, audience)
- Log failed authentication attempts

### ❌ Don't
- Use weak or predictable secrets (e.g., "secret123")
- Commit secrets to version control
- Use long-lived access tokens (>1 hour)
- Store JWT secrets in code
- Reuse the same secret across environments
- Ignore validation warnings

## Troubleshooting

### Error: JWT_SECRET not set
**Solution**: Add `JWT_SECRET` to your `.env` file with a secure random value

### Error: JWT_SECRET too short
**Solution**: Generate a longer secret (minimum 32 characters)

### Warning: JWT_SECRET appears weak
**Solution**: Use a cryptographically random secret from the generation command

### Token verification fails
**Causes**:
- Token expired (access tokens expire after 15 minutes)
- Invalid signature (wrong secret)
- Token tampered with
- Mismatched issuer/audience claims

**Solution**: Check token expiration, ensure correct `JWT_SECRET` is set

## Related Files

- `src/config/jwt.config.ts` - JWT configuration and validation
- `src/auth/jwt.util.ts` - JWT signing and verification utilities
- `src/auth/jwt.strategy.ts` - Passport JWT strategy
- `src/main.ts` - Startup validation
- `.env` - Environment configuration (not committed)
- `.env.example` - Example configuration (safe to commit)

## References

- [RFC 7519: JSON Web Token (JWT)](https://tools.ietf.org/html/rfc7519)
- [OWASP JWT Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
