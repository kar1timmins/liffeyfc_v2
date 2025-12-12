# HD Wallet Generation System

## Overview

The Liffey Founders Club platform implements a hierarchical deterministic (HD) wallet system that allows users to generate a master wallet and derive child wallets for their companies. This maintains a clear relationship between user wallets and company wallets while ensuring security and recoverability.

## Architecture

### Database Schema

#### `user_wallets` Table
- Stores the master HD wallet for each user
- **One wallet per user** (enforced by unique constraint on `userId`)
- Encrypted mnemonic phrase and private key
- Tracks `nextChildIndex` for deriving company wallets

#### `company_wallets` Table
- Stores derived child wallets for companies
- Each company wallet is derived from the user's master wallet
- Maintains `parentWalletId` foreign key to link to master wallet
- Stores derivation path and child index

### Security Features

1. **AES-256-GCM Encryption**
   - All private keys and mnemonic phrases are encrypted at rest
   - Uses `WALLET_ENCRYPTION_KEY` environment variable (32 bytes, 64 hex chars)
   - Each encryption includes unique IV and authentication tag

2. **One-Time Display**
   - Mnemonic and private key shown only once during generation
   - User must download wallet file immediately
   - Cannot be retrieved later from database (encrypted)

3. **Hierarchical Derivation**
   - Uses BIP-44 derivation path: `m/44'/60'/0'/0/{index}`
   - Master wallet at index 0
   - Company wallets at indices 1, 2, 3, etc.
   - Same addresses work for both Ethereum and Avalanche (EVM compatible)

## API Endpoints

### Generate Master Wallet
```
POST /wallet/generate
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "success": true,
  "message": "Master wallet generated successfully...",
  "data": {
    "address": "0x...",
    "ethAddress": "0x...",
    "avaxAddress": "0x...",
    "mnemonic": "word1 word2 ... word12",
    "privateKey": "0x...",
    "derivationPath": "m/44'/60'/0'/0/0",
    "warning": "CRITICAL: Store this information securely...",
    "createdAt": "2025-12-06T..."
  }
}
```

### Check if User Has Wallet
```
GET /wallet/check
Authorization: Bearer {jwt_token}
```

### Get Wallet Addresses
```
GET /wallet/addresses
Authorization: Bearer {jwt_token}
```

### Generate Company Wallet
```
POST /wallet/company/:companyId
Authorization: Bearer {jwt_token}
```

Auto-generates when creating a company if user has a master wallet.

### Get All Company Wallets
```
GET /wallet/companies
Authorization: Bearer {jwt_token}
```

## User Flow

### 1. Generate Master Wallet

1. User navigates to Profile → Web3 Wallet section
2. Clicks "Generate New Wallet" button
3. Reviews security warnings and acknowledges
4. System generates:
   - Random 12-word mnemonic phrase
   - Master private key
   - ETH and AVAX addresses
5. User **must download** wallet file containing:
   - Mnemonic phrase
   - Private key
   - Addresses
   - Security warnings
6. Modal displays mnemonic in grid format with copy button
7. User confirms download before closing

### 2. Create Company with Wallet

1. User creates a new company via CompanyManager form
2. System automatically checks if user has master wallet
3. If yes, derives child wallet:
   - Gets next available index
   - Derives child wallet using mnemonic
   - Encrypts and stores private key
   - Updates company with addresses
4. Company wallet addresses visible on company detail page

### 3. Receive Funds

- Company wallet addresses displayed publicly on `/companies/{id}`
- Anyone can copy addresses to send funds
- Authenticated users can send via MetaMask integration

## Setup Instructions

### Backend Configuration

1. Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. Add to `.env`:
```env
WALLET_ENCRYPTION_KEY=<64-character-hex-key>
```

3. Run migrations:
```bash
cd backend
pnpm run migration:run
```

### Frontend Integration

The `GenerateWalletModal.svelte` component is already integrated into the Profile page. No additional setup required.

## Security Considerations

### ⚠️ Critical Security Points

1. **Encryption Key Management**
   - Store `WALLET_ENCRYPTION_KEY` securely (environment variable, secrets manager)
   - Never commit to version control
   - Rotate periodically in production
   - Loss of this key means loss of all wallet access

2. **User Responsibilities**
   - Users must download and securely store wallet files
   - Mnemonic phrase is recovery mechanism
   - Loss of mnemonic = permanent loss of funds
   - Platform cannot recover wallets

3. **Database Security**
   - Encrypt database at rest
   - Use SSL/TLS for connections
   - Implement proper access controls
   - Regular security audits

4. **Best Practices**
   - Consider hardware wallet integration for high-value accounts
   - Implement multi-sig for company wallets (future enhancement)
   - Monitor for suspicious wallet activity
   - Implement rate limiting on wallet operations

## Future Enhancements

1. **Multi-Signature Wallets**
   - Require multiple approvals for company transactions
   - Protect against unauthorized access

2. **Hardware Wallet Integration**
   - Support Ledger/Trezor for master wallets
   - Enhanced security for high-value accounts

3. **Transaction History**
   - Track incoming/outgoing transactions
   - Display balance and transaction logs

4. **Wallet Recovery**
   - Implement social recovery mechanisms
   - Time-locked recovery procedures

5. **Additional Chains**
   - Support more blockchains (Polygon, BSC, etc.)
   - Chain-specific derivation paths

## Testing

### Local Testing

1. Generate test wallet in development environment
2. Use test networks (Goerli, Fuji testnet)
3. Verify wallet derivation chain
4. Test encryption/decryption cycles

### Security Testing

- Test encryption key rotation
- Verify one-time mnemonic display
- Test wallet generation limits (one per user)
- Verify child wallet derivation

## Troubleshooting

### Error: "WALLET_ENCRYPTION_KEY must be set"
- Ensure environment variable is configured
- Verify 64 hex characters (32 bytes)

### Error: "User already has a master wallet"
- Each user limited to one master wallet
- Check existing wallet with `GET /wallet/check`

### Error: "User does not have a master wallet"
- User must generate master wallet before creating companies
- Direct to wallet generation flow

## Support

For security issues, contact security@liffeyfoundersclub.com
For general support, create a GitHub issue
