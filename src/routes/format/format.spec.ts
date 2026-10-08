import { describe, it, expect } from 'vitest';
import {
	validateFormat,
	validateJson,
	validateMarkdown,
	validatePlainText,
	validateXml,
	validateYaml,
	type XmlParser
} from '$lib/format/validate';

// Node has no DOMParser. These stubs return what a browser returns: a document whose
// querySelector('parsererror') finds the error element (Chromium wording) or nothing.
const CHROMIUM_MISMATCH =
	'This page contains the following errors:error on line 2 at column 15: Opening and ending tag mismatch: child line 2 and root\nBelow is a rendering of the page up to the first error.';

function stubParser(errorText: string | null): XmlParser & { calls: [string, string][] } {
	const calls: [string, string][] = [];
	return {
		calls,
		parseFromString(text, type) {
			calls.push([text, type]);
			return {
				querySelector: ((sel: string) =>
					sel === 'parsererror' && errorText !== null
						? { textContent: errorText }
						: null) as unknown as Document['querySelector']
			};
		}
	};
}

describe('Format validation functions', () => {
	describe('JSON validation', () => {
		it('validates valid JSON object', () => {
			const result = validateJson('{"name": "test", "value": 123}');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid JSON');
		});

		it('validates valid JSON array', () => {
			const result = validateJson('[1, 2, 3, "four"]');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid JSON');
		});

		it('validates valid nested JSON', () => {
			const result = validateJson('{"user": {"name": "John", "active": true}}');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid JSON');
		});

		it('rejects empty input', () => {
			const result = validateJson('');
			expect(result.valid).toBe(false);
			expect(result.message).toBe('JSON cannot be empty');
		});

		it('rejects whitespace-only input', () => {
			const result = validateJson('   \n\t  ');
			expect(result.valid).toBe(false);
			expect(result.message).toBe('JSON cannot be empty');
		});

		it('rejects invalid JSON - missing quotes', () => {
			const result = validateJson('{name: "test"}');
			expect(result.valid).toBe(false);
			expect(result.message).toContain('Invalid JSON');
		});

		it('rejects invalid JSON - trailing comma', () => {
			const result = validateJson('{"key": "value",}');
			expect(result.valid).toBe(false);
			expect(result.message).toContain('Invalid JSON');
		});

		it('rejects invalid JSON - unmatched braces', () => {
			const result = validateJson('{"key": "value"');
			expect(result.valid).toBe(false);
			expect(result.message).toContain('Invalid JSON');
		});

		it('rejects invalid JSON - invalid syntax', () => {
			const result = validateJson('{"key": }');
			expect(result.valid).toBe(false);
			expect(result.message).toContain('Invalid JSON');
		});

		it('reports error for malformed JSON', () => {
			const result = validateJson('{\n  "key":\n  invalid\n}');
			expect(result.valid).toBe(false);
			expect(result.message).toContain('Invalid JSON');
		});

		it('validates JSON null', () => {
			const result = validateJson('null');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid JSON');
		});

		it('validates JSON boolean', () => {
			const result = validateJson('true');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid JSON');
		});

		it('validates JSON number', () => {
			const result = validateJson('42.5');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid JSON');
		});
	});

	describe('YAML validation', () => {
		it.each([
			['simple key-value', 'name: John\nage: 30'],
			['nested mappings', 'user:\n  name: John'],
			['flat key-value pairs', 'name: John\nemail: john@example.com'],
			['list items', 'fruits:\n  - apple\n  - banana\n  - cherry'],
			['quoted strings', 'message: "Hello, World!"'],
			['comments', '# This is a comment\nname: John\n# Another comment'],
			['a quoted key containing a colon', '"key:name": value'],
			['an unindented sequence under a key', 'fruits:\n- apple\n- banana']
		])('accepts %s', (_name, text) => {
			expect(validateYaml(text)).toEqual({ valid: true, message: 'Valid YAML' });
		});

		it('rejects empty input', () => {
			expect(validateYaml('')).toEqual({ valid: false, message: 'YAML cannot be empty' });
		});
	});

	describe('XML validation', () => {
		it('accepts a document without a parsererror and parses as application/xml', () => {
			const parser = stubParser(null);
			expect(validateXml('<root/>', parser)).toEqual({ valid: true, message: 'Valid XML' });
			expect(parser.calls).toEqual([['<root/>', 'application/xml']]);
		});

		it('rejects empty input without parsing', () => {
			const parser = stubParser(null);
			expect(validateXml('  ', parser)).toEqual({ valid: false, message: 'XML cannot be empty' });
			expect(parser.calls).toEqual([]);
		});

		it('reports line and column from the parsererror text', () => {
			const result = validateXml('<root>\n  <child></root>', stubParser(CHROMIUM_MISMATCH));
			expect(result.valid).toBe(false);
			expect(result.message).toBe(
				'Invalid XML at line 2, column 15: This page contains the following errors:error on line 2 at column 15: Opening and ending tag mismatch: child line 2 and root'
			);
		});

		it('falls back to a generic message when the parsererror is empty', () => {
			expect(validateXml('<a>', stubParser(''))).toEqual({
				valid: false,
				message: 'Invalid XML: Invalid XML'
			});
		});
	});

	describe('Markdown validation', () => {
		it('validates simple text', () => {
			const result = validateMarkdown('This is plain text.');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Markdown (CommonMark)');
		});

		it('validates headings', () => {
			const result = validateMarkdown('# Heading 1\n## Heading 2');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Markdown (CommonMark)');
		});

		it('validates links', () => {
			const result = validateMarkdown('[Link](https://example.com)');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Markdown (CommonMark)');
		});

		it('validates links with angle brackets', () => {
			const result = validateMarkdown('[Link](<https://example.com/path with spaces>)');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Markdown (CommonMark)');
		});

		it('validates code blocks', () => {
			const result = validateMarkdown('```\ncode here\n```');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Markdown (CommonMark)');
		});

		it('validates tilde code blocks', () => {
			const result = validateMarkdown('~~~\ncode here\n~~~');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Markdown (CommonMark)');
		});

		it('validates void HTML elements', () => {
			const result = validateMarkdown('Some text<br/>more text');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Markdown (CommonMark)');
		});

		it('validates nested markdown with code blocks', () => {
			const result = validateMarkdown(
				'# Title\n\nParagraph\n\n```\nconst x = 1;\n```\n\nMore text'
			);
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Markdown (CommonMark)');
		});

		it('rejects empty input', () => {
			const result = validateMarkdown('');
			expect(result.valid).toBe(false);
			expect(result.message).toBe('Markdown cannot be empty');
		});

		it('accepts heading without space', () => {
			// '#' without space after # doesn't match heading pattern
			const result = validateMarkdown('#');
			expect(result.valid).toBe(true);
		});

		it('rejects heading with space but no text', () => {
			// '# ' with space after # but no text is rejected
			const result = validateMarkdown('# ');
			expect(result.valid).toBe(false);
			expect(result.message).toContain('Empty heading');
		});

		it('rejects link with unescaped spaces in URL', () => {
			const result = validateMarkdown('[Link](https://example.com/path with spaces)');
			expect(result.valid).toBe(false);
			expect(result.message).toContain('URL must not contain unescaped spaces');
		});

		it('rejects unclosed code block', () => {
			const result = validateMarkdown('```\nunclosed code');
			expect(result.valid).toBe(false);
			expect(result.message).toContain('Unclosed code block');
		});

		it('rejects non-void self-closing tag', () => {
			const result = validateMarkdown('Some <div/> text');
			expect(result.valid).toBe(false);
			expect(result.message).toContain('is not a void element');
		});
	});

	describe('Plain Text validation', () => {
		it('validates simple text', () => {
			const result = validatePlainText('Hello, World!');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Plain Text');
		});

		it('validates multi-line text', () => {
			const result = validatePlainText('Line 1\nLine 2\nLine 3');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Plain Text');
		});

		it('validates text with special characters', () => {
			const result = validatePlainText('Hello! @#$%^&*()_+-=[]{}|;:\'",./<>?');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Plain Text');
		});

		it('validates unicode text', () => {
			const result = validatePlainText('Hello 你好 مرحبا 🎉');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Plain Text');
		});

		it('rejects empty input', () => {
			const result = validatePlainText('');
			expect(result.valid).toBe(false);
			expect(result.message).toBe('Text cannot be empty');
		});

		it('rejects text with control characters', () => {
			const result = validatePlainText('Hello\x00World');
			expect(result.valid).toBe(false);
			expect(result.message).toBe('Text contains invalid control characters');
		});

		it('rejects text with BEL character', () => {
			const result = validatePlainText('Hello\x07World');
			expect(result.valid).toBe(false);
			expect(result.message).toBe('Text contains invalid control characters');
		});

		it('rejects text with form feed', () => {
			const result = validatePlainText('Page 1\x0CPage 2');
			expect(result.valid).toBe(false);
			expect(result.message).toBe('Text contains invalid control characters');
		});

		it('rejects text with invalid unicode', () => {
			const result = validatePlainText('Hello\uFFFEWorld');
			expect(result.valid).toBe(false);
			expect(result.message).toBe('Text contains invalid control characters');
		});

		it('rejects text with U+FFFF', () => {
			const result = validatePlainText('Hello\uFFFFWorld');
			expect(result.valid).toBe(false);
			expect(result.message).toBe('Text contains invalid control characters');
		});
	});

	describe('validateFormat', () => {
		it('rejects whitespace-only content for every format', () => {
			for (const f of ['json', 'yaml', 'xml', 'markdown', 'plaintext']) {
				expect(validateFormat(f, ' \n ')).toEqual({
					valid: false,
					message: 'Content cannot be empty'
				});
			}
		});

		it('dispatches to the validator for the format', () => {
			expect(validateFormat('json', '{}')).toEqual({ valid: true, message: 'Valid JSON' });
			expect(validateFormat('yaml', 'a: 1').message).toBe('Valid YAML');
			expect(validateFormat('markdown', '# Hi').message).toBe('Valid Markdown (CommonMark)');
			expect(validateFormat('plaintext', 'hi').message).toBe('Valid Plain Text');
			expect(validateFormat('toml', 'a = 1')).toEqual({ valid: false, message: 'Unknown format' });
		});
	});
});
