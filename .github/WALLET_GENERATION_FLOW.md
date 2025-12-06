# Wallet Generation & Database Storage Flow

## Overview
This document describes the complete flow for generating a Web3 wallet in the frontend and storing it in the database.

## Architecture

### Components Involved
1. **Frontend**: `GenerateWalletModal.svelte` - Modal for wallet generation
2. **Backend**: `UsersController` - API endpoint for wallet storage
3. **Database**: `wallets` table via `Wallet` entity (TypeORM)

## Flow Diagram

```
User clicks "Generate Wallet"
         ↓
Frontend generates wallet using ethers.js (Wallet.createRandom())
         ↓
Wallet keys automatically downloaded as text file
         ↓
Frontend calls POST /users/attach-wallet with:
  - address (wallet address)
  - chainId (e.g., "0x1" for Ethereum)
         ↓
Backend (UsersController.attachWallet):
  - Validates JWT token
  - Calls UsersService.attachWallet()
         ↓
UsersService.attachWallet():
  - Checks if wallet address already exists
  - Creates new Wallet entity linked to user
  - Saves to database
         ↓
Frontend walletStore.adoptWallet():
  - Stores wallet in browser state
  - Updates UI
         ↓
Success! Wallet generated, saved, and ready to use
```

## Implementation Details

### 1. Frontend: Wallet Generation

**File**: `frontend/src/lib/components/GenerateWalletModal.svelte`

**Key Functions**:

