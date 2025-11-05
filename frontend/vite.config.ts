import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Allow overriding backend target via env when running frontend locally.
// In Docker Compose we set BACKEND_URL=http://backend:3000 so the proxy works inside containers.
const backendTarget = process.env.BACKEND_URL || 'http://localhost:3000';

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
			'/api/interest/submit/': {
				target: backendTarget,
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api\/interest\/submit\//, '/contact/interest'),
			},
			'/api': {
				target: backendTarget,
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, ''),
			},
		},
	},
});
