// JWT - base64url codec, decoding and encoding shared by the /jwt page and its spec

export const ALGORITHMS = [
	'HS256',
	'HS384',
	'HS512',
	'RS256',
	'RS384',
	'RS512',
	'ES256',
	'ES384',
	'ES512',
	'PS256',
	'PS384',
	'PS512',
	'none'
] as const;

// --- base64url ---

export function base64UrlEncodeBytes(bytes: Uint8Array): string {
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function base64UrlDecodeBytes(str: string): Uint8Array<ArrayBuffer> {
	str = str.replace(/-/g, '+').replace(/_/g, '/');
	while (str.length % 4) str += '=';
	const bin = atob(str);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

export function base64UrlEncode(str: string): string {
	return base64UrlEncodeBytes(new TextEncoder().encode(str));
}

/** Decodes base64url to a UTF-8 string. Throws on invalid base64 or invalid UTF-8. */
export function base64UrlDecode(str: string): string {
	return new TextDecoder('utf-8', { fatal: true }).decode(base64UrlDecodeBytes(str));
}

// --- decode ---

export interface DecodedJwt {
	/** Parsed header object; undefined when it could not be decoded or is not an object. */
	header: JsonObject | undefined;
	/** Parsed payload object; undefined when it could not be decoded or is not an object. */
	payload: JsonObject | undefined;
	signature: string;
	/** Set when the signature segment is not base64url. */
	signatureError: string;
	/** Set when the token is not three dot-separated segments; header/payload are then undefined. */
	formatError: string;
	headerError: string;
	payloadError: string;
}

/** A JWT header or claims set: a JSON object (RFC 7515 4, RFC 7519 7.2). */
export type JsonObject = Record<string, unknown>;

export function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type SegmentName = 'Header' | 'Payload';

const BASE64URL = /^[A-Za-z0-9_-]*$/;

function charsetError(segment: string, name: SegmentName | 'Signature'): string {
	return BASE64URL.test(segment)
		? ''
		: `${name} contains characters outside base64url (A-Z a-z 0-9 - _)`;
}

/** Strips surrounding whitespace and an `Authorization: Bearer` prefix from a pasted token. */
export function normalizeToken(token: string): string {
	return token.trim().replace(/^Bearer\s+/i, '');
}

/** Decodes one segment to a JSON object, naming the first layer that fails. */
function parseSegment(
	segment: string,
	name: SegmentName
): { ok: true; value: JsonObject } | { ok: false; error: string } {
	const charset = charsetError(segment, name);
	if (charset) return { ok: false, error: charset };
	let bytes: Uint8Array<ArrayBuffer>;
	try {
		bytes = base64UrlDecodeBytes(segment);
	} catch {
		return { ok: false, error: `${name} is not base64url` };
	}
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return { ok: false, error: `${name} is not valid UTF-8` };
	}
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return { ok: false, error: `${name} is not valid JSON` };
	}
	if (!isJsonObject(value)) return { ok: false, error: `${name} must be a JSON object` };
	return { ok: true, value };
}

export function decodeJwt(token: string): DecodedJwt {
	const result: DecodedJwt = {
		header: undefined,
		payload: undefined,
		signature: '',
		signatureError: '',
		formatError: '',
		headerError: '',
		payloadError: ''
	};
	const parts = normalizeToken(token).split('.');
	if (parts.length !== 3) {
		result.formatError = 'Invalid JWT format';
		return result;
	}
	const header = parseSegment(parts[0], 'Header');
	if (header.ok) result.header = header.value;
	else result.headerError = header.error;
	const payload = parseSegment(parts[1], 'Payload');
	if (payload.ok) result.payload = payload.value;
	else result.payloadError = payload.error;
	result.signature = parts[2];
	result.signatureError = charsetError(parts[2], 'Signature');
	return result;
}

// --- encode ---

