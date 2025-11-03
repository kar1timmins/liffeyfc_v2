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

#### API Design
- **REST**: Follow RESTful conventions
- **Validation**: Use NestJS validation pipes
- **Error Handling**: Use `HttpException` with appropriate status codes
- **CORS**: Configure for frontend origins

#### Type Safety
- **Interfaces**: Define interfaces for all DTOs
- **TypeScript**: Strict mode enabled
- **Validation**: Runtime validation with class-validator

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

### Local Development
```bash
# Start all services
docker-compose up

# Frontend only (port 5173)
cd frontend && pnpm dev

# Backend only (port 3000)
cd backend && pnpm start:dev
```

### Building
```bash
# Frontend static build
cd frontend && pnpm build

# Backend production build
cd backend && pnpm build
```

### Testing
- Follow existing test patterns in `*.spec.ts` files
- Write unit tests for services and utilities
- Add e2e tests for critical user flows

## 6. Security Policies

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

## 7. Documentation Standards

### When to Update Documentation
- **New Features**: Update relevant README.md when adding features
- **Architecture Changes**: Update this file for stack/structure changes
- **API Changes**: Document in backend README and consider API docs
- **Deployment Changes**: Update deployment scripts and READMEs

### Documentation Locations
- **Project-wide instructions**: This file (`.github/instructions/`)
- **Frontend setup & features**: `/frontend/README.md`
- **Backend API & services**: `/backend/README.md`
- **Email service setup**: `/email-server/README.md`
- **Root project overview**: `/README.md` (should be created)