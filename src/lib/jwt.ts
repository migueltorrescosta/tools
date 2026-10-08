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

export function base64UrlDecodeBytes(str: string): Uint8Array {
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
	/** Parsed header JSON; undefined when it could not be decoded. */
	header: unknown;
	/** Parsed payload JSON; undefined when it could not be decoded. */
	payload: unknown;
	signature: string;
	/** Set when the token is not three dot-separated segments; header/payload are then undefined. */
	formatError: string;
	headerError: string;
	payloadError: string;
}

function parseSegment(segment: string): { ok: true; value: unknown } | { ok: false } {
	try {
		return { ok: true, value: JSON.parse(base64UrlDecode(segment)) };
	} catch {
		return { ok: false };
	}
}

export function decodeJwt(token: string): DecodedJwt {
	const result: DecodedJwt = {
		header: undefined,
		payload: undefined,
		signature: '',
		formatError: '',
		headerError: '',
		payloadError: ''
	};
	const parts = token.split('.');
	if (parts.length !== 3) {
		result.formatError = 'Invalid JWT format';
		return result;
	}
	const header = parseSegment(parts[0]);
	if (header.ok) result.header = header.value;
	else result.headerError = 'Invalid header JSON';
	const payload = parseSegment(parts[1]);
	if (payload.ok) result.payload = payload.value;
	else result.payloadError = 'Invalid payload JSON';
	result.signature = parts[2];
	return result;
}

// --- encode ---

/** Serializes header and payload into the signing input `<header>.<payload>`. */
export function signingInput(header: unknown, payload: unknown): string {
	return `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
}

/** Builds an unsigned token `<header>.<payload>.` (empty signature segment). */
export function encodeJwt(header: unknown, payload: unknown): string {
	return `${signingInput(header, payload)}.`;
}
