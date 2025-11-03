# Web3 Integration - Liffey Founders Club

Complete Web3 wallet integration with MetaMask support and planned Avalanche Core wallet integration.

## 🎯 Overview

This integration provides secure Web3 wallet connectivity for the Liffey Founders Club platform. Users can connect their crypto wallets (initially MetaMask, with Avalanche Core coming soon) to access blockchain features.

## 🏗️ Architecture

### Backend (NestJS)

**Location**: `/backend/src/web3/`

#### Modules:
- **Web3Module** - Main module registration
- **Web3Service** - Business logic for blockchain interactions
- **Web3Controller** - RESTful API endpoints

#### Features:
- ✅ Wallet address validation
- ✅ Multi-chain support (Ethereum, Avalanche)
- ✅ Balance fetching
- ✅ Signature verification
- ✅ Sign-in message generation

### Frontend (SvelteKit)

**Location**: `/frontend/src/lib/`

#### Components:
- **Web3Modal.svelte** - Wallet connection modal UI
- **walletStore.ts** - Svelte store for wallet state management
- **config.ts** - API and chain configuration

#### Features:
- ✅ MetaMask integration
- ✅ Reactive wallet state
- ✅ Chain switching
- ✅ Balance display
- ✅ Formatted address display
- 🔜 Avalanche Core wallet

## 📡 API Endpoints

### POST `/web3/connect`
Connect a wallet and validate the connection.

**Request Body:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "chainId": "0x1"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "chainId": "0x1",
    "chainName": "Ethereum Mainnet",
    "connectedAt": "2025-11-03T21:45:00.000Z"
  },
  "message": "Wallet connected successfully"
}
```

### GET `/web3/balance/:address`
Get the native token balance for an address.

**Query Params:**
- `chainId` - Chain ID (default: `0x1`)

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "balance": "1234567890000000000",
    "formattedBalance": "1.23456789",
    "chainId": "0x1"
  }
}
```

### GET `/web3/message/:address`
Generate a sign-in message for wallet authentication.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Welcome to Liffey Founders Club!\n\nSign this message to verify your wallet ownership.\n\nWallet: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\nTimestamp: 2025-11-03T21:45:00.000Z\nNonce: 123456\n\nThis request will not trigger a blockchain transaction or cost any gas fees."
  }
}
```

### POST `/web3/verify`
Verify a signed message.

**Request Body:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "message": "Sign-in message here",
  "signature": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "message": "Sign-in message here"
  },
  "message": "Signature verified successfully"
}
```

### GET `/web3/chains`
Get all supported blockchain networks.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "chainId": "0x1",
      "chainName": "Ethereum Mainnet",
      "nativeCurrency": {
        "name": "Ether",
        "symbol": "ETH",
        "decimals": 18
      },
      "rpcUrls": ["https://eth.llamarpc.com"],
      "blockExplorerUrls": ["https://etherscan.io"]
    }
  ]
}
```

### GET `/web3/chains/:chainId`
Get specific chain information.

### GET `/web3/validate/:address`
Validate if an address is a valid Ethereum address.

## 🌐 Supported Networks

| Network | Chain ID | Status |
|---------|----------|--------|
| Ethereum Mainnet | `0x1` | ✅ Active |
| Ethereum Sepolia | `0xaa36a7` | ✅ Active |
| Avalanche C-Chain | `0xa86a` | ✅ Active |
| Avalanche Fuji | `0xa869` | ✅ Active |

## 🎨 Frontend Usage

### Opening the Wallet Modal

```typescript
import { walletStore } from '$lib/stores/walletStore';

// Open modal programmatically
showWeb3Modal = true;

// Or use the FAB button (already integrated)
```

### Accessing Wallet State

```svelte
<script>
  import { walletStore, formattedAddress, isConnected } from '$lib/stores/walletStore';
</script>

