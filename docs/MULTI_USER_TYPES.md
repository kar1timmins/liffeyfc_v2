# Multi-User Type System

## Overview

The backend now supports **three distinct user types**, each with their own database table and specific functionality:

1. **Users** (`users` table) - General users and founders
2. **Investors** (`investors` table) - Investors and accredited individuals
3. **Staff** (`staff` table) - Liffey Founders Club staff and administrators

## Database Schema

### 1. Users Table (`users`)

**Purpose**: General users, founders, and entrepreneurs

**Fields**:
- `id` (UUID, primary key)
- `email` (string, unique)
- `passwordHash` (string, nullable)
- `name` (string, nullable)
- `companyName` (string, nullable) - Founder's company
- `companyWebsite` (string, nullable)
- `industry` (string, nullable)
- `provider` (string, nullable) - OAuth provider ('google', 'siwe', null)
- `providerId` (string, nullable) - OAuth provider ID
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

**Relationships**:
- Has many `Wallet` (Web3 wallet addresses)
- Has many `RefreshToken` (authentication tokens)

**Permissions**:
- Submit pitch decks
- Attend events
- Connect Web3 wallets
- Access community features

---

### 2. Investors Table (`investors`)

**Purpose**: Investors, VCs, and accredited individuals

**Fields**:
- `id` (UUID, primary key)
- `email` (string, unique)
- `passwordHash` (string, nullable)
- `name` (string, nullable)
- `company` (string, nullable) - Investment firm name
- `investmentFocus` (string, nullable) - Investment thesis
- `linkedinUrl` (string, nullable)
- `isAccredited` (boolean, default: false)
- `provider` (string, nullable) - OAuth provider
- `providerId` (string, nullable) - OAuth provider ID
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

**Relationships**:
- Has many `Wallet` (Web3 wallet addresses)
- Has many `RefreshToken` (authentication tokens)

**Permissions**:
- View pitch decks
- Access investment opportunities
- Connect Web3 wallets
- Manage investment portfolio
- Review founder applications

---

### 3. Staff Table (`staff`)

**Purpose**: Liffey Founders Club staff, admins, and moderators

**Fields**:
- `id` (UUID, primary key)
- `email` (string, unique)
- `passwordHash` (string, required)
- `name` (string, required)
- `role` (string, default: 'staff') - 'admin' | 'staff' | 'moderator'
- `department` (string, nullable)
- `phoneNumber` (string, nullable)
- `isActive` (boolean, default: true)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

**Relationships**:
- Has many `RefreshToken` (authentication tokens)
- Note: Staff typically don't need Web3 wallets

**Permissions**:
- Manage events
- Review applications
- Access admin dashboard
- Manage content
- Moderate community

---

## Supporting Tables

### Wallets Table (`wallets`)

**Purpose**: Store Web3 wallet addresses

**Fields**:
- `id` (UUID, primary key)
- `address` (string, unique) - Ethereum address
- `chainId` (string, nullable) - Blockchain chain ID

**Relationships** (Polymorphic):
- Belongs to `User` (nullable)
- Belongs to `Investor` (nullable)
- Note: One of user or investor must be set

---

### RefreshTokens Table (`refresh_tokens`)

**Purpose**: Store refresh tokens for all user types

**Fields**:
- `id` (UUID, primary key)
- `tokenHash` (string) - Hashed token
- `expiresAt` (bigint) - Unix timestamp
- `userType` (string) - 'user' | 'investor' | 'staff'
- `revoked` (boolean, default: false)
- `revokedAt` (timestamp, nullable)
- `replacedByTokenId` (string, nullable)
- `createdAt` (timestamp)

**Relationships** (Polymorphic):
- Belongs to `User` (nullable)
- Belongs to `Investor` (nullable)
- Belongs to `Staff` (nullable)
- Note: One of user, investor, or staff must be set

---

## API Endpoints

### Users Endpoints (`/users`)

```typescript
POST   /users/register          // Register new user
GET    /users/:id               // Get user profile (protected)
```

### Investors Endpoints (`/investors`)

```typescript
POST   /investors/register      // Register new investor
GET    /investors/:id           // Get investor profile (protected)
```

### Staff Endpoints (`/staff`)

```typescript
POST   /staff                   // Create staff member (admin only)
GET    /staff                   // List all staff (admin only)
GET    /staff/:id               // Get staff member (admin only)
PATCH  /staff/:id/deactivate    // Deactivate staff member (admin only)
```

### Authentication Endpoints (`/auth`)

All authentication endpoints work with all three user types.

```typescript
POST   /auth/register           // Register (users)
POST   /auth/login              // Login (all types)
POST   /auth/refresh            // Refresh token (all types)
POST   /auth/logout             // Logout (all types)
GET    /auth/me                 // Get current user (all types)
GET    /auth/google             // Google OAuth (users/investors)
POST   /auth/siwe/verify        // SIWE login (users/investors)
```

---

## JWT Token Structure

JWT tokens now include the user type for proper authorization:

```typescript
{
  sub: "user-id-uuid",          // User ID
  userType: "user",             // "user" | "investor" | "staff"
  iat: 1234567890,              // Issued at
  exp: 1234567890               // Expires at
}
```

---