/** Serializes header and payload into the signing input `<header>.<payload>`. */
export function signingInput(header: unknown, payload: unknown): string {
	return `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
}

export type EncodeInputs =
	| { ok: true; header: JsonObject; payload: JsonObject }
	| { ok: false; headerError: string; payloadError: string };

function parseObjectText(text: string, name: SegmentName): JsonObject | string {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return `Invalid ${name.toLowerCase()} JSON`;
	}
	return isJsonObject(value) ? value : `${name} must be a JSON object`;
}

/**
 * Parses the ENCODE textareas. Both must be JSON objects; the header gets `alg` and `typ: JWT`
 * set so the token claims the algorithm it is signed with.
 */
export function parseEncodeInputs(
	headerJson: string,
	payloadJson: string,
	alg: string
): EncodeInputs {
	const header = parseObjectText(headerJson, 'Header');
	const payload = parseObjectText(payloadJson, 'Payload');
	if (typeof header === 'string' || typeof payload === 'string') {
		return {
			ok: false,
			headerError: typeof header === 'string' ? header : '',
			payloadError: typeof payload === 'string' ? payload : ''
		};
	}
	return { ok: true, header: { ...header, alg, typ: 'JWT' }, payload };
}

/** Builds an unsigned token `<header>.<payload>.` (empty signature segment). */
export function encodeJwt(header: unknown, payload: unknown): string {
	return `${signingInput(header, payload)}.`;
}

// --- verify ---

export type VerifyResult =
	| { status: 'valid' }
	| { status: 'invalid'; message: string }
	| { status: 'unsupported'; message: string }
	| { status: 'error'; message: string };

type Family = 'HS' | 'RS' | 'PS' | 'ES';

interface AlgSpec {
	family: Family;
	hash: 'SHA-256' | 'SHA-384' | 'SHA-512';
	bits: 256 | 384 | 512;
}

const EC_CURVES = { 256: 'P-256', 384: 'P-384', 512: 'P-521' } as const;

export function algSpec(alg: string): AlgSpec | null {
	const m = /^(HS|RS|PS|ES)(256|384|512)$/.exec(alg);
	if (!m) return null;
	const bits = Number(m[2]) as AlgSpec['bits'];
	return { family: m[1] as Family, hash: `SHA-${bits}`, bits };
}

export function isSymmetric(alg: string): boolean {
	return algSpec(alg)?.family === 'HS';
}

function importParams(spec: AlgSpec): RsaHashedImportParams | EcKeyImportParams | HmacImportParams {
	switch (spec.family) {
		case 'HS':
			return { name: 'HMAC', hash: spec.hash };
		case 'RS':
			return { name: 'RSASSA-PKCS1-v1_5', hash: spec.hash };
		case 'PS':
			return { name: 'RSA-PSS', hash: spec.hash };
		case 'ES':
			return { name: 'ECDSA', namedCurve: EC_CURVES[spec.bits] };
	}
}

function signParams(spec: AlgSpec): AlgorithmIdentifier | RsaPssParams | EcdsaParams {
	switch (spec.family) {
		case 'HS':
			return 'HMAC';
		case 'RS':
			return 'RSASSA-PKCS1-v1_5';
		case 'PS':
			return { name: 'RSA-PSS', saltLength: spec.bits / 8 };
		case 'ES':
			return { name: 'ECDSA', hash: spec.hash };
	}
}

function parseJwk(text: string): JsonWebKey | null {
	if (!text.trim().startsWith('{')) return null;
	try {
		const jwk: unknown = JSON.parse(text);
		return jwk && typeof jwk === 'object' && 'kty' in jwk ? (jwk as JsonWebKey) : null;
	} catch {
		return null;
	}
}

function pemBody(text: string, label: string): Uint8Array<ArrayBuffer> | null {
	const m = new RegExp(`-----BEGIN ${label}-----([\\s\\S]*?)-----END ${label}-----`).exec(text);
	if (!m) return null;
	return base64UrlDecodeBytes(m[1].replace(/\s+/g, '').replace(/=+$/, ''));
}

const PRIVATE_JWK_MEMBERS = ['d', 'p', 'q', 'dp', 'dq', 'qi'] as const;

const KTY: Record<Family, string> = { HS: 'oct', RS: 'RSA', PS: 'RSA', ES: 'EC' };

/**
 * Imports `keyText` for `alg` and `usage`. HS* takes the secret as UTF-8 text (or an oct JWK);
 * RS/PS/ES take a PEM (SPKI public key or PKCS#8 private key; signing needs the private one) or a JWK.
 * Throws an Error with a user-facing message when the key does not fit the algorithm.
 */
export async function importJwtKey(
	keyText: string,
	alg: string,
	usage: 'verify' | 'sign'
): Promise<CryptoKey> {
	const spec = algSpec(alg);
	if (!spec) throw new Error(`Unsupported algorithm ${alg}`);
	const params = importParams(spec);
	const jwk = parseJwk(keyText);
	if (jwk) {
		if (jwk.kty !== KTY[spec.family]) {
			throw new Error(`A ${jwk.kty} key cannot be used with ${alg}`);
		}
		if (usage === 'sign' && jwk.kty !== 'oct' && !jwk.d) {
			throw new Error(`Signing ${alg} needs a private key; this JWK is public`);
		}
		// Drop alg (checked by the caller) and, for verify, the private members so a full
		// key pair JWK imports as its public half.
		const material: JsonWebKey = { ...jwk };
		delete material.alg;
		delete material.key_ops;
		if (usage === 'verify') for (const k of PRIVATE_JWK_MEMBERS) delete material[k];
		return crypto.subtle.importKey('jwk', material, params, false, [usage]);
	}
	if (spec.family === 'HS') {
		if (keyText.includes('-----BEGIN')) {
			throw new Error(`A PEM key cannot be used as an ${alg} secret`);
		}
		return crypto.subtle.importKey('raw', new TextEncoder().encode(keyText), params, false, [
			usage
		]);
	}
	const privateDer = pemBody(keyText, 'PRIVATE KEY');
	if (usage === 'verify' && privateDer) {
		// A private key verifies through its public half, taken from the JWK export
		const priv = await crypto.subtle.importKey('pkcs8', privateDer, params, true, ['sign']);
		return importJwtKey(JSON.stringify(await crypto.subtle.exportKey('jwk', priv)), alg, usage);
	}
	const label = usage === 'verify' ? 'PUBLIC KEY' : 'PRIVATE KEY';
	const der = usage === 'verify' ? pemBody(keyText, label) : privateDer;
	if (!der) {
		throw new Error(`${alg} needs a PEM "${label}" or a JWK`);
	}
	return crypto.subtle.importKey(usage === 'verify' ? 'spki' : 'pkcs8', der, params, false, [
		usage
	]);
}

/**
 * Verifies the token's signature with `keyText` under `alg`. The header alg must equal `alg`
 * (no algorithm substitution) and `none` never verifies.
 */
export async function verifyJwt(
	token: string,
	keyText: string,
	alg: string
): Promise<VerifyResult> {
	const parts = normalizeToken(token).split('.');
	if (parts.length !== 3) return { status: 'invalid', message: 'Invalid JWT format' };
	const headerAlg = decodeJwt(token).header?.alg;
	if (alg === 'none' || headerAlg === 'none') {
		return { status: 'invalid', message: 'alg "none" is unsigned and never verifies' };
	}
	if (headerAlg !== alg) {
		return {
			status: 'invalid',
			message: `Header alg ${JSON.stringify(headerAlg)} does not match ${alg}`
		};
	}
	if (!algSpec(alg))
		return { status: 'unsupported', message: `Verification not supported for ${alg}` };
	if (charsetError(parts[2], 'Signature')) {
		return { status: 'invalid', message: 'Signature is not base64url' };
	}
	let signature: Uint8Array<ArrayBuffer>;
	try {
		signature = base64UrlDecodeBytes(parts[2]);
	} catch {
		return { status: 'invalid', message: 'Signature is not base64url' };
	}
	let key: CryptoKey;
	try {
		key = await importJwtKey(keyText, alg, 'verify');
	} catch (e) {
		return { status: 'error', message: e instanceof Error ? e.message : String(e) };
	}
	const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
	let ok: boolean;
	try {
		ok = await crypto.subtle.verify(signParams(algSpec(alg)!), key, signature, data);
	} catch (e) {
		return { status: 'error', message: e instanceof Error ? e.message : String(e) };
	}
	return ok ? { status: 'valid' } : { status: 'invalid', message: 'Signature does not match' };
}

// --- sign ---

/**
 * Builds a signed token. HS* signs with the secret, RS/PS/ES with a PKCS#8 PEM or private JWK,
 * and `none` yields an unsigned token with an empty signature segment. Throws an Error with a
 * user-facing message when the algorithm or key cannot sign, so no token falsely claims a signature.
 */
export async function signJwt(
	header: unknown,
	payload: unknown,
	keyText: string,
	alg: string
): Promise<string> {
	if (alg === 'none') return encodeJwt(header, payload);
	const spec = algSpec(alg);
	if (!spec) throw new Error(`Signing not supported for ${alg}`);
	if (!keyText) {
		throw new Error(
			spec.family === 'HS'
				? `Enter a secret to sign ${alg}`
				: `Signing ${alg} needs a private key (PKCS#8 PEM or JWK)`
		);
	}
	const key = await importJwtKey(keyText, alg, 'sign');
	const input = signingInput(header, payload);
	const sig = await crypto.subtle.sign(signParams(spec), key, new TextEncoder().encode(input));
	return `${input}.${base64UrlEncodeBytes(new Uint8Array(sig))}`;
}
