---
applyTo: '**'
---
# Liffey Founders Club - Project Instructions

> **NOTE**: This file provides high-level Copilot context. Detailed setup, configuration, and feature documentation should be maintained in the respective README.md files:
> - Root project overview: `/README.md` (to be created)
> - Frontend specifics: `/frontend/README.md`
> - Backend specifics: `/backend/README.md`
> - Email service: `/email-server/README.md`

## 1. Project Overview

**Project Name**: Liffey Founders Club  
**Type**: Full-Stack Web Application  
**Purpose**: Platform for connecting founders, managing events, and facilitating Web3-enabled features  
**Environment**: VS Code, GitHub Copilot, Docker

### Project Goals
- Build a fast, responsive, and secure web platform for the Liffey Founders Club community
- Enable Web3 functionality for Ethereum and Avalanche blockchain integration
- Maintain clean, maintainable, and well-documented code
- Support containerized deployment with Docker

## 2. Architecture

### Monorepo Structure
```
liffeyfc_v2/
├── frontend/          # SvelteKit static site
├── backend/           # NestJS API server
├── email-server/      # Node.js email service (Railway)
├── hardhat/           # Hardhat smart contracts (Ethereum/Avalanche)
├── docker-compose.yml # Local development orchestration
└── deploy.sh          # Deployment script
```

### Technology Stack

#### Frontend (`/frontend/`)
- **Framework**: SvelteKit 2 (using Svelte 5 with runes)
- **Adapter**: `@sveltejs/adapter-static` (static site generation)
- **Styling**: Tailwind CSS v4 (utility-first)
- **Build Tool**: Vite 7
- **Language**: TypeScript (ES2020+)
- **Web3**: Lightweight custom implementation (`src/lib/web3/web3.ts`)
- **Package Manager**: pnpm

#### Backend (`/backend/`)
- **Framework**: NestJS 11
- **Runtime**: Node.js with TypeScript
- **Architecture**: Modular (Controllers, Services, Modules)
- **Validation**: class-validator decorators for DTO validation (NestJS ValidationPipe)
- **Features**: 
  - Contact form handling with reCAPTCHA validation
  - Company management with wishlist system
  - Bounties system for crowdfunding wishlist items
  - Web3 signature verification and nonce management
  - File upload with GCP Cloud Storage integration
- **Package Manager**: pnpm

#### Smart Contracts (`/hardhat/`)
- **Framework**: Hardhat with TypeScript
- **Language**: Solidity 0.8.x
- **Contracts**:
  - `CompanyWishlistEscrow.sol`: Time-bound escrow with proportional gas fee distribution
  - `EscrowFactory.sol`: Factory pattern for deploying escrow instances
- **Networks**: Ethereum Sepolia (testnet), Avalanche Fuji (testnet)
- **Features**:
  - Multi-contributor crowdfunding
  - Time-bound campaigns with refund mechanism
  - Fair gas fee distribution on failed campaigns (0.1% split proportionally)
  - Milestone-based fund release (planned)
- **TypeChain**: Auto-generated TypeScript types for contracts

#### Email Service (`/email-server/`)
- **Runtime**: Node.js (Express)
- **SMTP**: Zoho Mail integration
- **Deployment**: Railway
- **Purpose**: Automated welcome emails for new registrations

#### Database & Persistence
- **ORM**: TypeORM 0.3.x with Postgres (pg driver)
- **Database**: PostgreSQL 15 (Alpine image for docker-compose)
- **Migrations**: TypeORM CLI (`pnpm run migration:*` scripts in backend)
- **Cache/Store**: Redis 7 (Alpine image) for nonce storage & multi-instance deployments
- **Config**: `.env` file controls `DATABASE_URL`, `POSTGRES_*` vars, `REDIS_URL`, and `TYPEORM_SYNCHRONIZE`
- **Key Entities**:
  - `User`: User accounts with role-based access (user, investor, staff)
  - `Wallet`: Web3 wallet addresses linked to users
  - `RefreshToken`: JWT refresh tokens with rotation and revocation
  - `Company`: Business profiles with owner relationships
  - `WishlistItem`: Company wishlists with escrow integration
  - `Bounty`: Crowdfunding campaigns linked to wishlist items

