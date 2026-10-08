import { describe, it, expect } from 'vitest';
import {
	base64UrlDecode,
	base64UrlDecodeBytes,
	base64UrlEncode,
	base64UrlEncodeBytes,
	decodeJwt,
	encodeJwt,
	signJwt,
	signingInput,
	verifyJwt
} from '$lib/jwt';
import { createHmac } from 'node:crypto';

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
		expect(d.headerError).toBe('Header is not base64url');
		expect(d.header).toBeUndefined();
		expect(d.payloadError).toBe('');
		expect(d.payload).toEqual({ sub: '1234567890' });
		expect(d.signature).toBe('sig');
	});

	it('reports a header error for base64 that is not JSON', () => {
		const d = decodeJwt(`${base64UrlEncode('not json')}${SAMPLE_PAYLOAD}`);
		expect(d.headerError).toBe('Header is not valid JSON');
	});

	it('reports a header error for bytes that are not UTF-8', () => {
		expect(decodeJwt(`_w${SAMPLE_PAYLOAD}`).headerError).toBe('Header is not valid UTF-8');
		expect(decodeJwt(`eyJhbGciOiJIUzI1NiJ9._w.`).payloadError).toBe('Payload is not valid UTF-8');
	});

	it('reports a payload error but still decodes the header', () => {
		const d = decodeJwt(`eyJhbGciOiJIUzI1NiJ9.${base64UrlEncode('{oops')}.`);
		expect(d.header).toEqual({ alg: 'HS256' });
		expect(d.payloadError).toBe('Payload is not valid JSON');
		expect(d.payload).toBeUndefined();
	});

	it('keeps an empty signature segment', () => {
		expect(decodeJwt(`eyJhbGciOiJub25lIn0${SAMPLE_PAYLOAD}`).signature).toBe('');
	});

	it.each(['null', '"x"', '42', 'true', '[1]'])(
		'rejects valid JSON %s that is not an object, in header and payload',
		(json) => {
			const d = decodeJwt(`${base64UrlEncode(json)}.${base64UrlEncode(json)}.`);
			expect(d.headerError).toBe('Header must be a JSON object');
			expect(d.payloadError).toBe('Payload must be a JSON object');
			expect(d.header).toBeUndefined();
			expect(d.payload).toBeUndefined();
		}
	);

	it('decodes the header null segment bnVsbA as a non-object, not invalid JSON', () => {
		expect(decodeJwt(`bnVsbA${SAMPLE_PAYLOAD}`).headerError).toBe('Header must be a JSON object');
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

// Independent oracle: node:crypto HMAC, not the module's WebCrypto path
function hmacToken(alg: 'HS256' | 'HS384' | 'HS512', payload: object, secret: string): string {
	const input = signingInput({ alg, typ: 'JWT' }, payload);
	const sig = createHmac(`sha${alg.slice(2)}`, secret)
		.update(input)
		.digest('base64url');
	return `${input}.${sig}`;
}

function flipPayloadByte(token: string): string {
	const [h, p, s] = token.split('.');
	const c = p[3] === 'A' ? 'B' : 'A';
	return `${h}.${p.slice(0, 3)}${c}${p.slice(4)}.${s}`;
}

function toPem(der: ArrayBuffer, label: string): string {
	const b64 = btoa(String.fromCharCode(...new Uint8Array(der)));
	return `-----BEGIN ${label}-----\n${b64.replace(/(.{64})/g, '$1\n')}\n-----END ${label}-----`;
}

const ASYMMETRIC = {
	RS256: { gen: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, sign: 'RSASSA-PKCS1-v1_5' },
	RS512: { gen: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' }, sign: 'RSASSA-PKCS1-v1_5' },
	PS256: { gen: { name: 'RSA-PSS', hash: 'SHA-256' }, sign: { name: 'RSA-PSS', saltLength: 32 } },
	PS384: { gen: { name: 'RSA-PSS', hash: 'SHA-384' }, sign: { name: 'RSA-PSS', saltLength: 48 } },
	ES256: { gen: { name: 'ECDSA', namedCurve: 'P-256' }, sign: { name: 'ECDSA', hash: 'SHA-256' } },
	ES384: { gen: { name: 'ECDSA', namedCurve: 'P-384' }, sign: { name: 'ECDSA', hash: 'SHA-384' } },
	ES512: { gen: { name: 'ECDSA', namedCurve: 'P-521' }, sign: { name: 'ECDSA', hash: 'SHA-512' } }
} as const;

async function asymmetricToken(alg: keyof typeof ASYMMETRIC) {
	const { gen, sign } = ASYMMETRIC[alg];
	const params =
		gen.name === 'ECDSA'
			? gen
			: { ...gen, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) };
	const pair = (await crypto.subtle.generateKey(params, true, ['sign', 'verify'])) as CryptoKeyPair;
	const input = signingInput({ alg, typ: 'JWT' }, { sub: 'x' });
	const sig = await crypto.subtle.sign(sign, pair.privateKey, new TextEncoder().encode(input));
	return {
		token: `${input}.${base64UrlEncodeBytes(new Uint8Array(sig))}`,
		pem: toPem(await crypto.subtle.exportKey('spki', pair.publicKey), 'PUBLIC KEY'),
		privatePem: toPem(await crypto.subtle.exportKey('pkcs8', pair.privateKey), 'PRIVATE KEY'),
		publicKey: pair.publicKey,
		publicJwk: JSON.stringify(await crypto.subtle.exportKey('jwk', pair.publicKey)),
		privateJwk: JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey))
	};
}

