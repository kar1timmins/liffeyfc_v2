# Use Node 20 Alpine for smaller image
FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Production dependencies stage
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
# Install prod dependencies + typeorm/ts-node for migrations (as prod deps, not dev)
RUN pnpm install --prod --frozen-lockfile && \
    pnpm add typeorm ts-node @types/node typescript tslib

# Build stage
FROM base AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# Development stage (for docker-compose)
FROM base AS dev
WORKDIR /app

# Install all dependencies (including dev dependencies)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

ENV NODE_ENV=development

# Expose port
EXPOSE 3000

# Run in watch mode for development
CMD ["pnpm", "run", "start:dev"]

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy source files needed for migrations (TypeORM CLI needs these)
COPY --from=builder /app/src/migrations ./src/migrations
COPY --from=builder /app/src/entities ./src/entities
COPY --from=builder /app/src/data-source.ts ./src/data-source.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Copy startup script
COPY start.sh ./
RUN chmod +x start.sh

# Expose port
EXPOSE 3000

# Run migrations then start app
CMD ["./start.sh"]
