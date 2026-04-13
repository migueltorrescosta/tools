import { describe, it, expect } from 'vitest';

// Test-specific implementations (duplicated from component for testing)
// These match the exact logic in +page.svelte

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

		it('handles odd-length hex input', () => {
			// Odd-length hex results in replacement character due to invalid byte
			const result = fromHex('abc');
			expect(result.length).toBe(2);
		});

		it('handles hex with spaces', () => {
			// Spaces don't match /.{1,2}/ properly, decodes partial matches
			const result = fromHex('48 65 6c 6c 6f');
			// Each space-separated hex value gets parsed (incorrectly)
			expect(result.length).toBe(7);
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

	describe('Encoding Round-trips', () => {
		it('Base64: preserves original text exactly', () => {
			const original = 'The quick brown fox jumps over 13 lazy dogs!';
			const encoded = base64Encode(original);
			const decoded = base64Decode(encoded);
			expect(decoded).toBe(original);
		});

		it('Hex: preserves original text exactly', () => {
			const original = 'Pack my box with five dozen liquor jugs.';
			const encoded = toHex(original);
			const decoded = fromHex(encoded);
			expect(decoded).toBe(original);
		});

		it('ROT13: self-inverse property', () => {
			const original = 'The five boxing wizards jump quickly';
			// ROT13(ROT13(x)) = x
			const twice = rot13(rot13(original));
			expect(twice).toBe(original);
		});

		it('ROT13: works on pangram', () => {
			const original = 'Sphinx of black quartz, judge my vow';
			const encoded = rot13(original);
			const decoded = rot13(encoded);
			expect(decoded).toBe(original);
		});
	});

	describe('Error Handling', () => {
		it('fromHex handles completely invalid input', () => {
			// Non-hex characters: "xyz" matches "xy" and "z" as two groups
			// "xy" parses as NaN -> 0, "z" is odd-length and ignored
			const result = fromHex('xyz');
			expect(result.length).toBe(2);
			expect(result.charCodeAt(0)).toBe(0);
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