#### Authentication & Authorization
- **Strategy**: JWT + Passport.js (passport-jwt strategy)
- **Methods**:
  - SIWE (Sign In with Ethereum): Web3 wallet signature verification
  - Email/Password: Traditional registration & login with bcryptjs hashing
  - Refresh Tokens: Hashed DB-backed tokens with rotation & revocation
- **Entities**: User, Wallet, RefreshToken (TypeORM entities in `backend/src/entities/`)
- **Guards**: Passport `AuthGuard('jwt')` protects routes; `CurrentUser` decorator extracts JWT payload

#### Nonce Management (SIWE)
- **Implementation**: Redis-backed `NonceService` with atomic consume (Lua GET+DEL)
- **Location**: `backend/src/web3/nonce.redis.service.ts`
- **Fallback**: In-memory `NonceService` if `REDIS_URL` not set (for single-instance dev)
- **Rationale**: Prevents replay attacks in multi-instance deployments; atomic consume ensures no race conditions

## 3. Coding Guidelines

### Frontend (SvelteKit)

#### Component Structure
- **Naming**: Use PascalCase for component files (e.g., `DashboardLayout.svelte`)
- **Routes**: SvelteKit file-based routing in `/src/routes/`
- **Runes**: Use Svelte 5 runes (`$state`, `$derived`, `$effect`) for reactivity
- **TypeScript**: Type all component props and functions

#### Styling
- **Primary**: Tailwind CSS utility classes
- **Location**: Global styles in `app.css`
- **Responsive**: Mobile-first approach
- **Accessibility**: Include ARIA attributes for interactive elements

#### State Management
- **Browser APIs**: Use `window.ethereum` for Web3 wallet interactions
- **Stores**: Use Svelte stores (`$state`) for reactive state
- **Avoid**: External state management libraries (no Redux, Zustand, etc.)

#### API Integration
- **Method**: Use native `fetch` API for backend communication
- **Environment**: Access via `$env/static/public` for public vars
- **Validation**: Client-side validation before submission

### Backend (NestJS)

#### Module Structure
- **Naming**: Use kebab-case for folders (e.g., `contact/`)
- **Files**: Follow NestJS conventions (`.controller.ts`, `.service.ts`, `.module.ts`)
- **Decorators**: Use NestJS decorators (`@Controller`, `@Get`, `@Post`, etc.)
- **Dependency Injection**: Constructor-based injection

#### Database & ORM
- **Location**: TypeORM configuration in `app.module.ts`
- **Entities**: Define in `src/entities/` (User, Wallet, RefreshToken, etc.)
- **Repositories**: Use TypeORM repository pattern or inject via `@InjectRepository()`
- **Migrations**:
  - Generate: `pnpm run migration:generate -- src/migrations/my-migration-name`
  - Run: `pnpm run migration:run`
  - Revert: `pnpm run migration:revert`
- **Configuration**:
  - **Development**: `TYPEORM_SYNCHRONIZE=true` (auto-sync schema from entities)
  - **Production**: `TYPEORM_SYNCHRONIZE=false` (run migrations during deployment)
  - **Priority**: Parses `DATABASE_URL` first; falls back to `DB_HOST`, `DB_PORT`, etc.

#### Authentication & Services
- **Auth Module**: Handles SIWE, email/password, JWT, and refresh tokens
- **Users Module**: User registration, profile, wallet management
- **Web3 Module**: Signature verification, nonce management, chain information
- **Companies Module**: Company CRUD, wishlist management, owner verification
- **Bounties Module**: Crowdfunding campaigns with smart contract integration
- **JWT Strategy**: Configured in `auth/jwt.strategy.ts`; use `@UseGuards(AuthGuard('jwt'))` or global guard

#### API Design
- **REST**: Follow RESTful conventions
- **Validation**: Use NestJS validation pipes and `class-validator`
- **DTO Decorators**: All DTOs must use class-validator decorators for properties
  - `@IsString()` - Validates string types
  - `@IsNumber()` - Validates numeric types
  - `@IsBoolean()` - Validates boolean types
  - `@IsArray()` - Validates array types
  - `@IsOptional()` - Marks field as optional
  - `@IsNotEmpty()` - Ensures required fields are not empty
  - `@IsEmail()` - Validates email format
  - `@Min()`, `@Max()` - Numeric range validation
  - Example:
    ```typescript
    class CreateBountyDto {
      @IsString()
      @IsNotEmpty()
      wishlistItemId: string;
      
      @IsNumber()
      targetAmountEur: number;
      
      @IsString()
      @IsOptional()
      description?: string;
    }
    ```
