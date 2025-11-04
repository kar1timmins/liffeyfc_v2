<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## Authentication & Web3 modules (project-specific)

This project includes authentication (email/password and SIWE), Web3 integration, TypeORM/Postgres persistence, and Redis for shared nonce storage.

### Modules

- `src/users` — User management with TypeORM entity and repository pattern.
- `src/auth` — Authentication service with JWT tokens, refresh-token rotation, and SIWE support.
  - `POST /auth/register` — register with email/password
  - `POST /auth/login` — login with email/password
  - `GET /auth/siwe/message/:address` — generate a SIWE sign-in message
  - `POST /auth/siwe/verify` — verify SIWE signature and issue JWT
  - `POST /auth/refresh` — refresh JWT using refresh token
  - `POST /auth/logout` — revoke refresh token
- `src/web3` — Web3 signature verification, SIWE message generation, nonce management (Redis-backed in multi-instance deployments).

### Database Configuration

This project uses **PostgreSQL** and **TypeORM**. Configuration is read from environment variables in this order of precedence:

1. **`DATABASE_URL`** (standard convention, e.g., `postgres://user:pass@host:port/db`)
2. **Individual `DB_*` variables** (fallback):
   - `DB_HOST` (default: `localhost`)
   - `DB_PORT` (default: `5432`)
   - `DB_USERNAME`
   - `DB_PASSWORD`
   - `DB_DATABASE`

#### Local Development with Docker Compose

1. **Start services (Postgres, Redis, Backend, Frontend):**

   ```bash
   cd /path/to/liffeyfc_v2
   docker compose up -d
   ```

2. **Generate and apply migrations:**

   ```bash
   cd backend
   pnpm run migration:generate -- src/migrations/init  # (if needed)
   pnpm run migration:run
   ```

3. **Backend runs on `http://localhost:3000` with automatic reload** via watch mode.

#### Manual Setup (without Docker Compose)

```bash
# Start Postgres (e.g., via Docker or local install)
docker run --name liffey-postgres \
  -e POSTGRES_USER=lfc_user \
  -e POSTGRES_PASSWORD=lfc_pass \
  -e POSTGRES_DB=lfc_db \
  -p 5432:5432 \
  -d postgres:15

# Set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_USERNAME=lfc_user
export DB_PASSWORD=lfc_pass
export DB_DATABASE=lfc_db
export JWT_SECRET=your_dev_secret_here

# Install and start backend
cd backend
pnpm install
pnpm start:dev
```

### Migrations

TypeORM migrations are stored in `src/migrations/` and use the DataSource defined in `src/data-source.ts`.

**Commands:**

```bash
# Generate a new migration from entity changes
cd backend
pnpm run migration:generate -- src/migrations/<name>

# Run pending migrations
pnpm run migration:run

# Revert the last migration
pnpm run migration:revert
```

**Production Considerations:**

- Set `TYPEORM_SYNCHRONIZE=false` (default in production, `true` in development).
- Run migrations as part of your CI/CD pipeline before deploying.
- Example: `pnpm run migration:run` during deployment boot.

### Redis for Nonce Storage

When `REDIS_URL` is set, the backend uses Redis to store SIWE nonces atomically (preventing replay across instances).

**Setup:**

```bash
# Redis is included in docker-compose.yml and defaults to redis://redis:6379
export REDIS_URL=redis://redis:6379
```

For production, use a managed Redis service (e.g., AWS ElastiCache) and set `REDIS_URL` to its connection string.

### JWT & Refresh Tokens

- **Access Token:** Short-lived JWT issued on login/refresh. Sent as `Authorization: Bearer <token>` header.
- **Refresh Token:** Hashed in DB with expiry and revocation fields. Supports rotation (old token is marked revoked when new one is issued).
- **Client Storage:** Refresh tokens should be stored in **httpOnly, Secure cookies** to prevent XSS attacks.

### Testing

```bash
# Unit tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:cov

# E2E tests
pnpm test:e2e
```

### Notes

- `synchronize: true` is used by default in development for convenience. Disable in production.
- Refresh tokens are returned as `<id>.<secret>` pairs. The secret must be stored securely on the client.
- Use strong `JWT_SECRET` in production (e.g., `openssl rand -base64 32`).

Notes:
````

Notes:
- Password hashing and persistent storage are intentionally left as next steps.
- JWT secret can be set via `JWT_SECRET` environment variable.
