/**
 * Reusable cryptographic encoding utilities
 */

/**
 * Encode a string to Base64
 * @param str - The string to encode
 * @returns Base64 encoded string
 */
export function base64Encode(str: string): string {
	return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Decode a Base64 string
 * @param str - The Base64 string to decode
 * @returns Decoded string
 */
export function base64Decode(str: string): string {
	return decodeURIComponent(escape(atob(str)));
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
