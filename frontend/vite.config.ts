import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Backend target configuration
// Development:
//   - LOCAL: http://localhost:3000 (running backend separately)
//   - DOCKER: http://backend:3000 (running with docker-compose)
// Production:
//   - Uses PUBLIC_API_URL from environment variables
//
// Priority: BACKEND_URL env var > http://localhost:3000
const backendTarget = process.env.BACKEND_URL || 'http://localhost:3000';
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
	server: {
		host: '0.0.0.0', // Listen on all network interfaces (required for Docker)
		port: 5173,
		strictPort: true, // Fail if port is already in use
		watch: {
			usePolling: true, // Required for Docker on some systems
		},
		proxy: {
			// Proxy API requests to backend during development
			// This avoids CORS issues in dev mode
			'/auth': {
				target: backendTarget,
				changeOrigin: true,
			},
			'/companies': {
				target: backendTarget,
				changeOrigin: true,
			},
			'/users': {
				target: backendTarget,
				changeOrigin: true,
			},
			'/web3': {
				target: backendTarget,
				changeOrigin: true,
			},
			'/contact': {
				target: backendTarget,
				changeOrigin: true,
			},
			'/wishlist': {
				target: backendTarget,
				changeOrigin: true,
			},
			// Legacy contact form endpoint
			'/api/interest/submit/': {
				target: backendTarget,
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api\/interest\/submit\//, '/contact/interest'),
			},
		},
	},
});
