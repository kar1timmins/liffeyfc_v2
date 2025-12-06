# Use Node 20 Alpine for smaller image
FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Production dependencies stage
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
# Install prod dependencies only
RUN pnpm install --prod --frozen-lockfile

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

# Copy built application (includes compiled migrations in dist/)
COPY --from=builder /app/dist ./dist

# Copy startup script
COPY start.sh ./
RUN chmod +x start.sh

# Expose port
EXPOSE 3000

# Run migrations then start app
CMD ["./start.sh"]