describe('verifyJwt', () => {
	it('verifies the jwt.io sample with its secret and rejects a wrong one', async () => {
		expect(await verifyJwt(SAMPLE_JWT, 'your-256-bit-secret', 'HS256')).toEqual({
			status: 'valid'
		});
		expect((await verifyJwt(SAMPLE_JWT, 'wrong-secret', 'HS256')).status).toBe('invalid');
	});

	it('rejects the sample token after a payload byte is flipped', async () => {
		const r = await verifyJwt(flipPayloadByte(SAMPLE_JWT), 'your-256-bit-secret', 'HS256');
		expect(r.status).toBe('invalid');
	});

	it.each(['HS256', 'HS384', 'HS512'] as const)(
		'verifies %s against a node:crypto HMAC',
		async (alg) => {
			const t = hmacToken(alg, { sub: 'abc', n: 1 }, 's3cr3t');
			expect(await verifyJwt(t, 's3cr3t', alg)).toEqual({ status: 'valid' });
			expect((await verifyJwt(t, 's3cr3T', alg)).status).toBe('invalid');
			expect((await verifyJwt(flipPayloadByte(t), 's3cr3t', alg)).status).toBe('invalid');
		}
	);

	it('accepts an oct JWK as an HMAC secret', async () => {
		const jwk = JSON.stringify({ kty: 'oct', k: base64UrlEncode('your-256-bit-secret') });
		expect(await verifyJwt(SAMPLE_JWT, jwk, 'HS256')).toEqual({ status: 'valid' });
	});

	it.each(Object.keys(ASYMMETRIC) as (keyof typeof ASYMMETRIC)[])(
		'verifies %s with a PEM or JWK public key',
		async (alg) => {
			const { token, pem, publicJwk, privateJwk } = await asymmetricToken(alg);
			expect(await verifyJwt(token, pem, alg)).toEqual({ status: 'valid' });
			expect(await verifyJwt(token, publicJwk, alg)).toEqual({ status: 'valid' });
			expect(await verifyJwt(token, privateJwk, alg)).toEqual({ status: 'valid' });
			expect((await verifyJwt(flipPayloadByte(token), pem, alg)).status).toBe('invalid');
			const other = await asymmetricToken(alg);
			expect((await verifyJwt(token, other.pem, alg)).status).toBe('invalid');
		},
		20000
	);

	it('never verifies alg none, whatever the key', async () => {
		const t = encodeJwt({ alg: 'none' }, { sub: 'x' });
		expect((await verifyJwt(t, '', 'none')).status).toBe('invalid');
		expect((await verifyJwt(t, 'secret', 'HS256')).status).toBe('invalid');
	});

	it('refuses a token whose header alg differs from the chosen alg', async () => {
		const r = await verifyJwt(SAMPLE_JWT, 'your-256-bit-secret', 'HS512');
		expect(r).toEqual({ status: 'invalid', message: 'Header alg "HS256" does not match HS512' });
	});

	it('refuses a public key used as an HMAC secret (alg confusion)', async () => {
		const { pem, publicJwk } = await asymmetricToken('ES256');
		const forged = hmacToken('HS256', { sub: 'x' }, pem);
		expect((await verifyJwt(forged, pem, 'HS256')).status).toBe('error');
		expect((await verifyJwt(forged, publicJwk, 'HS256')).status).toBe('error');
	});

	it('refuses an HMAC secret or mismatched key type for asymmetric algs', async () => {
		const { token } = await asymmetricToken('ES256');
		expect((await verifyJwt(token, 'secret', 'ES256')).status).toBe('error');
		const rsa = await asymmetricToken('RS256');
		expect((await verifyJwt(token, rsa.publicJwk, 'ES256')).status).toBe('error');
		expect((await verifyJwt(token, rsa.pem, 'ES256')).status).toBe('error');
	});

	it('reports unsupported algorithms instead of guessing', async () => {
		const t = `${base64UrlEncode('{"alg":"EdDSA"}')}.e30.AAAA`;
		expect(await verifyJwt(t, 'k', 'EdDSA')).toEqual({
			status: 'unsupported',
			message: 'Verification not supported for EdDSA'
		});
	});

	it('rejects malformed tokens and signatures', async () => {
		expect((await verifyJwt('a.b', 'k', 'HS256')).status).toBe('invalid');
		const [h, p] = SAMPLE_JWT.split('.');
		expect((await verifyJwt(`${h}.${p}.!!!`, 'your-256-bit-secret', 'HS256')).status).toBe(
			'invalid'
		);
	});
});

