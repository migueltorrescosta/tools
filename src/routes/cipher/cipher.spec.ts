import { describe, it, expect } from 'vitest';
import { base64Encode, base64Decode, toHex, fromHex, rot13 } from '$lib/crypto';

describe('Cipher Tool - Encoding Functions', () => {
	describe('ROT13 Edge Cases', () => {
		it('handles wrap-around: A becomes N', () => {
			expect(rot13('A')).toBe('N');
		});

		it('handles wrap-around: N becomes A', () => {
			expect(rot13('N')).toBe('A');
		});

		it('handles wrap-around: M becomes Z', () => {
			expect(rot13('M')).toBe('Z');
		});

		it('handles wrap-around: Z becomes M', () => {
			expect(rot13('Z')).toBe('M');
		});

		it('handles lowercase wrap-around: a becomes n', () => {
			expect(rot13('a')).toBe('n');
		});

		it('handles lowercase wrap-around: n becomes a', () => {
			expect(rot13('n')).toBe('a');
		});

		it('preserves non-alphabetic characters: numbers', () => {
			expect(rot13('123')).toBe('123');
		});

		it('preserves non-alphabetic characters: symbols', () => {
			expect(rot13('!@#$%')).toBe('!@#$%');
		});

		it('preserves non-alphabetic characters: spaces', () => {
			expect(rot13('Hello World')).toBe('Uryyb Jbeyq');
		});

		it('preserves non-alphabetic characters: mixed text', () => {
			const result = rot13('Secret 007!');
			expect(result).toBe('Frperg 007!');
		});

		it('handles empty string', () => {
			expect(rot13('')).toBe('');
		});

		it('handles all uppercase alphabet', () => {
			const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
			const expected = 'NOPQRSTUVWXYZABCDEFGHIJKLM';
			expect(rot13(upper)).toBe(expected);
		});

		it('handles all lowercase alphabet', () => {
			const lower = 'abcdefghijklmnopqrstuvwxyz';
			const expected = 'nopqrstuvwxyzabcdefghijklm';
			expect(rot13(lower)).toBe(expected);
		});
	});

	describe('Hex Encoding Edge Cases', () => {
		it('handles single character', () => {
			expect(toHex('A')).toBe('41');
		});

		it('handles empty string', () => {
			expect(toHex('')).toBe('');
		});

		it('rejects odd-length hex input', () => {
			expect(() => fromHex('abc')).toThrow(/odd number/);
		});

		it('ignores whitespace between hex bytes', () => {
			expect(fromHex('48 65 6c 6c 6f')).toBe('Hello');
			expect(fromHex('4865\n6c6c\t6f')).toBe('Hello');
		});

		it('accepts one leading 0x prefix and uppercase digits', () => {
			expect(fromHex('0x41')).toBe('A');
			expect(fromHex('0X4A4b')).toBe('JK');
		});

		it('rejects non-hex characters instead of decoding them as NUL', () => {
			expect(() => fromHex('zz41')).toThrow(/Invalid hex/);
			expect(() => fromHex('0x0x41')).toThrow(/Invalid hex/);
		});

		it('rejects bytes that are not valid UTF-8 instead of returning U+FFFD', () => {
			expect(() => fromHex('ff')).toThrow(/not valid UTF-8/);
			expect(() => fromHex('e4bd')).toThrow(/not valid UTF-8/);
		});
	});

	describe('Base64 Unicode Handling', () => {
		it('handles unicode characters', () => {
			const result = base64Encode('こんにちは');
			expect(result).toBe('44GT44KT44Gr44Gh44Gv');
		});

		it('handles emoji', () => {
			const result = base64Encode('🔐🔑');
			expect(result).toBe('8J+UkPCflJE=');
		});

		it('handles mixed ascii and unicode', () => {
			const result = base64Encode('Hello 世界 🌍');
			expect(result).toBe('SGVsbG8g5LiW55WMIPCfjI0=');
		});

		it('round-trips unicode correctly', () => {
			const original = '你好世界';
			const encoded = base64Encode(original);
			const decoded = base64Decode(encoded);
			expect(decoded).toBe(original);
		});

		it('round-trips emoji correctly', () => {
			const original = '🚀 Rocket 💯';
			const encoded = base64Encode(original);
			const decoded = base64Decode(encoded);
			expect(decoded).toBe(original);
		});
	});

	describe('Hex Unicode Handling', () => {
		it('handles unicode characters', () => {
			const result = toHex('你好');
			expect(result).toBe('e4bda0e5a5bd');
		});

		it('handles emoji', () => {
			const result = toHex('🔐');
			expect(result).toBe('f09f9490');
		});

		it('round-trips unicode correctly', () => {
			const original = '日本語';
			const encoded = toHex(original);
			const decoded = fromHex(encoded);
			expect(decoded).toBe(original);
		});

		it('round-trips mixed content correctly', () => {
			const original = 'Test 🎯 123';
			const encoded = toHex(original);
			const decoded = fromHex(encoded);
			expect(decoded).toBe(original);
		});
	});

	describe('ROT13 Unicode Handling', () => {
		it('preserves unicode characters unchanged', () => {
			const result = rot13('こんにちは');
			expect(result).toBe('こんにちは');
		});

		it('preserves emoji unchanged', () => {
			const result = rot13('🔐🔑');
			expect(result).toBe('🔐🔑');
		});

		it('transforms only ASCII letters in mixed content', () => {
			const result = rot13('Hello 世界!');
			expect(result).toBe('Uryyb 世界!');
		});
	});

	describe('Error Handling', () => {
		it('fromHex rejects completely invalid input', () => {
			expect(() => fromHex('xyz')).toThrow(/Invalid hex/);
		});

		it('fromHex handles empty hex string', () => {
			const result = fromHex('');
			expect(result).toBe('');
		});

		it('base64Decode handles invalid base64', () => {
			// Invalid base64 should throw
			expect(() => base64Decode('!!!invalid!!!')).toThrow();
		});

		it('base64Decode handles empty string', () => {
			const result = base64Decode('');
			expect(result).toBe('');
		});
	});
});
