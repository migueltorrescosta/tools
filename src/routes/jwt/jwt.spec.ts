import { describe, it, expect } from 'vitest';
import {
	base64UrlDecode,
	base64UrlDecodeBytes,
	base64UrlEncode,
	base64UrlEncodeBytes,
	decodeJwt,
	describeClaims,
	formatRelative,
	encodeJwt,
	inspectJson,
	jsonWarnings,
	parseEncodeInputs,
	algorithmOptions,
	headerAlgWarning,
	headerJsonAlg,
	withHeaderAlg,
	signJwt,
	signingInput,
	unsignedReason,
	tokenView,
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
			headerText: '{"alg":"HS256","typ":"JWT"}',
			payloadText: '{"sub":"1234567890","name":"John Doe","iat":1516239022}',
			signature: 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
			signatureError: '',
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
		expect(d.headerError).toBe('Header contains characters outside base64url (A-Z a-z 0-9 - _)');
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

	it.each([' ', '\n', '\r\n', '\t ', 'Bearer ', 'bearer  ', '  Bearer\t'])(
		'ignores %j before and whitespace after a pasted token',
		(prefix) => {
			const d = decodeJwt(`${prefix}${SAMPLE_JWT}\n `);
			expect(d.headerError).toBe('');
			expect(d.header).toEqual({ alg: 'HS256', typ: 'JWT' });
			expect(d.signature).toBe('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
		}
	);

	it('rejects +, / and = in any segment with a specific error', () => {
		const [h, p, sig] = SAMPLE_JWT.split('.');
		expect(decodeJwt(`${h}=.${p}.${sig}`).headerError).toMatch(/Header contains characters/);
		expect(decodeJwt(`${h}.${p}+.${sig}`).payloadError).toMatch(/Payload contains characters/);
		expect(decodeJwt(`${h}.${p}.${sig}/=`).signatureError).toMatch(/Signature contains characters/);
	});

	it('reports a segment of impossible base64 length as not base64url', () => {
		expect(decodeJwt(`eyJhb${SAMPLE_PAYLOAD}`).headerError).toBe('Header is not base64url');
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

describe('inspectJson', () => {
	it.each([
		'{"sub":"1234567890","name":"John Doe","iat":1516239022}',
		'{"a":[1,{"b":null,"c":[]},{}],"d":"x\\"y,\\\\","e":-1.5,"f":true}',
		'[]',
		'"s"',
		' { "a" : [ 1 , 2 ] } '
	])('matches JSON.stringify(_, null, 2) for ordinary JSON %s', (raw) => {
		expect(inspectJson(raw)).toEqual({
			pretty: JSON.stringify(JSON.parse(raw), null, 2),
			warnings: []
		});
	});

	it('keeps large integers, overflow and duplicate keys verbatim and warns about each', () => {
		const raw = '{"id":12345678901234567890,"big":1e400,"neg":-1E999,"dup":1,"dup":2}';
		const { pretty, warnings } = inspectJson(raw);
		expect(pretty).toBe(
			'{\n  "id": 12345678901234567890,\n  "big": 1e400,\n  "neg": -1E999,\n  "dup": 1,\n  "dup": 2\n}'
		);
		expect(warnings).toEqual([
			'Integer 12345678901234567890 exceeds 2^53 and is read as 12345678901234567000',
			'Number 1e400 overflows and is read as Infinity',
			'Number -1E999 overflows and is read as -Infinity',
			'Duplicate key "dup": only the last value is kept'
		]);
	});

	it('keeps number spelling such as exponents and trailing zeros', () => {
		expect(inspectJson('[-1.5e-3,1.0,1E2]').pretty).toBe('[\n  -1.5e-3,\n  1.0,\n  1E2\n]');
	});

	it('does not flag safe integers, decimals or equal keys in different objects', () => {
		const raw = '{"n":9007199254740991,"x":1.5,"a":{"k":1},"b":{"k":2}}';
		expect(inspectJson(raw).warnings).toEqual([]);
	});

	it('treats keys equal after unescaping as duplicates', () => {
		expect(inspectJson('{"a":1,"\\u0061":2}').warnings).toEqual([
			'Duplicate key "\\u0061": only the last value is kept'
		]);
	});

	it('jsonWarnings ignores text that is not JSON', () => {
		expect(jsonWarnings('{oops')).toEqual([]);
		expect(jsonWarnings('{"a":1,"a":2}')).toHaveLength(1);
	});
});

describe('tokenView', () => {
	it('shows the probe payload verbatim with warnings instead of rounded values', () => {
		const raw = '{"id":12345678901234567890,"big":1e400,"dup":1,"dup":2}';
		const v = tokenView(`eyJhbGciOiJIUzI1NiJ9.${base64UrlEncode(raw)}.sig`);
		expect(v.payloadJson).toContain('"id": 12345678901234567890');
		expect(v.payloadJson).toContain('"big": 1e400');
		expect(v.payloadJson).toContain('"dup": 1,\n  "dup": 2');
		expect(v.warnings).toEqual([
			'Payload: Integer 12345678901234567890 exceeds 2^53 and is read as 12345678901234567000',
			'Payload: Number 1e400 overflows and is read as Infinity',
			'Payload: Duplicate key "dup": only the last value is kept'
		]);
	});

	const CLEARED = {
		headerJson: '',
		payloadJson: '',
		payloadError: '',
		warnings: [],
		signature: '',
		signatureError: '',
		alg: null,
		payload: undefined,
		unsigned: ''
	};

	it('shows the sample token fully', () => {
		const v = tokenView(SAMPLE_JWT);
		expect(v.headerError).toBe('');
		expect(JSON.parse(v.headerJson)).toEqual({ alg: 'HS256', typ: 'JWT' });
		expect(v.payloadJson).toContain('"name": "John Doe"');
		expect(v.signature).toBe('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
		expect(v.alg).toBe('HS256');
	});

	it('resets every field for an empty token', () => {
		expect(tokenView('  ')).toEqual({
			...CLEARED,
			headerJson: '{\n  "alg": "",\n  "typ": "JWT"\n}',
			headerError: ''
		});
	});

	it.each([
		['a.b', 'Invalid JWT format'],
		[SAMPLE_JWT.replace('.', ''), 'Invalid JWT format'],
		['a.b.c.d.e', 'JWE (encrypted) tokens are not supported']
	])('clears payload and signature for malformed %s', (t, error) => {
		expect(tokenView(t)).toEqual({ ...CLEARED, headerError: error });
	});
});

describe('describeClaims', () => {
	// 2026-10-08T12:00:00Z
	const NOW = Date.UTC(2026, 9, 8, 12) as number;
	const NOW_S = NOW / 1000;

	it('gives ISO dates and relative times for exp, nbf and iat', () => {
		const c = describeClaims({ iat: NOW_S - 3600, nbf: NOW_S - 60, exp: NOW_S + 300 }, NOW);
		expect(c.times).toEqual([
			{
				name: 'exp',
				seconds: NOW_S + 300,
				iso: '2026-10-08T12:05:00.000Z',
				relative: 'in 5 minutes'
			},
			{
				name: 'nbf',
				seconds: NOW_S - 60,
				iso: '2026-10-08T11:59:00.000Z',
				relative: '1 minute ago'
			},
			{
				name: 'iat',
				seconds: NOW_S - 3600,
				iso: '2026-10-08T11:00:00.000Z',
				relative: '1 hour ago'
			}
		]);
		expect(c).toMatchObject({
			expired: false,
			notYetValid: false,
			issuedInFuture: false,
			errors: []
		});
	});

	it('flags an expired token, including exactly at exp', () => {
		expect(describeClaims({ exp: NOW_S - 120 }, NOW).expired).toBe(true);
		expect(describeClaims({ exp: NOW_S - 120 }, NOW).times[0].relative).toBe('2 minutes ago');
		expect(describeClaims({ exp: NOW_S }, NOW).expired).toBe(true);
		expect(describeClaims({ exp: NOW_S + 1 }, NOW).expired).toBe(false);
	});

	it('flags a token not yet valid and one issued in the future', () => {
		const c = describeClaims({ nbf: NOW_S + 86400 * 3, iat: NOW_S + 10 }, NOW);
		expect(c.notYetValid).toBe(true);
		expect(c.issuedInFuture).toBe(true);
		expect(c.times[0].relative).toBe('in 3 days');
	});

	it('reports time claims that are not NumericDates', () => {
		const c = describeClaims({ exp: '2026-10-08', nbf: 1e20 }, NOW);
		expect(c.times).toEqual([]);
		expect(c.errors).toEqual([
			'exp must be a NumericDate (seconds since 1970), got "2026-10-08"',
			'nbf must be a NumericDate (seconds since 1970), got 100000000000000000000'
		]);
	});

	it('describes the jwt.io sample iat', () => {
		const c = describeClaims({ iat: 1516239022 }, NOW);
		expect(c.times[0].iso).toBe('2018-01-18T01:30:22.000Z');
		expect(c.times[0].relative).toBe('8 years ago');
	});

	it('formats relative distances in the largest whole unit', () => {
		expect(formatRelative(0)).toBe('now');
		expect(formatRelative(1)).toBe('in 1 second');
		expect(formatRelative(-59)).toBe('59 seconds ago');
		expect(formatRelative(7200)).toBe('in 2 hours');
	});
});

describe('unsignedReason', () => {
	it('flags alg none and an empty signature, and nothing for a signed token', () => {
		expect(unsignedReason({ alg: 'none' }, '')).toMatch(/alg "none", empty signature/);
		expect(unsignedReason({ alg: 'NONE' }, 'abc')).toMatch(/alg "none"/);
		expect(unsignedReason({ alg: 'HS256' }, '')).toMatch(/empty signature/);
		expect(unsignedReason({ alg: 'HS256' }, 'abc')).toBe('');
	});

	it('is set on the token view of an unsigned token', () => {
		const t = encodeJwt({ alg: 'none', typ: 'JWT' }, { sub: '1' });
		expect(tokenView(t).unsigned).toMatch(/^Unsigned token/);
		expect(tokenView(SAMPLE_JWT).unsigned).toBe('');
	});
});

describe('parseEncodeInputs', () => {
	const OBJ = '{"sub":"1"}';

	it('keeps the header alg and typ instead of overriding them with the selection', () => {
		expect(parseEncodeInputs('{"alg":"RS256","typ":"at+jwt"}', OBJ, 'HS256')).toEqual({
			ok: true,
			header: { alg: 'RS256', typ: 'at+jwt' },
			payload: { sub: '1' },
			alg: 'RS256'
		});
	});

	it.each(['{"kid":"k"}', '{"kid":"k","alg":""}'])(
		'fills a missing or empty alg from the selection and typ JWT for %s',
		(json) => {
			expect(parseEncodeInputs(json, OBJ, 'RS256')).toEqual({
				ok: true,
				header: { kid: 'k', alg: 'RS256', typ: 'JWT' },
				payload: { sub: '1' },
				alg: 'RS256'
			});
		}
	);

	it.each([
		['{"alg":5}', 'Header alg must be a string, got 5'],
		['{"alg":null}', 'Header alg must be a string, got null']
	])('rejects non-string alg in %s', (json, headerError) => {
		expect(parseEncodeInputs(json, OBJ, 'HS256')).toEqual({
			ok: false,
			headerError,
			payloadError: ''
		});
	});

	it.each(['null', '"x"', '42', 'true', '[1]'])(
		'rejects header %s as not an object instead of throwing',
		(json) => {
			expect(parseEncodeInputs(json, OBJ, 'HS256')).toEqual({
				ok: false,
				headerError: 'Header must be a JSON object',
				payloadError: ''
			});
		}
	);

	it.each(['null', '"hi"', '5', '[]'])('rejects payload %s as not a claims object', (json) => {
		expect(parseEncodeInputs('{}', json, 'HS256')).toEqual({
			ok: false,
			headerError: '',
			payloadError: 'Payload must be a JSON object'
		});
	});

	it('reports unparsable JSON in both fields at once', () => {
		expect(parseEncodeInputs('{', '{oops', 'HS256')).toEqual({
			ok: false,
			headerError: 'Invalid header JSON',
			payloadError: 'Invalid payload JSON'
		});
	});
});

describe('header alg sync', () => {
	it('reads a non-empty string alg from header JSON', () => {
		expect(headerJsonAlg('{"alg":"ES256K"}')).toBe('ES256K');
		expect(headerJsonAlg('{"alg":""}')).toBeNull();
		expect(headerJsonAlg('{"alg":1}')).toBeNull();
		expect(headerJsonAlg('{')).toBeNull();
	});

	it('writes the selected alg into header JSON and keeps other members', () => {
		const out = withHeaderAlg('{"alg":"HS256","typ":"at+jwt","kid":"k"}', 'RS256');
		expect(JSON.parse(out)).toEqual({ alg: 'RS256', typ: 'at+jwt', kid: 'k' });
	});

	it('leaves header JSON untouched when alg already matches or it is not an object', () => {
		const same = '{ "alg": "HS256" }';
		expect(withHeaderAlg(same, 'HS256')).toBe(same);
		expect(withHeaderAlg('{oops', 'HS256')).toBe('{oops');
		expect(withHeaderAlg('[1]', 'HS256')).toBe('[1]');
	});
});

describe('header alg options', () => {
	it('lists EdDSA', () => {
		expect(algorithmOptions('HS256')).toContain('EdDSA');
	});

	it('adds an unknown selected alg as its own option', () => {
		expect(algorithmOptions('HS256')).not.toContain('ES256K');
		expect(algorithmOptions('ES256K').at(-1)).toBe('ES256K');
	});

	it.each([
		['{"alg":"ES256K"}', 'ES256K', 'Header alg "ES256K" is not a known algorithm'],
		['{"alg":""}', null, 'Header alg is empty'],
		['{"alg":7}', null, 'Header alg must be a string, got 7'],
		['{"typ":"JWT"}', null, 'Header has no alg']
	])('tokenView of header %s selects %s and warns', (header, alg, warning) => {
		const v = tokenView(`${base64UrlEncode(header)}.${base64UrlEncode('{}')}.sig`);
		expect(v.alg).toBe(alg);
		expect(v.warnings).toEqual([warning]);
	});

	it('does not warn for a known alg', () => {
		expect(tokenView(SAMPLE_JWT).warnings).toEqual([]);
		expect(headerAlgWarning({ alg: 'EdDSA' })).toBe('');
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

	it('verifies a pasted token with surrounding whitespace or a Bearer prefix', async () => {
		expect(await verifyJwt(`\n Bearer ${SAMPLE_JWT}\n`, 'your-256-bit-secret', 'HS256')).toEqual({
			status: 'valid'
		});
	});

	it('rejects a signature with characters outside base64url', async () => {
		const r = await verifyJwt(`${SAMPLE_JWT.slice(0, -1)}+`, 'your-256-bit-secret', 'HS256');
		expect(r).toEqual({ status: 'invalid', message: 'Signature is not base64url' });
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
