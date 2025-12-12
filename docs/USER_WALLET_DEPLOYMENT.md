# User-Generated Keys for Smart Contract Deployment

## Overview

The contract deployment system has been updated to use **user-generated wallet keys** stored in the database instead of a single environment variable. This improves security and allows each user to deploy contracts using their own wallet.

## How It Works

### Before
- A single `WEB3_PRIVATE_KEY` environment variable was used to deploy all contracts
- All contracts were deployed from the same wallet
- Security risk: Private key exposed as environment variable

### After
- Each user has their own encrypted wallet stored in the database (`UserWallet` entity)
- Users can generate wallets through the app (or via wallet generation service)
- Contract deployments use the user's own private key
- Private keys remain encrypted at rest - only decrypted when needed for signing
- No private keys in environment variables

## Architecture

### Database Entities

**UserWallet Entity** (`user_wallets` table):
- `encryptedPrivateKey`: User's private key, encrypted with AES-256-GCM
- `encryptedMnemonic`: User's mnemonic phrase, encrypted
- `ethAddress`: Ethereum address derived from the wallet
- `avaxAddress`: Avalanche address derived from the wallet
- `userId`: Links wallet to user

**CompanyWallet Entity** (`company_wallets` table):
- Child wallets derived from user's master wallet
- Each company can have its own wallet derived from user's master
- `encryptedPrivateKey`: Company wallet's private key, encrypted
- `parentWalletId`: Links to the user's master wallet

### Key Methods

**`getUserPrivateKey(userId, chain)`**
- Fetches user's wallet from database
- Decrypts the private key using `WALLET_ENCRYPTION_KEY`
- Returns decrypted private key
- Throws error if wallet not found

**`createUserSigner(userId, chain)`**
- Gets user's private key
- Creates ethers.Wallet instance with the private key
- Connects signer to appropriate provider (Ethereum or Avalanche)
- Returns ready-to-use signer for contract interactions

**`deployEscrowContracts(userId, ...)`**
- Takes `userId` as first parameter
- Creates signer from user's wallet
- Deploys contracts signed by user's wallet
- Logs which wallet address was used

### Controller Integration

**EscrowController.createEscrow()**
```typescript
// Before
const result = await this.escrowService.deployEscrowContracts(
  wishlistItemId,
  walletAddress,
  targetAmountEth,
  durationInDays
);

// After
const result = await this.escrowService.deployEscrowContracts(
  user.sub,  // Pass userId from JWT token
  wishlistItemId,
  walletAddress,
  targetAmountEth,
  durationInDays
);
```

## Security Improvements

### Encryption at Rest
- Private keys stored encrypted in database with AES-256-GCM
- Uses 64-character hex key (`WALLET_ENCRYPTION_KEY`) from environment
- Only decrypted when deploying contracts (not loaded at startup)

### No Environment Exposure
- `WEB3_PRIVATE_KEY` environment variable no longer used
- Each user's key stored separately in database
- Compromised user key doesn't expose other users' keys

### User Isolation
- Each user can only deploy contracts using their own wallet
- Controlled by ownership verification in controller:
  ```typescript
  // Verify user owns the company
  if (company.ownerId !== user.sub) {
    throw new BadRequestException('You do not have permission...');
  }
  ```

### Key Rotation Capability
- Future support for rotating user keys without app restart
- Different users can have different deployment keys
- Audit trail possible (timestamp when wallet was created/used)

## Required Configuration

### Environment Variables
```bash
# Required - encryption key for wallet storage
WALLET_ENCRYPTION_KEY=88478f11364a7758ef2d6069a7dcdbabf4232f6b395786c50d82a4d3086c3274  # Must be 64 hex chars

# Optional - still supported for backward compatibility
WEB3_PRIVATE_KEY=  # No longer used for deployments
```

### Database
- Must have `user_wallets` table (already exists)
- Users must generate wallets before deploying contracts

## User Workflow

1. **User creates account** → Account created
2. **User generates wallet** → Wallet stored encrypted in `user_wallets` table
3. **User creates company** → Company linked to user
4. **User adds wishlist item** → Wishlist item created
5. **User deploys escrow contract** → Deployment uses user's wallet
   - Service fetches user's encrypted key
   - Decrypts using `WALLET_ENCRYPTION_KEY`
   - Creates signer from private key
   - Deploys contract
   - Private key is discarded from memory after use

## Error Handling

```typescript
// If user doesn't have a wallet generated
throw new BadRequestException(
  'User wallet not found. Please generate a wallet first.'
);

// If encryption key not configured
throw new Error(
  'WALLET_ENCRYPTION_KEY must be set and be 64 hex characters'
);

// If wallet decryption fails
throw new BadRequestException(
  'Failed to decrypt wallet. Please try again.'
);
```

## Backward Compatibility

### Migration Path (If Needed)
If you have existing wallets or keys:

1. Generate wallets for each user via wallet generation API
2. Encrypted keys are stored in `user_wallets` table
3. Contract deployments automatically use user's key

### Environment Variables
- `WEB3_PRIVATE_KEY` is no longer read during deployment
- If it exists in `.env`, it's safely ignored
- Can be removed from `.env` for cleaner configuration

## Testing

### Deploy a Contract
```bash
POST /escrow/create
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "wishlistItemId": "uuid",
  "targetAmountEth": 2.5,
  "durationInDays": 30,
  "chains": ["ethereum"]
}
```

### Check Logs
```bash
docker-compose logs backend | grep -i "wallet\|escrow\|deploy"

# Expected output:
# 🔑 Using wallet: 0x1234...abcd for Ethereum deployment
# ✅ Ethereum escrow deployed: 0xdef0...5678
```

## Future Enhancements

- [ ] Support multiple wallets per user
- [ ] Wallet import (users bring their own private key)
- [ ] Wallet rotation without re-key all contracts
- [ ] Delegation (user grants another user permission to deploy using their wallet)
- [ ] Hardware wallet support (signing requests to external wallet)
- [ ] Audit log of contract deployments per wallet

## Related Documentation

- [Wallet Generation System](../docs/WALLET_GENERATION_SYSTEM.md)
- [RPC Configuration Guide](../docs/RPC_CONFIGURATION_GUIDE.md)
- [Backend README](../backend/README.md) - Full backend setup

## Questions?

- How to generate wallets for users? → See Wallet Generation API docs
- How are keys encrypted? → AES-256-GCM with `WALLET_ENCRYPTION_KEY`
- Can I use a company wallet instead? → No, only user's master wallet for now
- What if the key is compromised? → Rotate it or create a new user wallet

