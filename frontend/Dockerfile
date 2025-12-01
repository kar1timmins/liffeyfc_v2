# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS runner
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose Vite dev server
EXPOSE 5173

# Run SvelteKit dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
