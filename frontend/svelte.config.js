// Switched from Netlify adapter to static for Apache (Blacknight) hosting
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: true,
			// Allow dynamic routes with fallback
			strict: false
		}),
		prerender: {
			entries: ['*', '/pitch', '/learnMore'],
			handleUnseenRoutes: 'ignore' // Ignore unseen dynamic routes during prerender
		}
	}
};

export default config;
