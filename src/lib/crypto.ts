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
 * Decode a hexadecimal string
 * @param hex - The hex string to decode
 * @returns Decoded string
 */
export function fromHex(hex: string): string {
	const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []);
	return new TextDecoder().decode(bytes);
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