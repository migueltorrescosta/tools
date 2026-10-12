// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// No route reads `platform`, so it stays empty and any use of it fails the type check.
		// To add bindings: `import '@sveltejs/adapter-cloudflare';` above (types ctx, caches, cf) and declare `env` here.
		// interface Platform {}
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
