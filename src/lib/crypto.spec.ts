import { describe, it, expect } from 'vitest';
import { base64Encode, base64Decode, toHex, fromHex, rot13 } from '$lib/crypto';

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

		it('round-trips non-ASCII text', () => {
			const original = 'Grüße, 世界 🔐';
			expect(base64Decode(base64Encode(original))).toBe(original);
		});

		it('encodes non-ASCII text as UTF-8 bytes', () => {
			expect(base64Encode('é')).toBe('w6k=');
		});

		it('encodes a large input without overflowing the call stack', () => {
			const original = 'a'.repeat(200_000);
			expect(base64Decode(base64Encode(original))).toBe(original);
		});

		it('accepts the URL-safe alphabet', () => {
			expect(base64Decode('SGVsbG8_')).toBe('Hello?');
			expect(base64Decode('Pz8-')).toBe('??>');
		});

		it('accepts missing padding and ignores whitespace', () => {
			expect(base64Decode('aGk')).toBe('hi');
			expect(base64Decode(' SGVs\nbG8= ')).toBe('Hello');
		});

		it('rejects bytes that are not UTF-8 with a specific error', () => {
			expect(() => base64Decode('/w==')).toThrow('Base64 bytes are not valid UTF-8 text');
		});

		it('rejects characters outside the base64 alphabets', () => {
			expect(() => base64Decode('SGVs*G8=')).toThrow(/^Invalid base64: only/);
			expect(() => base64Decode('aGk=aGk=')).toThrow(/^Invalid base64: only/);
		});

		it('rejects a length that is not a whole number of bytes', () => {
			expect(() => base64Decode('aGkhx')).toThrow(
				'Invalid base64: length is not a whole number of bytes'
			);
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