- **Error Handling**: Use `HttpException` with appropriate status codes
- **CORS**: Configured in `main.ts` for frontend origins
- **Protected Routes**: Use `AuthGuard('jwt')` and `CurrentUser` decorator to access user payload

#### Type Safety
- **Interfaces**: Define interfaces for all DTOs
- **TypeScript**: Strict mode enabled
- **Validation**: Runtime validation with class-validator on DTOs

#### Testing
- **Unit Tests**: Mock repositories and services; keep tests isolated
- **E2E Tests**: Test full request/response cycle
- **Mock Providers**: Use `getRepositoryToken()` for TypeORM repos in test modules

### General Conventions

#### Code Style
- **Variables**: Use `const` and `let`; never `var`
- **Functions**: Prefer `async/await` over `.then()` chains
- **Naming**: camelCase for variables/functions, PascalCase for classes/components
- **Exports**: Use `export default` for main module exports

#### Error Handling
- **Try-Catch**: Wrap all async operations in try-catch blocks
- **Logging**: Use `console.error()` for errors, avoid `console.log()` in production
- **User Feedback**: Provide clear error messages to users

## 4. Web3 Integration

### Smart Contract Architecture

#### CompanyWishlistEscrow.sol
- **Purpose**: Time-bound crowdfunding escrow for company wishlist items
- **Key Features**:
  - Multi-contributor support with contribution tracking
  - Deadline-based funding goals
  - Proportional gas fee distribution (0.1% of total, 0.001-0.1 ETH cap)
  - Refund mechanism with fair gas cost sharing
  - Owner fund release on successful campaigns
- **Networks**: Ethereum Sepolia (testnet), Avalanche Fuji (testnet)
- **Gas Fee Distribution**: When campaign fails and contributors claim refunds:
  - Gas reserve calculated as 0.1% of total raised
  - Minimum 0.001 ETH, maximum 0.1 ETH
  - Each contributor pays proportional share: `(contribution × gasReserve) / totalRaised`
  - Prevents single contributor from bearing all gas costs

#### EscrowFactory.sol
- **Purpose**: Factory pattern for deploying escrow contract instances
- **Benefits**: Standardized deployment, reduced gas costs, easier contract management

### Frontend Web3 Integration
- **Location**: `/frontend/src/lib/web3/web3.ts`
- **Provider**: Direct `window.ethereum` interaction (MetaMask)
- **Features**:
  - Wallet connection management
  - Network switching (Ethereum Sepolia, Avalanche Fuji)
  - Transaction signing and sending
  - Contract interaction via ABI
  - Balance checking and address formatting
- **Implementation**: Integrated into company pages for escrow contributions

### Backend Web3 Integration
- **Bounties API**: 5 REST endpoints for campaign management
  - `GET /bounties` - List all active bounties
  - `GET /bounties/:id` - Get bounty details
  - `POST /bounties` - Create new bounty (links wishlist item to contract)
  - `POST /bounties/:id/sync` - Sync on-chain data with database
  - `GET /bounties/company/:id` - Get bounties for specific company
- **Contract Sync**: Background sync of on-chain state (totalRaised, contributors, status)
- **Access Control**: Only company owners can create bounties for their wishlist items

### Guidelines for Web3 Features
- Keep Web3 code modular and isolated in `/frontend/src/lib/web3/`
- Handle wallet connection errors gracefully with user-friendly messages
- Always check network before transactions (show network switch prompt)
- Validate contract addresses and function selectors
- Use TypeChain-generated types for type-safe contract interactions
- Log transaction hashes for user reference
- Provide clear feedback during transaction states (pending, success, error)

## 5. Development Workflow

### Local Development with Docker Compose
```bash
# Start all services (postgres, redis, backend, frontend)
docker-compose up

# View logs for a specific service
docker-compose logs -f backend

# Stop all services
docker-compose down

# Rebuild and restart a service
docker-compose up -d --build backend
```

**Environment Note**: Shell environment variables may override `.env` values. If services fail to connect, unset shell vars: `unset POSTGRES_HOST POSTGRES_PORT DATABASE_URL` and restart compose.

### Local Development (Manual)
```bash
# Frontend only (port 5173)
cd frontend && pnpm dev

# Backend only (port 3000) — requires Postgres & Redis running separately
cd backend && pnpm start:dev

# Smart contracts development
cd hardhat && npx hardhat compile
```

