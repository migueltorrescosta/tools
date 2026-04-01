import { describe, it, expect } from 'vitest';

function base64Encode(str: string): string {
	return btoa(unescape(encodeURIComponent(str)));
}

function base64Decode(str: string): string {
	return decodeURIComponent(escape(atob(str)));
}

function toHex(str: string): string {
	return Array.from(new TextEncoder().encode(str))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

function fromHex(hex: string): string {
	const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []);
	return new TextDecoder().decode(bytes);
}

function rot13(str: string): string {
	return str.replace(/[a-zA-Z]/g, (char) => {
		const base = char <= 'Z' ? 65 : 97;
		return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base);
	});
}

describe('Encryption functions', () => {
	describe('Base64', () => {
		it('encodes text correctly', () => {
			const result = base64Encode('Hello, World!');
			expect(result).toBe('SGVsbG8sIFdvcmxkIQ==');
		});

		it('decodes text correctly', () => {
			const result = base64Decode('SGVsbG8sIFdvcmxkIQ==');
			expect(result).toBe('Hello, World!');
		});

		it('round-trips correctly', () => {
			const original = 'Test message 123';
			const encoded = base64Encode(original);
			const decoded = base64Decode(encoded);
			expect(decoded).toBe(original);
		});
	});

	describe('Hex', () => {
		it('encodes text correctly', () => {
			const result = toHex('Hello');
			expect(result).toBe('48656c6c6f');
		});

		it('decodes text correctly', () => {
			const result = fromHex('48656c6c6f');
			expect(result).toBe('Hello');
		});

		it('round-trips correctly', () => {
			const original = 'Test message 456';
			const encoded = toHex(original);
			const decoded = fromHex(encoded);
			expect(decoded).toBe(original);
		});
	});

	describe('ROT13', () => {
		it('encodes text correctly', () => {
			const result = rot13('Hello');
			expect(result).toBe('Uryyb');
		});

		it('decodes text correctly (same operation)', () => {
			const encoded = rot13('Hello');
			const decoded = rot13(encoded);
			expect(decoded).toBe('Hello');
		});

		it('round-trips correctly', () => {
			const original = 'The quick brown fox';
			const encoded = rot13(original);
			const decoded = rot13(encoded);
			expect(decoded).toBe(original);
		});
	});
});
