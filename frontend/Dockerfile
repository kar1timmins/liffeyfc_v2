# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
# Install deps: prefer lockfile, otherwise install and generate one
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
# Expose Vite dev server
EXPOSE 5173
# Run SvelteKit dev so +server endpoints work with adapter-netlify
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
