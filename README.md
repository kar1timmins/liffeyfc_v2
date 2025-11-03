# Liffey Founders Club - Web Platform

A modern full-stack web application for the Liffey Founders Club community, built with SvelteKit, NestJS, and planned Web3 integration.

## 🏗️ Project Architecture

This is a monorepo containing three main services:

```
liffeyfc_v2/
├── frontend/          # SvelteKit static site (Svelte 5 + Tailwind CSS)
├── backend/           # NestJS API server (TypeScript)
├── email-server/      # Node.js email service (Railway deployment)
├── docker-compose.yml # Local development orchestration
└── deploy.sh          # Deployment automation
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- Docker and Docker Compose (for local development)
- Git

### Local Development with Docker

Start all services simultaneously:

```bash
# Clone the repository
git clone <repository-url>
cd liffeyfc_v2

# Create environment files (see Environment Variables section)
cp .env.example .env

# Start all services
docker-compose up
```

Services will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Email Server**: (deployed separately on Railway)

### Manual Development

#### Frontend
```bash
cd frontend
pnpm install
pnpm dev
```

#### Backend
```bash
cd backend
pnpm install
pnpm start:dev
```

## 🛠️ Technology Stack

### Frontend
- **Framework**: SvelteKit 2 with Svelte 5 (runes-based reactivity)
- **Styling**: Tailwind CSS v4
- **Build Tool**: Vite 7
- **Adapter**: Static site generation (`@sveltejs/adapter-static`)
- **Language**: TypeScript
- **Deployment**: Static hosting (Blacknight/Apache)

### Backend
- **Framework**: NestJS 11
- **Runtime**: Node.js with TypeScript
- **Features**: 
  - Contact form handling
  - reCAPTCHA v3 validation
  - Web3Forms integration
  - RESTful API endpoints

### Email Service
- **Runtime**: Node.js with Express
- **SMTP**: Zoho Mail
- **Features**: Automated welcome emails
- **Deployment**: Railway

### Web3 (Planned)
- **Chains**: Ethereum, Avalanche
- **Implementation**: Custom lightweight Web3 utilities
- **Location**: `/frontend/src/lib/web3/`

## 📁 Project Structure

### Frontend (`/frontend/`)
```
frontend/
├── src/
│   ├── routes/              # SvelteKit file-based routing
│   │   ├── +page.svelte     # Homepage
│   │   ├── learnMore/       # Learn More page
│   │   ├── pitch/           # Pitch event page
│   │   └── welcome/         # Welcome page
│   ├── lib/
│   │   ├── web3/            # Web3 integration utilities
│   │   ├── animations.ts    # Animation helpers
│   │   └── transitions.ts   # Page transition logic
│   ├── app.css              # Global Tailwind styles
│   └── app.html             # HTML template
├── static/                  # Static assets (images, videos, etc.)
├── build/                   # Production build output
└── package.json
```

### Backend (`/backend/`)
```
backend/
├── src/
│   ├── contact/             # Contact form module
│   │   ├── contact.controller.ts
│   │   ├── contact.service.ts
│   │   └── contact.module.ts
│   ├── app.module.ts        # Root application module
│   └── main.ts              # Application entry point
├── test/                    # E2E tests
└── package.json
```

### Email Server (`/email-server/`)
```
email-server/
├── server.js                # Express server with SMTP
├── Dockerfile               # Railway deployment
└── package.json
```

## 🔐 Environment Variables

### Frontend (`.env` in `/frontend/`)
```bash
# Public variables (exposed to client)
PUBLIC_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
PUBLIC_API_URL=http://localhost:3000
PUBLIC_DEBUG_LOGS=1
PUBLIC_APP_ENV=development

# Private variables (server-side only)
RECAPTCHA_SECRET_KEY=your_recaptcha_secret
WEB3FORMS_ACCESS_KEY=your_web3forms_key
```

### Backend (`.env` in `/backend/`)
```bash
PORT=3000
NODE_ENV=development
WEB3FORMS_ACCESS_KEY=your_web3forms_key
RECAPTCHA_SECRET_KEY=your_recaptcha_secret
ENABLE_API_LOGS=1
```

### Email Server (Railway environment)
```bash
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=info@liffeyfoundersclub.com
SMTP_PASS=your_zoho_app_password
PORT=3001
NODE_ENV=production
ALLOWED_ORIGINS=https://liffeyfoundersclub.com,https://www.liffeyfoundersclub.com
```

## 📝 Available Scripts

### Frontend
```bash
pnpm dev              # Start development server
pnpm build            # Build static site + generate sitemap
pnpm preview          # Preview production build
pnpm generate:sitemap # Generate sitemap.xml
pnpm validate:sitemap # Validate sitemap
pnpm lint             # Run ESLint
pnpm format           # Format code with Prettier
```

### Backend
```bash
pnpm start:dev        # Start development server (watch mode)
pnpm start:prod       # Start production server
pnpm build            # Build production bundle
pnpm lint             # Run ESLint
pnpm test             # Run unit tests
pnpm test:e2e         # Run E2E tests
```

## 🌐 Web3 Integration (Planned)

The project includes a lightweight Web3 implementation for future blockchain features:

- **Current**: Basic wallet connection via `window.ethereum`
- **Planned**: 
  - Ethereum mainnet integration
  - Avalanche C-Chain support
  - Smart contract interactions
  - Token gating for premium features
  - NFT membership system

See `/frontend/src/lib/web3/web3.ts` for the current implementation.

## 🚢 Deployment

### Frontend (Static Site)
The frontend builds to static files suitable for any web host:

```bash
cd frontend
pnpm build
# Upload contents of 'build/' to your web server
```

Current deployment: Blacknight hosting with Apache (see `/frontend/README.md`)

### Backend (NestJS API)
Can be deployed to any Node.js hosting:

```bash
cd backend
pnpm build
pnpm start:prod
```

Deployment options: Railway, Heroku, AWS, DigitalOcean, etc.

### Email Server
Currently deployed on Railway. See `/email-server/README.md` for setup.

## 🧪 Testing

### Frontend
```bash
cd frontend
# Testing framework to be added
```

### Backend
```bash
cd backend
pnpm test              # Unit tests
pnpm test:e2e          # End-to-end tests
pnpm test:cov          # Coverage report
```

## 📚 Documentation

Detailed documentation is maintained in service-specific README files:

- **Frontend Setup & Features**: [`/frontend/README.md`](/frontend/README.md)
- **Backend API & Services**: [`/backend/README.md`](/backend/README.md)
- **Email Service**: [`/email-server/README.md`](/email-server/README.md)
- **GitHub Copilot Instructions**: [`/.github/instructions/lfc_project_instructions.instructions.md`](/.github/instructions/lfc_project_instructions.instructions.md)

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Follow the coding guidelines in `.github/instructions/`
3. Update relevant README files for new features
4. Ensure all tests pass
5. Submit a pull request

### Code Style
- **Frontend**: Svelte 5 runes, Tailwind CSS, TypeScript
- **Backend**: NestJS patterns, dependency injection, TypeScript strict mode
- **Formatting**: Prettier with project config
- **Linting**: ESLint with project rules

## 📄 License

[Add your license here]

## 👥 Contact

Liffey Founders Club  
Email: info@liffeyfoundersclub.com  
Website: https://liffeyfoundersclub.com

---

**Note**: This project is actively developed. Features and architecture may evolve. Always refer to the latest documentation in the respective README files.