### Smart Contract Development
```bash
# Compile contracts
cd hardhat && npx hardhat compile

# Run tests
npx hardhat test

# Deploy to testnet (Sepolia)
npx hardhat run scripts/deploy-factory.ts --network sepolia

# Deploy to testnet (Fuji)
npx hardhat run scripts/deploy-factory.ts --network fuji

# Test escrow system end-to-end
npx hardhat run scripts/test-escrow-system.ts --network sepolia
```

### Database Initialization & Migrations
```bash
# Generate a new migration from entity changes
cd backend
pnpm run migration:generate -- src/migrations/description-of-change

# Run pending migrations
pnpm run migration:run

# Revert the last migration
pnpm run migration:revert
```

### Building
```bash
# Frontend static build
cd frontend && pnpm build

# Backend production build
cd backend && pnpm build

# Smart contracts compile (generates TypeChain types)
cd hardhat && npx hardhat compile
```

### Testing
```bash
# Backend unit tests
cd backend && pnpm test

# Backend tests in watch mode
pnpm test:watch

# Backend e2e tests
pnpm test:e2e

# Generate coverage report
pnpm test:cov

# Smart contract tests
cd hardhat && npx hardhat test

# Frontend type checking
cd frontend && pnpm run check
```

## 6. Configuration & Environment

### Environment Variables (`.env`)
The `.env` file is the single source of truth for docker-compose. Key variables:

**Database Configuration**
```bash
POSTGRES_USER=lfc_user
POSTGRES_PASSWORD=lfc_pass
POSTGRES_DB=lfc_db
POSTGRES_HOST=postgres              # Inside docker-compose; use 'localhost' if running Postgres locally
POSTGRES_PORT=5432
DATABASE_URL=postgres://...         # Parsed by AppModule (TypeORM); standard convention
TYPEORM_SYNCHRONIZE=true            # Set to false in production; use migrations instead
```

**Authentication & Security**
```bash
JWT_SECRET=your_jwt_secret_here     # Change to strong secret in production
RECAPTCHA_SECRET_KEY=...            # reCAPTCHA secret for form validation
WEB3FORMS_ACCESS_KEY=...            # Web3Forms integration key
```

**Redis (Nonce & Multi-Instance Cache)**
```bash
REDIS_URL=redis://redis:6379        # Inside docker-compose; use 'localhost:6379' if running locally
```

**Frontend Configuration**
```bash
PUBLIC_RECAPTCHA_SITE_KEY=...       # reCAPTCHA site key (visible to browser)
PUBLIC_API_URL=http://backend:3000  # Inside docker-compose; use http://localhost:3000 for local dev
```

### AppModule Configuration Priority
The backend TypeORM configuration (`app.module.ts`) reads from environment variables in this order:

1. **DATABASE_URL** (if set): Parsed to extract host, port, username, password, database
2. **DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE**: Individual env vars (fallback)
3. **Defaults**: localhost:5432 if neither is set

This allows flexibility:
- **Local dev with compose**: Use `.env` with `POSTGRES_HOST=postgres`
- **Local dev without compose**: Use `.env` or local env vars with `POSTGRES_HOST=localhost`
- **Production/Cloud**: Use `DATABASE_URL` env var (Heroku, Railway, AWS, etc. convention)

### Docker Compose Network
- **Service Names**: Use `postgres` and `redis` as hostnames inside containers (internal DNS)
- **Host Access**: Services map to host ports (5433 for Postgres, 6379 for Redis)
- **External Connections**: Use `localhost:5433` and `localhost:6379` from host machine

## 7. Security Policies

### Environment Variables
- **Public**: Prefix with `PUBLIC_` (exposed to frontend)
- **Private**: Keep in `.env` files (never commit)
- **Required**: `WEB3FORMS_ACCESS_KEY`, `RECAPTCHA_SECRET_KEY`, SMTP credentials

### Input Validation
- Validate all user input on both client and server
- Sanitize data before processing
- Use reCAPTCHA for form submissions

### CORS and Security Headers
- Configure CORS in backend for allowed origins
- Use Helmet.js for security headers
- Enable HTTPS in production

## 8. Deployment

### Production Configuration
Before deploying to production:

