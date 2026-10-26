import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { SECURITY_HEADERS, handle } from './hooks.server';

describe('handle', () => {
	it('adds the security headers to every rendered response', async () => {
		const response = await handle({
			event: {} as RequestEvent,
			resolve: async () => new Response('not found', { status: 404 })
		});
		expect(response.status).toBe(404);
		for (const [name, value] of Object.entries(SECURITY_HEADERS))
			expect(response.headers.get(name)).toBe(value);
		expect(response.headers.get('X-Frame-Options')).toBe('DENY');
	});
});