describe('signJwt', () => {
	const samplePayload = { sub: '1234567890', name: 'John Doe', iat: 1516239022 };

	it('reproduces the jwt.io sample token for HS256', async () => {
		const t = await signJwt(
			{ alg: 'HS256', typ: 'JWT' },
			samplePayload,
			'your-256-bit-secret',
			'HS256'
		);
		expect(t).toBe(SAMPLE_JWT);
	});

	it.each(['HS256', 'HS384', 'HS512'] as const)(
		'matches a node:crypto HMAC for %s',
		async (alg) => {
			const payload = { sub: 'abc', n: 1 };
			const t = await signJwt({ alg, typ: 'JWT' }, payload, 's3cr3t', alg);
			expect(t).toBe(hmacToken(alg, payload, 's3cr3t'));
			expect(t.split('.')[2]).not.toBe('');
		}
	);

	it.each(Object.keys(ASYMMETRIC) as (keyof typeof ASYMMETRIC)[])(
		'signs %s with a private PEM or JWK so the public key verifies it',
		async (alg) => {
			const { pem, privatePem, privateJwk, publicJwk, publicKey } = await asymmetricToken(alg);
			for (const key of [privatePem, privateJwk]) {
				const t = await signJwt({ alg, typ: 'JWT' }, { sub: 'y' }, key, alg);
				const [h, p, sig] = t.split('.');
				const ok = await crypto.subtle.verify(
					ASYMMETRIC[alg].sign,
					publicKey,
					base64UrlDecodeBytes(sig),
					new TextEncoder().encode(`${h}.${p}`)
				);
				expect(ok).toBe(true);
				expect(await verifyJwt(t, pem, alg)).toEqual({ status: 'valid' });
				expect(await verifyJwt(t, privatePem, alg)).toEqual({ status: 'valid' });
			}
			await expect(signJwt({ alg }, {}, pem, alg)).rejects.toThrow('PRIVATE KEY');
			await expect(signJwt({ alg }, {}, publicJwk, alg)).rejects.toThrow('private key');
		},
		20000
	);

	it('refuses to sign without a key instead of emitting an empty signature', async () => {
		await expect(signJwt({ alg: 'HS256' }, {}, '', 'HS256')).rejects.toThrow(
			'Enter a secret to sign HS256'
		);
		await expect(signJwt({ alg: 'RS256' }, {}, '', 'RS256')).rejects.toThrow('private key');
		await expect(signJwt({ alg: 'RS256' }, {}, 'a-secret', 'RS256')).rejects.toThrow('PRIVATE KEY');
	});

	it('refuses algorithms it cannot sign', async () => {
		await expect(signJwt({ alg: 'EdDSA' }, {}, 'k', 'EdDSA')).rejects.toThrow(
			'Signing not supported for EdDSA'
		);
	});

	it('emits an empty signature only for alg none', async () => {
		const t = await signJwt({ alg: 'none' }, { sub: 'x' }, 'ignored', 'none');
		expect(t).toBe(encodeJwt({ alg: 'none' }, { sub: 'x' }));
		expect(t.endsWith('.')).toBe(true);
	});
});