1. **Disable Auto-Sync**: Set `TYPEORM_SYNCHRONIZE=false`
2. **Run Migrations**: Execute migrations as part of CI/CD pipeline during deployment
3. **Use Strong Secrets**: Generate secure values for `JWT_SECRET`, `RECAPTCHA_SECRET_KEY`
4. **Use Managed Services**:
   - Postgres: AWS RDS, Azure Database, or Cloud SQL
   - Redis: AWS ElastiCache, Azure Cache, or similar
5. **Security**:
   - Use TLS/SSL for all connections
   - Enable Redis authentication (AUTH)
   - Use environment-specific secrets (not in `.env`)
6. **Monitoring**:
   - Enable query logging on Postgres (audit trail)
   - Monitor Redis memory usage and eviction policies
   - Set up alerting for connection failures

### Migration Deployment
```bash
# During CI/CD pipeline (before app startup):
cd backend
pnpm run migration:run

# Then start the application
```

## 9. Documentation Standards

### When to Update Documentation
- **New Features**: Update relevant README.md when adding features
- **Architecture Changes**: Update this file for stack/structure changes
- **API Changes**: Document in backend README and consider API docs
- **Deployment Changes**: Update deployment scripts and READMEs
- **Database Schema**: Document entity changes; add migration descriptions

### Documentation Locations
- **Project-wide instructions**: This file (`.github/instructions/`)
- **Frontend setup & features**: `/frontend/README.md`
- **Backend API & services**: `/backend/README.md`
- **Email service setup**: `/email-server/README.md`
- **Root project overview**: `/README.md` (to be created)
- **Migrations**: Auto-generated by TypeORM CLI; stored in `backend/src/migrations/`
- **Bounties System**:
  - Implementation guide: `/frontend/docs/BOUNTIES_IMPLEMENTATION.md`
  - Quick start: `/frontend/docs/BOUNTIES_QUICKSTART.md`
  - Recent updates: `/frontend/docs/BOUNTIES_UPDATE.md`
  - API documentation: `/backend/docs/BOUNTIES_API.md`
  - FAB navigation: `/frontend/FAB_BOUNTIES_UPDATE.md`
- **Smart Contracts**: 
  - Test results: `/hardhat/TEST_RESULTS.md`
  - Escrow architecture: `/frontend/docs/ESCROW_SYSTEM.md`

## 10. Key Features & User Flows

### Companies & Wishlist Management
- **Company Profiles**: Users can create and manage company profiles with descriptions, industries, and contact info
- **Wishlist Items**: Companies can add wishlist items (needs/wants like funding, partnerships, services)
- **Owner Verification**: Only company owners can edit their company profiles and manage wishlists
- **Public Discovery**: All companies and wishlists are publicly browsable

### Bounties System (Crowdfunding)
- **Purpose**: Enable crowdfunding for specific company wishlist items using blockchain escrow
- **Flow**:
  1. Company owner creates wishlist item (e.g., "Need $5000 for marketing campaign")
  2. Owner creates bounty linking wishlist item to smart contract escrow
  3. Bounty appears on public bounties page with goal amount and deadline
  4. Investors browse bounties and contribute ETH/AVAX via MetaMask
  5. Contributions held in escrow contract until goal met or deadline passes
  6. If successful: Owner claims funds; contributors get recognition
  7. If failed: Contributors claim refunds with proportional gas fee deduction
- **Access Control**:
  - Only investors can contribute to bounties (not other company owners)
  - Only company owners can create bounties for their wishlist items
  - Bounties link visible in FAB only for users with registered companies

### Navigation & Access Patterns
- **FAB (Floating Action Button)**: Main navigation with conditional items
  - Home (always visible)
  - Companies (authenticated users)
  - **Bounties** (authenticated users with registered companies only)
  - Dashboard (authenticated users)
  - Profile (authenticated users)
  - Sign In/Out
- **Bounties Page**: Browse all active crowdfunding campaigns
  - Filter by status (active, funded, expired)
  - Search by company or description
  - View progress bars and contributor counts
  - Click through to bounty detail page
- **Bounty Detail Page**: View-only information display
  - Campaign details (goal, raised, deadline, status)
  - Company information with link to profile
  - Contributor list and progress visualization
  - **CTA**: "Go to Company Page to Contribute" button
- **Company Page**: Main interaction point for contributions
  - Company profile at top
  - Wishlist items below with status badges
  - Escrow-enabled items show contribution form (investors only)
  - Network selector (Ethereum Sepolia / Avalanche Fuji)
  - MetaMask integration for transactions
  - Auto-refresh after successful contribution

