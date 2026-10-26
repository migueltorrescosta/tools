import type { Handle } from '@sveltejs/kit';

/**
 * Headers for responses the worker renders (404s and other errors). Prerendered pages and
 * assets get the same headers from _headers; the CSP comes from kit.csp (svelte.config.js).
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'X-Frame-Options': 'DENY'
};

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
	return response;
};