## Authentication Flow

### 1. Email/Password Registration

**For Users**:
```bash
POST /users/register
{
  "email": "founder@startup.com",
  "password": "SecurePass123!",
  "name": "John Founder",
  "companyName": "Startup Inc"
}
```

**For Investors**:
```bash
POST /investors/register
{
  "email": "investor@vc.com",
  "password": "SecurePass123!",
  "name": "Jane Investor",
  "company": "VC Fund",
  "isAccredited": true
}
```

**For Staff** (admin only):
```bash
POST /staff
{
  "email": "admin@liffeyfc.com",
  "password": "SecurePass123!",
  "name": "Admin User",
  "role": "admin"
}
```

### 2. Login (All Types)

```bash
POST /auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response:
{
  "success": true,
  "data": {
    "user": { ... },          // User/Investor/Staff object
    "accessToken": "...",     // JWT with userType
  }
}
```

The system automatically detects which table to query based on email.

### 3. Token Refresh (All Types)

```bash
POST /auth/refresh
Cookie: refreshToken=<token>

Response:
{
  "success": true,
  "data": {
    "accessToken": "...",     // New JWT
  }
}
```

---

## Database Migrations

To apply the new three-table structure:

```bash
# Generate migration
cd backend
pnpm run migration:generate -- src/migrations/add-investors-and-staff

# Run migration
pnpm run migration:run
```

---

## Service Architecture

### UsersService (`src/users/users.service.ts`)
- User CRUD operations
- Wallet management for users
- OAuth integration for users

### InvestorsService (`src/investors/investors.service.ts`)
- Investor CRUD operations
- Wallet management for investors
- OAuth integration for investors
- Accreditation status

### StaffService (`src/staff/staff.service.ts`)
- Staff CRUD operations
- Role management
- Activation/deactivation

### AuthService (`src/auth/auth.service.ts`)
- Unified authentication for all types
- Token generation with userType
- Refresh token rotation
- Security monitoring

---

## Authorization Guards

### Role-Based Access

Create custom guards for role-based access:

```typescript
// Example: Admin-only guard
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // From JWT
    return user?.userType === 'staff' && user?.role === 'admin';
  }
}

// Usage
@Post('admin/action')
@UseGuards(JwtAuthGuard, AdminGuard)
async adminAction() { ... }
```

### User Type Guards

```typescript
// Example: Investor-only guard
@Injectable()
export class InvestorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return request.user?.userType === 'investor';
  }
}
```

---

## Migration Strategy

### Option 1: Fresh Start (Development)

If you don't have production data:

1. Drop existing tables
2. Run new migrations
3. Test with new user types

### Option 2: Data Migration (Production)

If you have existing users:

```sql
-- Step 1: Backup existing data
CREATE TABLE users_backup AS SELECT * FROM users;

-- Step 2: Create new tables (via migration)
-- Step 3: Migrate existing users (categorize by email domain or manually)

-- Example: Move VC emails to investors
INSERT INTO investors (id, email, passwordHash, name, createdAt, updatedAt)
SELECT id, email, passwordHash, name, createdAt, updatedAt
FROM users
WHERE email LIKE '%@vc.com' OR email LIKE '%investor%';

-- Step 4: Move staff emails to staff
INSERT INTO staff (id, email, passwordHash, name, role, createdAt, updatedAt)
SELECT id, email, passwordHash, name, 'staff', createdAt, updatedAt
FROM users
WHERE email LIKE '%@liffeyfc.com';

-- Step 5: Keep remaining users in users table
-- Step 6: Update refresh_tokens with userType
-- Step 7: Update wallets with correct user/investor reference
```

---

## Security Considerations

1. **Password Requirements**: All user types must use strong passwords (12+ chars, complexity)
2. **Token Expiry**: Refresh tokens expire in 2 hours for all types
3. **Token Cleanup**: Automatic daily cleanup removes old tokens
4. **Input Validation**: All DTOs have comprehensive validation
5. **Role Separation**: Staff, investors, and users have distinct permissions

---

## Testing

### Test User Creation

```bash
# Create test user
curl -X POST http://localhost:3000/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"SecurePass123!","name":"Test User"}'

# Create test investor
curl -X POST http://localhost:3000/investors/register \
  -H "Content-Type: application/json" \
  -d '{"email":"investor@test.com","password":"SecurePass123!","name":"Test Investor","isAccredited":true}'

# Create test staff (requires authentication)
curl -X POST http://localhost:3000/staff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"email":"staff@test.com","password":"SecurePass123!","name":"Test Staff","role":"staff"}'
```

---

## Future Enhancements

1. **Admin Dashboard**: Staff-only dashboard for management
2. **Investor Portal**: Specialized view for investors
3. **Role Permissions**: Granular permissions per role
4. **Activity Logging**: Track actions by user type
5. **Analytics**: Separate analytics per user type
6. **Email Templates**: Customized emails per user type

---

## See Also

- [Security Progress](./SECURITY_PROGRESS.md)
- [Token Cleanup](./TOKEN_CLEANUP.md)
- [JWT Security](./JWT_SECURITY.md)
- [Refresh Token Reuse Detection](./REFRESH_TOKEN_REUSE_DETECTION.md)
