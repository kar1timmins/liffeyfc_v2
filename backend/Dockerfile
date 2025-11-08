# Use Node 20 Alpine for smaller image
FROM node:20-alpine AS base

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

# Production dependencies stage
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
# Install prod dependencies + typeorm/ts-node for migrations
RUN pnpm install --frozen-lockfile --prod && \
    pnpm add -D typeorm ts-node @types/node typescript

# Build stage
FROM base AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

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
