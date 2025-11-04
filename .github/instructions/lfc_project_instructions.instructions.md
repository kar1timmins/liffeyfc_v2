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
- **Features**: Contact form handling, reCAPTCHA validation, Web3Forms integration
- **Package Manager**: pnpm

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
- **JWT Strategy**: Configured in `auth/jwt.strategy.ts`; use `@UseGuards(AuthGuard('jwt'))` or global guard

#### API Design
- **REST**: Follow RESTful conventions
- **Validation**: Use NestJS validation pipes and `class-validator`
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

## 4. Web3 Integration (Planned)

### Current Implementation
- **Location**: `/frontend/src/lib/web3/web3.ts`
- **Provider**: Direct `window.ethereum` interaction
- **Chains**: Ethereum and Avalanche (planned)

### Future Enhancements
- Smart contract integration
- Wallet connection management
- Multi-chain support (Ethereum, Avalanche)
- Transaction handling and state management

### Guidelines for Web3 Features
- Keep Web3 code modular and isolated
- Handle wallet connection errors gracefully
- Provide clear user feedback for blockchain interactions
- Support multiple wallet providers (MetaMask, WalletConnect, etc.)

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
```

### Testing
```bash
# Run unit tests
cd backend && pnpm test

# Run tests in watch mode
pnpm test:watch

# Run e2e tests
pnpm test:e2e

# Generate coverage report
pnpm test:cov
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