{#if $isConnected}
  <p>Connected: {$formattedAddress}</p>
  <p>Balance: {$walletStore.balance}</p>
  <p>Network: {$walletStore.chainName}</p>
{:else}
  <button onclick={() => walletStore.connect()}>Connect Wallet</button>
{/if}
```

### Disconnecting

```typescript
walletStore.disconnect();
```

### Switching Chains

```typescript
await walletStore.switchChain('0xa86a'); // Switch to Avalanche
```

## 🔐 Security Features

1. **Address Validation**: All addresses are validated using ethers.js
2. **Checksum Format**: Addresses are converted to checksum format
3. **Signature Verification**: Backend verifies all signed messages
4. **CORS Protection**: Only allowed origins can access the API
5. **No Private Keys**: Never transmits or stores private keys
6. **Read-Only Operations**: Only reads from blockchain, no transactions yet

## 🚀 Next Steps (Planned)

### Phase 1: Authentication (Current)
- ✅ Wallet connection
- ✅ Address validation
- ✅ Balance fetching
- 🔜 Sign-in with wallet

### Phase 2: User Association
- 🔜 Link wallet to user account
- 🔜 Store wallet addresses in database
- 🔜 Session management with JWT
- 🔜 Multiple wallet support per user

### Phase 3: Avalanche Integration
- 🔜 Avalanche Core wallet support
- 🔜 AVAX-specific features
- 🔜 Subnet support
- 🔜 Cross-chain functionality

### Phase 4: Advanced Features
- 🔜 Smart contract interactions
- 🔜 Token gating (NFT membership)
- 🔜 On-chain verification
- 🔜 DAO voting integration

## 🛠️ Development

### Backend

```bash
cd backend
pnpm install
pnpm start:dev
```

Backend will run on `http://localhost:3000`

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Frontend will run on `http://localhost:5173`

### Environment Variables

**Frontend** (`.env`):
```env
VITE_API_URL=http://localhost:3000
```

## 📦 Dependencies

### Backend
- `ethers@^6.13.0` - Ethereum library
- `class-validator` - DTO validation
- `class-transformer` - Object transformation
- `@nestjs/config` - Configuration management

### Frontend
- `svelte@^5.0.0` - Svelte 5 with runes
- Native Web3 provider (window.ethereum)

## 🧪 Testing

### Testing Wallet Connection

1. Install MetaMask browser extension
2. Create/import a wallet
3. Visit the app and click "Connect" in the FAB menu
4. Approve the connection in MetaMask
5. See your address and balance displayed

### Testing Chain Switching

1. Connect wallet
2. In MetaMask, switch to different network
3. Page will reload with new network

### API Testing

Use the `/web3/chains` endpoint to test backend connectivity:

```bash
curl http://localhost:3000/web3/chains
```

## 📝 Code Examples

### Backend Service Usage

```typescript
import { Web3Service } from './web3/web3.service';

// In your service/controller
constructor(private readonly web3Service: Web3Service) {}

// Verify a signature
const verification = await this.web3Service.verifySignature({
  address: '0x...',
  message: 'Sign-in message',
  signature: '0x...'
});

if (verification.isValid) {
  // Proceed with authentication
}
```

### Frontend Store Usage

```typescript
import { walletStore } from '$lib/stores/walletStore';

// Connect
await walletStore.connect();

// Get balance
await walletStore.fetchBalance();

// Subscribe to changes
walletStore.subscribe(state => {
  console.log('Wallet state:', state);
});
```

## 🐛 Troubleshooting

### MetaMask Not Detected
- Ensure MetaMask extension is installed
- Check browser compatibility
- Reload the page

### Connection Fails
- Check backend is running on port 3000
- Verify CORS settings in `backend/src/main.ts`
- Check browser console for errors

### Balance Not Showing
- Ensure you're connected to the correct network
- Check you have tokens on that network
- RPC endpoint might be slow, wait a few seconds

## 📚 Resources

- [MetaMask Documentation](https://docs.metamask.io/)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [Avalanche Documentation](https://docs.avax.network/)
- [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193) - Ethereum Provider API

## 👥 Contributing

When adding Web3 features:
1. Update backend API endpoints in `/backend/src/web3/`
2. Update frontend store in `/frontend/src/lib/stores/walletStore.ts`
3. Update this README with new features
4. Test with multiple wallets and networks

---

**Note**: This is the initial implementation. Sign-in functionality and user association will be implemented in the next phase.