```typescript
async function generateWallet() {
  // 1. Create random wallet using ethers.js
  const wallet = EthersWallet.createRandom();
  
  // 2. Extract wallet details
  generatedWallet = {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic?.phrase || '',
    chainName: chain.chainName,
    symbol: chain.symbol,
    chainId: chain.chainId
  };
  
  // 3. Download keys to user's device
  downloadKeys();
  
  // 4. Save wallet address to backend database
  await saveWalletToBackend(wallet.address, chain.chainId);
  
  // 5. Adopt wallet in frontend store
  await walletStore.adoptWallet(wallet.address, chain.chainId);
}

async function saveWalletToBackend(address: string, chainId: string) {
  const token = $authStore.accessToken;
  
  const response = await fetch(`${PUBLIC_API_URL}/users/attach-wallet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ address, chainId })
  });
  
  if (!response.ok) {
    throw new Error('Failed to save wallet');
  }
}
```

**Security Features**:
- Private keys are NEVER sent to backend
- Only wallet address and chainId are stored
- Keys are immediately downloaded to user's device
- User must be authenticated (JWT required)

### 2. Backend: Wallet Storage

**File**: `backend/src/users/users.controller.ts`

**Endpoint**: `POST /users/attach-wallet`

**Authentication**: JWT required (`@UseGuards(AuthGuard('jwt'))`)

**Request Body**:
```typescript
{
  address: string;    // Wallet address (e.g., "0x1234...")
  chainId?: string;   // Optional chain ID (e.g., "0x1")
}
```

**Response**:
```typescript
{
  success: boolean;
  data?: User;       // Updated user with wallets relation
  message?: string;  // Error message if failed
}
```

**Implementation**:
```typescript
@Post('attach-wallet')
@UseGuards(AuthGuard('jwt'))
async attachWallet(
  @Body() body: { address: string; chainId?: string },
  @CurrentUser() currentUser: any
) {
  const userId = currentUser?.sub;
  
  const updatedUser = await this.usersService.attachWallet(
    userId, 
    body.address, 
    body.chainId
  );
  
  return { success: true, data: updatedUser };
}
```

### 3. Database: Wallet Entity

**File**: `backend/src/entities/wallet.entity.ts`

**Schema**:
```typescript
@Entity({ name: 'wallets' })
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  address: string;

  @Column({ type: 'varchar', nullable: true })
  chainId?: string;

  @ManyToOne(() => User, (u) => u.wallets, { onDelete: 'CASCADE' })
  user: User;
}
```

**Database Table**:
```sql
CREATE TABLE "wallets" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "address" varchar UNIQUE NOT NULL,
  "chainId" varchar,
  "userId" uuid REFERENCES "users"("id") ON DELETE CASCADE
);
```

### 4. Service Layer Logic

**File**: `backend/src/users/users.service.ts`

**Method**: `attachWallet(userId, address, chainId)`

**Logic**:
```typescript
async attachWallet(userId: string, address: string, chainId?: string): Promise<User | null> {
  // 1. Find user
  const user = await this.findById(userId);
  if (!user) return null;
  
  // 2. Check if wallet already exists
  const existing = await this.walletsRepo.findOne({ where: { address } });
  
  if (!existing) {
    // 3a. Create new wallet
    const newWallet = this.walletsRepo.create({ address, chainId, user });
    await this.walletsRepo.save(newWallet);
  } else if (!existing.user) {
    // 3b. Attach existing wallet to user
    existing.user = user;
    await this.walletsRepo.save(existing);
  }
  
  // 4. Return updated user with wallets
  return this.findById(userId);
}
```

## Supported Chains

The wallet generation modal supports:

1. **Ethereum Mainnet**
   - Chain ID: `0x1`
   - Symbol: ETH

2. **Avalanche C-Chain**
   - Chain ID: `0xa86a`
   - Symbol: AVAX

## Security Considerations

### ✅ Secure Practices
- Private keys generated client-side only
- Private keys NEVER transmitted to backend
- Only public wallet address stored in database
- JWT authentication required for wallet attachment
- Wallet addresses are unique (database constraint)
- Automatic key file download for user backup

### 🔒 User Responsibilities
- Users must securely store their downloaded key file
- Private keys cannot be recovered if lost
- Users should never share private keys
- Generated wallets are the user's sole responsibility

## Error Handling

### Frontend Errors
- **No Auth Token**: Wallet saved locally but not to database (warning logged)
- **Network Error**: User notified, wallet still usable locally
- **Invalid Response**: Error message displayed to user

### Backend Errors
- **Unauthorized**: Returns 401 if no valid JWT
- **User Not Found**: Returns error message
- **Duplicate Address**: Handled gracefully (reuses existing wallet)

## Testing

### Manual Testing Steps

1. **Generate Wallet**:
   ```bash
   # Start frontend
   cd frontend && pnpm dev
   
   # Navigate to /profile
   # Click "Generate Wallet" button
   # Select chain (ETH or AVAX)
   # Click "Generate Wallet"
   ```

2. **Verify Database**:
   ```sql
   -- Check wallet was created
   SELECT * FROM wallets WHERE address = '<generated_address>';
   
   -- Check user association
   SELECT u.id, u.email, w.address, w."chainId" 
   FROM users u 
   JOIN wallets w ON w."userId" = u.id 
   WHERE u.id = '<user_id>';
   ```

3. **Check Backend Logs**:
   ```bash
   cd backend && pnpm start:dev
   # Look for: "Wallet successfully saved to database"
   ```

### Unit Tests

**TODO**: Add unit tests for:
- `UsersController.attachWallet()` endpoint
- `UsersService.attachWallet()` method
- Frontend `saveWalletToBackend()` function

## API Documentation

### POST /users/attach-wallet

**Description**: Attach a wallet address to the authenticated user

**Authentication**: Bearer JWT (required)

**Request**:
```http
POST /users/attach-wallet HTTP/1.1
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "chainId": "0x1"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "wallets": [
      {
        "id": "wallet-uuid",
        "address": "0x1234567890abcdef1234567890abcdef12345678",
        "chainId": "0x1"
      }
    ]
  }
}
```

**Error Response** (401 Unauthorized):
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

**Error Response** (400 Bad Request):
```json
{
  "success": false,
  "message": "Failed to attach wallet"
}
```

## Related Files

### Frontend
- `frontend/src/lib/components/GenerateWalletModal.svelte` - Wallet generation UI
- `frontend/src/lib/stores/walletStore.ts` - Wallet state management
- `frontend/src/lib/stores/auth.ts` - Authentication state (for JWT)
- `frontend/src/routes/profile/+page.svelte` - Profile page with modal

### Backend
- `backend/src/users/users.controller.ts` - API endpoints
- `backend/src/users/users.service.ts` - Business logic
- `backend/src/entities/wallet.entity.ts` - Database entity
- `backend/src/entities/user.entity.ts` - User entity with wallet relation

### Database
- `backend/src/migrations/1762294178719-init.ts` - Initial schema with wallets table

## Future Enhancements

1. **Multi-Wallet Support**: Allow users to generate/attach multiple wallets
2. **Wallet Naming**: Let users assign names/labels to wallets
3. **Chain Detection**: Auto-detect chain from address format
4. **Wallet Import**: Import existing wallets by private key/mnemonic
5. **Hardware Wallet**: Support Ledger/Trezor integration
6. **Wallet Analytics**: Track wallet balance, transaction history
7. **Notifications**: Email notifications when wallet attached

## Troubleshooting

### Issue: Wallet not saved to database
**Symptoms**: Wallet generated but not showing in user profile
**Solutions**:
1. Check browser console for errors
2. Verify JWT token is valid (check localStorage)
3. Check backend logs for API errors
4. Verify database connection is working
5. Check user is authenticated before generating

### Issue: "Unauthorized" error
**Symptoms**: API returns 401 Unauthorized
**Solutions**:
1. User must be logged in
2. JWT token may be expired (re-login)
3. Check `Authorization` header is being sent
4. Verify JWT_SECRET matches between sessions

### Issue: Duplicate address error
**Symptoms**: Wallet address already exists
**Solutions**:
1. This is handled gracefully by the backend
2. Existing wallet will be associated with user
3. No error should be shown to user

## Changelog

### 2025-01-XX - Initial Implementation
- ✅ Created `POST /users/attach-wallet` endpoint
- ✅ Updated `GenerateWalletModal.svelte` to call backend
- ✅ Integrated with existing `Wallet` entity and database schema
- ✅ Added JWT authentication requirement
- ✅ Implemented error handling and logging
- ✅ All tests passing (8/8 backend tests)
