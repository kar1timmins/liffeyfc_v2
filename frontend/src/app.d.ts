// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

// Extend ImportMeta interface for Vite environment variables
interface ImportMeta {
	readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
	readonly DEV: boolean;
	readonly PROD: boolean;
	readonly SSR: boolean;
	readonly MODE: string;
	// Add other Vite env variables as needed
	[key: string]: any;
}

export {};
