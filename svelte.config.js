import adapter from '@sveltejs/adapter-cloudflare';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';

// SvelteKit hashes the scripts it emits itself; inline scripts in app.html (the theme script)
// need their own hashes.
const appHtml = readFileSync(new URL('./src/app.html', import.meta.url), 'utf8');
const appHtmlHashes = [...appHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
	([, body]) =>
		/** @type {const} */ (`sha256-${createHash('sha256').update(body).digest('base64')}`)
);

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// defaults to rune mode for the project, except for `node_modules`. Can be removed in svelte 6.
		runes: ({ filename }) => {
			const relativePath = relative(import.meta.dirname, filename);
			const pathSegments = relativePath.toLowerCase().split(sep);
			const isExternalLibrary = pathSegments.includes('node_modules');

			return isExternalLibrary ? undefined : true;
		}
	},
	kit: {
		adapter: adapter(),
		// Every page prerenders, so the policy ships as a <meta> tag, which ignores frame-ancestors:
		// _headers sends that for static pages and gives workers their own policy. Pages the
		// worker renders (404s) get this policy as a header, frame-ancestors included.
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				'script-src': ['self', ...appHtmlHashes],
				// Svelte and KaTeX write style attributes, which hashes can't cover.
				'style-src': ['self', 'unsafe-inline'],
				// QR codes (rank-vote) are data: URLs.
				'img-src': ['self', 'data:'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;