### Role-Based Features
- **User Role (Default)**:
  - Browse companies and bounties
  - Create own company profile
  - Add wishlist items to own company
  - Create bounties for own wishlist items
- **Investor Role**:
  - All user role features
  - Contribute to bounties via MetaMask
  - View contribution history
  - Cannot contribute to own company's bounties
- **Staff Role** (Admin):
  - All features plus moderation capabilities
  - Manage users and companies (planned)

## 11. Frontend Architecture Details

### Key Pages & Routes
- `/` - Home page with intro and call-to-action
- `/pitch` - Pitch deck/presentation page
- `/learnMore` - Detailed information about the club
- `/auth` - Combined login/register page with animated toggle
- `/dashboard` - User dashboard with personalized content
- `/profile` - User profile management with avatar upload
- `/companies` - Browse all companies
- `/companies/[id]` - Company detail page with wishlist and contribution UI
- `/bounties` - Browse all bounties/crowdfunding campaigns
- `/bounties/[id]` - Bounty detail page (view-only, redirects to company for contribution)
- `/forgot-password` - Password reset request
- `/reset-password` - Password reset confirmation

### State Management
- **Auth Store** (`/src/lib/stores/auth.ts`):
  - User authentication state
  - JWT access token (memory only)
  - Refresh token (httpOnly cookie)
  - User profile data
  - Login/logout/register methods
- **Wallet Store** (`/src/lib/stores/walletStore.ts`):
  - Web3 wallet connection state
  - Current chain and network
  - Balance information
  - Formatted address display
- **Component-Level State**: Svelte 5 runes (`$state`, `$derived`, `$effect`)

### Web3 Integration Layer
- **Location**: `/src/lib/web3/web3.ts`
- **Capabilities**:
  - Detect MetaMask presence
  - Request wallet connection
  - Get current account and balance
  - Switch networks (Sepolia 0xaa36a7, Fuji 0xa869)
  - Send transactions with custom data
  - Format addresses for display
- **Contract Interaction**:
  - Contribution function selector: `0xd7bb99ba`
  - ABI encoding for transaction data
  - Transaction receipt monitoring
  - Error handling and user feedback

### Component Library
- **Layout Components**: `+layout.svelte` with FAB navigation
- **UI Components**:
  - `Web3Modal.svelte` - Wallet connection modal
  - `Toast.svelte` - Toast notifications for feedback
- **Icons**: Lucide Svelte icon library
- **Styling**: 
  - Tailwind CSS utility classes
  - Custom glass morphism effects (`glass-fab`)
  - Neon accent colors (`btn-neon-cool`)
  - Dark/light theme support

## 12. Backend Architecture Details

### Module Organization
```
src/
├── auth/              # Authentication & authorization
├── users/             # User management & profiles
├── companies/         # Company CRUD & wishlist
├── bounties/          # Crowdfunding campaigns
├── web3/              # Blockchain integration
├── contact/           # Contact form handling
├── uploads/           # File upload management
├── entities/          # TypeORM entity definitions
├── migrations/        # Database migrations
├── common/            # Shared utilities & filters
└── config/            # Configuration modules
```

### Bounties Module
- **Controller** (`bounties.controller.ts`):
  - 5 REST endpoints for bounty management
  - JWT authentication required
  - Owner verification for bounty creation
- **Service** (`bounties.service.ts`):
  - Database operations for bounties
  - Contract address validation
  - Chain ID validation
  - Sync on-chain state with database
- **DTOs**:
  - `CreateBountyDto`: Validate bounty creation input
  - `SyncBountyDto`: Sync contract state updates
- **Entity** (`Bounty`):
  - Relationships: ManyToOne with WishlistItem and Company
  - Fields: contractAddress, chainId, goalAmount, deadline, status
  - Timestamps: createdAt, updatedAt

### Companies Module
- **Controller** (`companies.controller.ts`):
  - CRUD operations for companies
  - Wishlist item management
  - Owner verification middleware
  - Public read, authenticated write
- **Service** (`companies.service.ts`):
  - Database operations with TypeORM
  - Owner verification logic
  - Wishlist item CRUD
- **Entities**:
  - `Company`: Business profiles with owner relationship
  - `WishlistItem`: Needs/wants with optional escrow integration

