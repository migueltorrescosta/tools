/**
 * Reusable cryptographic encoding utilities
 */

const BASE64_CHUNK = 0x8000;

/**
 * Encode a string to Base64 (UTF-8 bytes, standard alphabet, padded)
 * @param str - The string to encode
 * @returns Base64 encoded string
 */
export function base64Encode(str: string): string {
	const bytes = new TextEncoder().encode(str);
	let binary = '';
	for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK));
	}
	return btoa(binary);
}

/**
 * Decode a Base64 string. Whitespace is ignored, the URL-safe alphabet (- and _) is accepted,
 * and missing padding is restored.
 * @param str - The Base64 string to decode
 * @returns Decoded string
 * @throws If the input is not base64 or the decoded bytes are not valid UTF-8
 */
export function base64Decode(str: string): string {
	const body = str.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
	if (!/^[A-Za-z0-9+/]*$/.test(body)) {
		throw new Error(
			'Invalid base64: only A-Z, a-z, 0-9, +, /, - and _ are allowed, with = padding only at the end'
		);
	}
	if (body.length % 4 === 1) {
		throw new Error('Invalid base64: length is not a whole number of bytes');
	}
	const padded = body + '='.repeat((4 - (body.length % 4)) % 4);
	const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		throw new Error('Base64 bytes are not valid UTF-8 text');
	}
}

/**
 * Encode a string to hexadecimal
 * @param str - The string to encode
 * @returns Hexadecimal encoded string
 */
export function toHex(str: string): string {
	return Array.from(new TextEncoder().encode(str))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Decode a hexadecimal string. Whitespace and one leading 0x are ignored.
 * @param hex - The hex string to decode
 * @returns Decoded string
 * @throws If the input is not whole hex bytes or the bytes are not valid UTF-8
 */
export function fromHex(hex: string): string {
	const digits = hex.replace(/\s+/g, '').replace(/^0x/i, '');
	if (!/^[0-9a-f]*$/i.test(digits)) {
		throw new Error('Invalid hex: only 0-9 and a-f are allowed');
	}
	if (digits.length % 2 !== 0) {
		throw new Error('Invalid hex: odd number of digits');
	}
	const bytes = new Uint8Array(digits.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(digits.slice(2 * i, 2 * i + 2), 16);
	}
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		throw new Error('Hex bytes are not valid UTF-8 text');
	}
}

/**
 * ROT13 encoding (ROT13 is its own inverse)
 * @param str - The string to encode/decode
 * @returns ROT13 encoded string
 */
export function rot13(str: string): string {
	return str.replace(/[a-zA-Z]/g, (char) => {
		const base = char <= 'Z' ? 65 : 97;
		return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base);
	});
}
