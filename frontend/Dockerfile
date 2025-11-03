# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS runner
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Expose Vite dev server
EXPOSE 5173

# Run SvelteKit dev server
CMD ["pnpm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
