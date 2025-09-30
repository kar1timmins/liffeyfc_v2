import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
	server: {
		proxy: {
			'/api/interest/submit': {
				target: 'http://backend:3000',
				changeOrigin: true,
				rewrite: (path) => '/contact/interest',
			},
		},
	},
});
