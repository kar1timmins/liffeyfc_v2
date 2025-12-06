# Liffey Founders Club - Actions & Reference Guide

> **Purpose**: This file serves as a comprehensive reference for the VS Code AI agent to understand project structure, common operations, and troubleshooting steps.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Environment Setup](#environment-setup)
3. [Common Development Tasks](#common-development-tasks)
4. [Testing](#testing)
5. [Deployment](#deployment)
6. [Troubleshooting](#troubleshooting)
7. [Architecture Patterns](#architecture-patterns)

---

## Project Overview

**Liffey Founders Club v2** is a full-stack TypeScript application for connecting founders and investors.

### Tech Stack
- **Frontend**: SvelteKit 2 (Svelte 5 with runes), Tailwind CSS v4, Vite 7, ethers.js
- **Backend**: NestJS 11, TypeORM 0.3.x, PostgreSQL 15, Redis 7
- **Web3**: Hardhat for testing, ethers.js for wallet operations (Ethereum & Avalanche)
- **Storage**: GCP Cloud Storage for profile photos and file uploads
- **Auth**: JWT + Passport.js (passport-jwt), SIWE (Sign In with Ethereum), Email/Password, Google OAuth
- **Package Manager**: pnpm (v10.x)

### Monorepo Structure
```
liffeyfc_v2/
├── frontend/          # SvelteKit static site
├── backend/           # NestJS API server
├── hardhat/           # Web3 development & testing
├── email-server/      # Node.js email service (Railway)
├── docker-compose.yml # Local development orchestration
└── .github/
    └── instructions/  # Copilot instructions
```

---

## Environment Setup

### Prerequisites
- Node.js 20+
- pnpm 10+
- Docker & Docker Compose
- PostgreSQL 15 (or use Docker)
- Redis 7 (or use Docker)

### Initial Setup

```bash
# Clone repository
git clone https://github.com/kar1timmins/liffeyfc_v2.git
cd liffeyfc_v2

# Install dependencies
cd frontend && pnpm install
cd ../backend && pnpm install
cd ../hardhat && pnpm install

# Setup environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit .env files with actual values

# Generate JWT secret for backend/.env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Environment Variables

#### Backend (`.env`)
**Required**:
- `JWT_SECRET` - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `DATABASE_URL` or `POSTGRES_*` variables
- `GCP_PROJECT_ID`, `GCP_BUCKET_NAME` - For file uploads
- `REDIS_URL` - For nonce storage (SIWE)

**Optional**:
- `GCP_KEY_FILENAME` - For local dev (use ADC in production)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - For Google OAuth
- `RECAPTCHA_SECRET_KEY`, `WEB3FORMS_ACCESS_KEY` - For forms

#### Frontend (`.env`)
**Required**:
- `PUBLIC_API_URL` - Backend URL (e.g., `http://localhost:3000`)
- `PUBLIC_RECAPTCHA_SITE_KEY` - reCAPTCHA v3 site key

---

## Common Development Tasks

### Running Locally

#### Docker Compose (Recommended)
```bash
# Start all services (postgres, redis, backend, frontend)
docker-compose up

# Rebuild and restart a specific service
docker-compose up -d --build backend

# View logs
docker-compose logs -f backend

# Stop all services
docker-compose down
```

#### Manual (without Docker)
```bash
# Terminal 1 - Backend (requires Postgres & Redis running)
cd backend
pnpm start:dev

# Terminal 2 - Frontend
cd frontend
pnpm dev
```

### Database Operations

```bash
cd backend

# Generate a new migration from entity changes
pnpm run migration:generate -- src/migrations/description-of-change

# Run pending migrations
pnpm run migration:run

# Revert the last migration
pnpm run migration:revert

# Check database tables
./check-db-tables.sh
```

**Important**: 
- Development: `TYPEORM_SYNCHRONIZE=true` (auto-sync schema)
- Production: `TYPEORM_SYNCHRONIZE=false` (use migrations)

### Adding Dependencies

```bash
# Frontend
cd frontend
pnpm add <package-name>

# Backend
cd backend
pnpm add <package-name>

# Dev dependencies
pnpm add -D <package-name>
```

### Code Quality

```bash
# Frontend
cd frontend
pnpm check         # Svelte type checking
pnpm lint          # ESLint
pnpm format        # Prettier

# Backend
cd backend
pnpm test          # Unit tests
pnpm test:e2e      # E2E tests
pnpm test:cov      # Coverage report
pnpm lint          # ESLint
```

---

## Testing

### Backend Tests

```bash
cd backend

# Unit tests
pnpm test

# Watch mode
pnpm test:watch

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:cov
```

**Test Files**:
- Unit: `*.spec.ts` (co-located with source files)
- E2E: `test/*.e2e-spec.ts`

**Key Patterns**:
- Mock `DataSource` with `getDataSourceToken()`
- Set `JWT_SECRET` in `beforeAll()` for auth tests
- Mock repositories with `getRepositoryToken()`

### Hardhat Tests (Web3)

```bash
cd hardhat
pnpm test
```

**Coverage**:
- Chain discovery (Ethereum & Avalanche)
- Address validation
- Wallet connection and balance retrieval
- Randomly generated wallets (browser simulation)

### Frontend Testing

```bash
cd frontend
pnpm check  # Type checking with svelte-check
```

---

## Deployment

### Production Build

```bash
# Frontend (static site)
cd frontend
pnpm build
# Output: build/ directory

# Backend
cd backend
pnpm build
# Output: dist/ directory
```

### Docker Build

```bash
# Build specific service
docker-compose build backend
docker-compose build frontend

# Build all services
docker-compose build
```

**Note**: Dockerfiles use `pnpm` (not `npm`). Ensure `pnpm-lock.yaml` is up-to-date before building.

### Deployment Checklist

**Backend**:
1. Set `NODE_ENV=production`
2. Set `TYPEORM_SYNCHRONIZE=false`
3. Run migrations: `pnpm run migration:run`
4. Use strong `JWT_SECRET` (min 32 bytes)
5. Configure GCP ADC (Application Default Credentials) for Cloud Storage
6. Set up managed Postgres & Redis (AWS RDS, Azure, etc.)
7. Enable HTTPS/TLS for all connections

**Frontend**:
1. Set `PUBLIC_API_URL` to production backend URL
2. Build static site: `pnpm build`
3. Deploy `build/` directory to CDN/static hosting
4. Configure CSP headers (see `frontend/CSP_FIX.md`)

**Database**:
- Run migrations as part of CI/CD pipeline (before app startup)
- Enable query logging for audit trail
- Set up connection pooling

---

## Troubleshooting

### Common Issues

#### 1. Docker Build Fails: "Cannot find package-lock.json"
**Problem**: Dockerfile uses `npm ci` but project uses `pnpm`.
**Solution**: Dockerfiles now use `pnpm install --frozen-lockfile`. Ensure `pnpm-lock.yaml` is committed.

#### 2. "Failed to resolve import 'ethers'" in Frontend
**Problem**: `ethers` not installed in frontend.
**Solution**: 
```bash
cd frontend && pnpm add ethers
```

#### 3. Backend Unit Tests Fail: "Can't resolve dependencies of AppService"
**Problem**: Missing `DataSource` mock in test.
**Solution**: 
```typescript
import { getDataSourceToken } from '@nestjs/typeorm';

providers: [
  AppService,
  { provide: getDataSourceToken(), useValue: {} }
]
```

#### 4. "FATAL: JWT_SECRET environment variable is not set"
**Problem**: `JWT_SECRET` not set in test environment.
**Solution**: 
```typescript
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-for-unit-tests-at-least-32-bytes-long';
});
```

#### 5. Profile Photo Upload Fails in Production
**Problem**: GCP credentials not configured.
**Solution**: 
- **Development**: Set `GCP_KEY_FILENAME=lfc_key_gcp_bucket.json` in `.env`
- **Production**: Use Application Default Credentials (ADC). Leave `GCP_KEY_FILENAME` empty.
- Ensure `GCP_PROJECT_ID` and `GCP_BUCKET_NAME` are set.

#### 6. Database Connection Fails in Docker
**Problem**: Shell environment variables override `.env` values.
**Solution**: 
```bash
unset POSTGRES_HOST POSTGRES_PORT DATABASE_URL
docker-compose down && docker-compose up
```

#### 7. Redis Connection Issues in Multi-Instance Deployment
**Problem**: In-memory nonce service doesn't work across instances.
**Solution**: Set `REDIS_URL` in `.env` to enable Redis-backed nonce service.

---

## Architecture Patterns

### Authentication Flow

1. **SIWE (Sign In with Ethereum)**:
   - Frontend: User signs message with MetaMask
   - Backend: Verifies signature, consumes nonce, issues JWT
   - Nonce stored in Redis (or in-memory for single instance)

2. **Email/Password**:
   - Frontend: Submit credentials
   - Backend: bcrypt hash verification, issue JWT
   - Refresh tokens stored in database

3. **Google OAuth**:
   - Frontend: Redirect to Google
   - Backend: Passport.js handles callback, issue JWT

### JWT Token Management

- **Access Token**: Short-lived (15m), stored in memory
- **Refresh Token**: Long-lived (7d), stored in DB (hashed)
- **Rotation**: Refresh tokens rotate on each use
- **Revocation**: All refresh tokens can be revoked on logout

### Database Entities

**Key Entities**:
- `User`: Core user information
- `Wallet`: Blockchain addresses (many-to-one with User)
- `RefreshToken`: Hashed refresh tokens (many-to-one with User)

### File Upload Flow

1. Frontend: User selects file (profile photo)
2. Backend: Validate file type/size
3. Backend: Upload to GCP Cloud Storage
4. Backend: Store file path (not URL) in database
5. Backend: Generate signed URL for response
6. Frontend: Display photo using signed URL

**Note**: Signed URLs expire in 7 days. Generate fresh URLs on user fetch.

### Web3 Integration

**Wallet Generation**:
1. Frontend (`GenerateWalletModal`): Generate wallet with ethers.js
2. Frontend: Download keys as text file
3. Frontend: Adopt wallet (connect to backend)
4. Backend (`Web3Service`): Validate address, register session

**Supported Chains**:
- Ethereum Mainnet (`0x1`)
- Ethereum Sepolia (`0xaa36a7`)
- Avalanche C-Chain (`0xa86a`)
- Avalanche Fuji (`0xa869`)

---

## Development Guidelines

### Code Style
- **Variables**: Use `const` and `let` (never `var`)
- **Functions**: Prefer `async/await` over `.then()` chains
- **Naming**: camelCase for variables/functions, PascalCase for classes/components
- **TypeScript**: Strict mode enabled, type all functions

### Frontend (SvelteKit)
- **Components**: PascalCase filenames (e.g., `DashboardLayout.svelte`)
- **Routes**: File-based routing in `src/routes/`
- **Runes**: Use Svelte 5 runes (`$state`, `$derived`, `$effect`)
- **Styling**: Tailwind CSS utility classes (mobile-first)

### Backend (NestJS)
- **Modules**: Kebab-case folders (e.g., `contact/`)
- **Files**: NestJS conventions (`.controller.ts`, `.service.ts`, `.module.ts`)
- **Dependency Injection**: Constructor-based
- **Validation**: Use NestJS pipes and `class-validator`

### Git Workflow
- **Branch**: Feature branches from `main`
- **Commits**: Conventional Commits format
- **PR**: Squash and merge to `main`

---

## Quick Reference Commands

```bash
# Start development environment
docker-compose up

# Run all tests
cd backend && pnpm test
cd ../hardhat && pnpm test
cd ../frontend && pnpm check

# Generate migration
cd backend && pnpm run migration:generate -- src/migrations/name

# Build for production
cd frontend && pnpm build
cd ../backend && pnpm build

# Check for errors
cd frontend && pnpm check
cd ../backend && pnpm lint
```

---

## Additional Resources

- **Project Instructions**: `.github/instructions/lfc_project_instructions.instructions.md`
- **Context**: `CONTEXT.md`
- **Backend Docs**: `backend/docs/`
  - `JWT_SECURITY.md`
  - `REFRESH_TOKEN_REUSE_DETECTION.md`
  - `COOKIE_SECURITY_SUMMARY.md`
- **Frontend Docs**: `frontend/README.md`
- **Deployment**: `DEPLOYMENT_COMPLETE.md`

---

**Last Updated**: December 6, 2025
