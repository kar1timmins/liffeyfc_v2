import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

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
				target: 'http://backend:3000',
				changeOrigin: true,
				rewrite: (path) => '/contact/interest',
			},
		},
	},
});
