<!-- Auto-generated Copilot instructions for the Liffey Founders Club monorepo -->
# Liffey Founders Club — Copilot Instructions

Purpose: quick rules and references to help AI agents be productive in this repo.

- **Big picture**: Monorepo containing a static SvelteKit frontend, a NestJS backend API, an Express email service, and Hardhat smart contracts. Focus areas: company profiles, wishlist items, blockchain bounties (escrow contracts), and SIWE authentication.

- **Key directories**:
  - Frontend: [frontend](../frontend) — SvelteKit UI, `src/lib/web3/web3.ts` is the canonical wallet/contract layer.
  - Backend: [backend](../backend) — NestJS API. Key modules: `src/web3/`, `src/auth/`, `src/companies/`, `src/bounties/`, `src/entities/`.
  - Smart contracts: [hardhat](../hardhat) — solidity contracts, `CompanyWishlistEscrow.sol`, `EscrowFactory.sol` and TypeChain outputs.
  - Docs: [docs/MASTER_WALLET_LOOKUP.md](../docs/MASTER_WALLET_LOOKUP.md) (wallet lookup flow) and many bounty-related docs.

- **Architectural decisions agents should remember**:
  - Three-tier wallet model: master user wallet -> child company wallets -> escrow contracts. See [docs/MASTER_WALLET_LOOKUP.md](../docs/MASTER_WALLET_LOOKUP.md).
  - All Web3 RPC calls are proxied through the backend (`/wallet-balance`, `/wallet/lookup`) — do not call RPC endpoints directly from the frontend.
  - SIWE nonce storage uses Redis via `backend/src/web3/nonce.redis.service.ts` (fallback in-memory used when `REDIS_URL` is not set).
  - Use TypeORM migrations in the backend (dev uses synchronize; production must run migrations explicitly).

- **Developer workflows (commands)**:
  - Full stack dev: `docker-compose up` (root). Services: postgres, redis, backend, frontend.
  - Frontend dev: `cd frontend` → `pnpm install && pnpm dev`; build: `pnpm build` → output: `frontend/build/`.
  - Backend dev: `cd backend` → `pnpm install && pnpm start:dev`; tests: `pnpm test`, `pnpm test:e2e`.
  - Hardhat: `cd hardhat` → `pnpm install` (or root `pnpm i`) → `npx hardhat test`, deploy scripts in `hardhat/scripts`.
  - DB migrations: `cd backend` → `pnpm run migration:generate -- src/migrations/<name>` and `pnpm run migration:run`.

- **Conventions & patterns**:
  - Frontend: Svelte 5 + runes (`$state`, `$derived`, `$effect`). Components use PascalCase. State via Svelte stores (no external state libs).
  - Backend: NestJS folders are kebab-case. Modules contain `*.controller.ts`, `*.service.ts`, `*.module.ts` and use DTOs with `class-validator` decorators.
  - Entities: See `backend/src/entities/` for `User`, `UserWallet`, `Company`, `WishlistItem`, `EscrowDeployment`, and `Contribution`.

- **Security / production notes**:
  - `TYPEORM_SYNCHRONIZE=false` in production; run migrations during CI.
  - `JWT_SECRET` must be strong; refresh tokens use DB-backed rotation and httpOnly cookies.
  - Avoid storing private secrets in client or `PUBLIC_` env vars.

- **Where to look for common tasks**:
  - Wallet lookup endpoint: `backend/src/web3/wallet-generation.service.ts` and `backend/src/web3/wallet-balance.controller.ts`.
  - SIWE flows and nonce: `backend/src/web3/` (message/verify, nonce service). Redis-backed nonce: `backend/src/web3/nonce.redis.service.ts`.
  - Frontend Web3 interactions: `frontend/src/lib/web3/web3.ts` and `frontend/src/lib/stores/walletStore.ts`.
  - Escrow & bounty flows: `hardhat/contracts/CompanyWishlistEscrow.sol`, `backend/src/bounties/` and `docs/BOUNTIES_API.md`.

