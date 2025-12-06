# Project Context & Status

## Project Overview
**Liffey Founders Club (v2)** is a full-stack web application connecting founders and investors, featuring Web3 integration for Ethereum and Avalanche blockchains.

- **Frontend**: SvelteKit, Tailwind CSS, Ethers.js
- **Backend**: NestJS, TypeORM, PostgreSQL, Redis
- **Web3 Testing**: Hardhat

## Recent Changes (December 6, 2025)

### 1. Hardhat Integration
- **Setup**: Initialized `hardhat/` directory with TypeScript configuration.
- **Configuration**: Added `hardhat.config.ts`, `tsconfig.json`, and `package.json` with necessary dependencies (`@nomicfoundation/hardhat-toolbox`, `ethers`, `chai`).
- **Testing**: Created `hardhat/test/web3-service.test.ts` to validate `Web3Service` functionality:
    - Chain discovery (Ethereum & Avalanche).
    - Address validation.
    - Wallet connection and balance retrieval.
    - **New**: Verified connection flow for randomly generated wallets (browser simulation).

### 2. Frontend Web3 Enhancements
- **Wallet Generation**: 
    - Moved wallet generation logic to a new component `GenerateWalletModal.svelte`.
    - Integrated `GenerateWalletModal` into the user profile page (`profile/+page.svelte`).
    - Users can now generate a wallet, download keys, and immediately connect from their profile.
    - **Fix**: Installed missing `ethers` dependency in frontend to resolve build errors.
- **State Management**:
    - Updated `src/lib/stores/walletStore.ts` with a new `adoptWallet` action.
    - This action bridges the generated wallet credentials with the backend session management.

### 3. Backend Stability & Testing
- **Unit Tests**:
    - Fixed `app.controller.spec.ts` by properly mocking the `DataSource` dependency.
    - Fixed `auth.service.spec.ts` by ensuring `JWT_SECRET` is set during the test lifecycle.
- **GCP Storage Service**:
    - Enhanced `GcpStorageService` with environment detection (dev vs production).
    - Added Application Default Credentials (ADC) support for production deployments.
    - Implemented comprehensive logging and error handling for file uploads/deletions.
    - Fixed profile photo upload to work correctly in both development and production.
- **Verification**: All backend unit tests and Hardhat integration tests are currently passing.

## Documentation
- **Actions Guide**: Created `.github/ACTIONS.md` as comprehensive reference for VS Code agent.
    - Contains common tasks, troubleshooting, deployment checklists, and architecture patterns.
    - Serves as single source of truth for development operations.

## Current Focus
- Ensuring robust Web3 integration.
- Maintaining test coverage across frontend, backend, and Web3 services.

## Next Steps
- Continue expanding Web3 features (e.g., smart contract interactions).
- Monitor deployment stability.