### Web3 Module
- **Signature Verification** (`web3.service.ts`):
  - SIWE message validation
  - Ethereum signature recovery
  - Nonce verification with Redis
- **Nonce Service** (`nonce.redis.service.ts`):
  - Redis-backed nonce storage
  - Atomic consume operation (Lua script)
  - TTL-based expiration (5 minutes)
  - Fallback to in-memory for single-instance dev

## 13. Smart Contract Architecture

### CompanyWishlistEscrow.sol
```solidity
// Key functions:
function contribute() external payable              // Accept contributions
function releaseFunds() external                    // Owner claims on success
function claimRefund() external                     // Contributors get refund on failure
function _calculateGasReserve() internal pure       // Fair gas fee calculation
```

**State Variables**:
- `address public owner` - Company receiving funds
- `uint256 public goalAmount` - Target funding amount
- `uint256 public deadline` - Campaign end timestamp
- `uint256 public totalRaised` - Current contributions sum
- `mapping(address => uint256) public contributions` - Contributor balances
- `address[] public contributorList` - List of all contributors

**Events**:
- `ContributionReceived(address indexed contributor, uint256 amount)`
- `FundsReleased(address indexed owner, uint256 amount)`
- `RefundClaimed(address indexed contributor, uint256 refundAmount, uint256 gasFee)`

**Gas Fee Logic**:
```solidity
// When campaign fails, calculate fair gas reserve:
uint256 gasReserve = (totalRaised * 10) / 10000;  // 0.1%
if (gasReserve < 0.001 ether) gasReserve = 0.001 ether;
if (gasReserve > 0.1 ether) gasReserve = 0.1 ether;

// Each contributor pays proportional share:
uint256 contributorShare = (contribution * gasReserve) / totalRaised;
uint256 refund = contribution - contributorShare;
```

### EscrowFactory.sol
```solidity
function createEscrow(
    address _owner,
    uint256 _goalAmount,
    uint256 _deadline
) external returns (address)
```

**Purpose**: Standardized escrow deployment with predictable addresses and reduced gas costs

## 14. Deployment & Production

### Frontend Deployment
- **Platform**: Static hosting (Blacknight, Netlify, Vercel, etc.)
- **Build**: `pnpm build` generates static files in `/build`
- **Configuration**: 
  - SvelteKit adapter-static with fallback for SPA routing
  - Prerendering for SEO-friendly pages
  - Brotli compression enabled (`precompress: true`)
- **Environment**: Set `PUBLIC_API_URL` to production backend URL

### Backend Deployment
- **Platform**: Railway, Heroku, AWS, or similar
- **Configuration**:
  - Set `TYPEORM_SYNCHRONIZE=false` in production
  - Run migrations during deployment: `pnpm run migration:run`
  - Use managed Postgres and Redis services
- **Environment**: Configure all secrets via platform environment variables

### Smart Contract Deployment
- **Networks**:
  - Ethereum Sepolia (testnet): For testing and development
  - Avalanche Fuji (testnet): For testing and development
  - Mainnet deployment: Planned for production launch
- **Process**:
  ```bash
  cd hardhat
  npx hardhat run scripts/deploy-factory.ts --network sepolia
  npx hardhat run scripts/deploy-factory.ts --network fuji
  ```
- **Verification**: Submit contract source to Etherscan/Snowtrace for transparency

### Environment Variables Summary

**Frontend (`.env`)**:
```bash
PUBLIC_API_URL=https://api.liffeyfc.com
PUBLIC_RECAPTCHA_SITE_KEY=...
```

**Backend (`.env`)**:
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
TYPEORM_SYNCHRONIZE=false

# Auth
JWT_SECRET=strong_random_secret
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Redis
REDIS_URL=redis://redis:6379

# External Services
RECAPTCHA_SECRET_KEY=...
WEB3FORMS_ACCESS_KEY=...
GCP_BUCKET_NAME=...
GCP_SERVICE_ACCOUNT_KEY=...

# SMTP
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=...
SMTP_PASS=...
```

**Hardhat (`.env`)**:
```bash
# Sepolia (Ethereum testnet)
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/...
SEPOLIA_PRIVATE_KEY=...

# Fuji (Avalanche testnet)
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
FUJI_PRIVATE_KEY=...

# Etherscan API (for verification)
ETHERSCAN_API_KEY=...
```