- **Quick API & files**:
  - Wallet lookup: `GET /wallet/lookup?address=<addr>&chain=<ethereum|avalanche>` (`backend/src/web3/wallet-generation.service.ts`).
  - Wallet balance proxy: `GET /wallet-balance?address=<addr>&chain=<ethereum|avalanche>` and `GET /wallet-balance/gas-price?chain=<chain>` (`backend/src/web3/wallet-balance.controller.ts`).
  - SIWE endpoints: `GET /auth/siwe/message/:address` & `POST /auth/siwe/verify` (`backend/src/auth/`).
  - Bounties endpoints: `GET /bounties`, `POST /bounties`, `GET /bounties/:id/contributors` (`backend/src/bounties/`).
  - Hardhat scripts: `hardhat/scripts/*` (deploy, test, factory scripts). TypeChain types output location: `hardhat/types/` or `typechain/` (check `hardhat.config.ts`).

- **Quick commands**:
  - Full stack (docker-compose): `docker compose up --build` (run from repo root).
  - Frontend dev: `cd frontend && pnpm install && pnpm dev`.
  - Backend dev: `cd backend && pnpm install && pnpm start:dev`.
  - Run migrations: `cd backend && pnpm run migration:run` (production) or `pnpm run migration:generate` (dev changes).
  - Hardhat: `cd hardhat && npx hardhat test` and `npx hardhat run scripts/deploy-factory.ts --network sepolia`.

- **Common pitfalls / tips**:
  - Do not call RPC endpoints directly from the frontend. Use the backend wallet proxy to avoid CORS and to centralize multiple RPC fallbacks.
  - If changing entities, generate & commit TypeORM migrations and update `backend/src/migrations/`.
  - Check `TYPEORM_SYNCHRONIZE` env var — `true` in local/dev but must be `false` in production with migrations run explicitly.
  - For SIWE nonces, prefer the Redis backed service for multi-instance or Docker Compose setups (`REDIS_URL`).

- **Agent guidelines** (what to do / avoid):
  - Favor small, logically-scoped PRs. Preserve existing naming/organization and common DTO patterns.
  - If modifying entity shapes, update TypeORM migrations and tests. Run `pnpm run migration:generate` and `pnpm run migration:run` locally.
  - Avoid changing UI state libraries; use Svelte stores and runes for reactive updates.
  - When adding web3 RPC access, add it to backend proxy rather than exposing RPC endpoints in frontend.
  - When adding features that alter blockchain behaviour, update `hardhat` tests and TypeChain types accordingly.

- **Useful quick references**:
  - Run full stack locally: `docker compose up --build` from the repo root.
  - Build frontend: `cd frontend && pnpm build` → `frontend/build/` to deploy.
  - Run backend unit tests: `cd backend && pnpm test`.
  - Run hardhat tests: `cd hardhat && npx hardhat test`.

If anything above is unclear or you want me to refine a specific section, I can iterate on this file.

## How to update this brief

- **Purpose**: Keep this short, focused, and immediately usable by AI agents and human reviewers. Use the long `/.github/instructions/lfc_project_instructions.instructions.md` as the canonical source.
- **Steps**:
  1. Edit the long instructions to reflect structural/architectural changes.
  2. Update this brief with only the *actionable* information: new commands, changed API endpoints, or migration steps that affect developers.
  3. Add/modify the `Quick API & files` and `Quick commands` sections where appropriate.
  4. Keep the file concise — prefer 20–50 lines for quick scanning (soft limit).
  5. Add a short note at the bottom with the `Updated: YYYY-MM-DD by <author>` stamp.
  6. Run the docs check script to validate presence of required sections:

```
chmod +x .github/scripts/check-copilot-instructions.sh
.github/scripts/check-copilot-instructions.sh
```

- **When to change**: Update this file when backend or frontend APIs change, when new developer workflows are added (e.g., new CLI commands or CI checks), or when core architectural decisions change (e.g., RPC proxy removal or changes to nonce storage). Minor cosmetic or UI adjustments don't require edits to this brief unless they change developer workflows.

**Docs check behavior**: The docs validator will produce warnings for missing coverage and mismatched endpoints but will only fail for missing files. Treat warnings as actionable tasks to keep the brief and canonical docs in sync.

---

Updated: 2025-12-13 by automation
