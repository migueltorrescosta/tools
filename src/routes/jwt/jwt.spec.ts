import { describe, it, expect } from 'vitest';
import {
	base64UrlDecode,
	base64UrlDecodeBytes,
	base64UrlEncode,
	base64UrlEncodeBytes,
	decodeJwt,
	encodeJwt
} from '$lib/jwt';

// jwt.io sample token, also the page's initial token
const SAMPLE_JWT =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const SAMPLE_PAYLOAD = '.eyJzdWIiOiIxMjM0NTY3ODkwIn0.';

describe('base64url', () => {
	it.each([
		['Hello', 'SGVsbG8'],
		['Hello, World!', 'SGVsbG8sIFdvcmxkIQ'],
		['{"alg":"HS256","typ":"JWT"}', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'],
		['日本語', '5pel5pys6Kqe'],
		['👋', '8J-Riw'],
		['??>', 'Pz8-']
	])('encodes %j as %s and decodes it back', (plain, encoded) => {
		expect(base64UrlEncode(plain)).toBe(encoded);
		expect(base64UrlDecode(encoded)).toBe(plain);
	});

	it('uses the url-safe alphabet without padding for bytes', () => {
		expect(base64UrlEncodeBytes(new Uint8Array([0xfb, 0xff, 0xbf]))).toBe('-_-_');
		expect(base64UrlEncodeBytes(new Uint8Array([1]))).toBe('AQ');
		expect([...base64UrlDecodeBytes('-_-_')]).toEqual([0xfb, 0xff, 0xbf]);
	});

	it('rejects segments that are not valid UTF-8', () => {
		expect(() => base64UrlDecode('_w')).toThrow();
	});

	it('rejects characters outside the base64 alphabet', () => {
		expect(() => base64UrlDecode('invalid!!!')).toThrow();
	});
});

describe('decodeJwt', () => {
	it('decodes the jwt.io sample token', () => {
		expect(decodeJwt(SAMPLE_JWT)).toEqual({
			header: { alg: 'HS256', typ: 'JWT' },
			payload: { sub: '1234567890', name: 'John Doe', iat: 1516239022 },
			signature: 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
			formatError: '',
			headerError: '',
			payloadError: ''
		});
	});

	it.each(['part1.part2', 'a.b.c.d', 'nodots'])('reports a format error for %s', (t) => {
		const d = decodeJwt(t);
		expect(d.formatError).toBe('Invalid JWT format');
		expect(d.header).toBeUndefined();
		expect(d.payload).toBeUndefined();
	});

	it('reports a header error but still decodes the payload', () => {
		const d = decodeJwt('invalid!!!' + SAMPLE_PAYLOAD + 'sig');
		expect(d.headerError).toBe('Invalid header JSON');
		expect(d.header).toBeUndefined();
		expect(d.payloadError).toBe('');
		expect(d.payload).toEqual({ sub: '1234567890' });
		expect(d.signature).toBe('sig');
	});

	it('reports a header error for base64 that is not JSON', () => {
		const d = decodeJwt(`${base64UrlEncode('not json')}${SAMPLE_PAYLOAD}`);
		expect(d.headerError).toBe('Invalid header JSON');
	});

	it('reports a payload error but still decodes the header', () => {
		const d = decodeJwt(`eyJhbGciOiJIUzI1NiJ9.${base64UrlEncode('{oops')}.`);
		expect(d.header).toEqual({ alg: 'HS256' });
		expect(d.payloadError).toBe('Invalid payload JSON');
		expect(d.payload).toBeUndefined();
	});

	it('keeps an empty signature segment', () => {
		expect(decodeJwt(`eyJhbGciOiJub25lIn0${SAMPLE_PAYLOAD}`).signature).toBe('');
	});

	it('decodes non-object JSON values without error', () => {
		const d = decodeJwt(`${base64UrlEncode('null')}.${base64UrlEncode('[1,2]')}.`);
		expect(d.headerError).toBe('');
		expect(d.header).toBeNull();
		expect(d.payload).toEqual([1, 2]);
	});
});

describe('encodeJwt', () => {
	it('produces the sample header and payload segments with an empty signature', () => {
		const t = encodeJwt(
			{ alg: 'HS256', typ: 'JWT' },
			{ sub: '1234567890', name: 'John Doe', iat: 1516239022 }
		);
		const [h, p, s] = SAMPLE_JWT.split('.');
		expect(s).not.toBe('');
		expect(t).toBe(`${h}.${p}.`);
	});

	it('round-trips through decodeJwt, including unicode and nested claims', () => {
		const header = { alg: 'RS256', typ: 'JWT', kid: 'key-1' };
		const payload = { name: 'こんにちは 👋', nested: { a: [1, true, null] }, text: 'a\nb\t"c"' };
		const d = decodeJwt(encodeJwt(header, payload));
		expect(d.header).toEqual(header);
		expect(d.payload).toEqual(payload);
	});
});
