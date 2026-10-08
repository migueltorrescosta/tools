import { describe, it, expect } from 'vitest';
import {
	findJsonError,
	validateFormat,
	validateJson,
	validateMarkdown,
	validatePlainText,
	validateXml,
	validateYaml,
	describeXmlError,
	FIREFOX_PARSERERROR_NS,
	XHTML_NS,
	XML_PROBE,
	type XmlParser
} from '$lib/format/validate';

// Node has no DOMParser. These stubs return what a browser returns: a document whose
// parsererror element holds the error text (Chromium wording), or none. Chromium and WebKit
// put that element in the XHTML namespace, Firefox in its own; user content named
// parsererror sits in whatever namespace the document gives it (none by default).
const CHROMIUM_MISMATCH =
	'This page contains the following errors:error on line 2 at column 15: Opening and ending tag mismatch: child line 2 and root\nBelow is a rendering of the page up to the first error.';
const FIREFOX_MISMATCH =
	'XML Parsing Error: mismatched tag. Expected: </child>.\nLocation: http://localhost:5173/format\nLine Number 2, Column 18:  <child></root>\n-----------------^';

interface StubElement {
	namespaceURI: string | null;
	textContent: string;
}

function stubParser(
	errorText: string | null,
	{ errorNs = XHTML_NS, userElements = [] as StubElement[] } = {}
): XmlParser & { calls: [string, string][] } {
	const calls: [string, string][] = [];
	return {
		calls,
		parseFromString(text, type) {
			if (text !== XML_PROBE) calls.push([text, type]);
			const failed = text === XML_PROBE ? 'probe error' : errorText;
			const elements: StubElement[] = [
				...(failed === null ? [] : [{ namespaceURI: errorNs, textContent: failed }]),
				...(text === XML_PROBE ? [] : userElements)
			];
			return {
				getElementsByTagNameNS: ((ns: string, name: string) =>
					name === 'parsererror'
						? elements.filter((e) => ns === '*' || e.namespaceURI === (ns || null))
						: []) as unknown as Document['getElementsByTagNameNS']
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

		// format/F6: one location, computed by our scanner, for every error kind
		it.each([
			['an unquoted key', '{\n  "a": 1,\n  b: 2\n}', 3, 3, 'Expected double-quoted property name'],
			['a bad literal', '{\n  "a": 1,\n  "b": x\n}', 3, 8, "Unexpected token 'x'"],
			['a misspelt literal', '[true, flase]', 1, 8, "Unexpected token 'flase'"],
			['a trailing comma in an object', '{"a":1,}', 1, 8, "Trailing comma before '}'"],
			['a trailing comma in an array', '[1,\n2,\n]', 3, 1, "Trailing comma before ']'"],
			['a missing colon', '{"a" 1}', 1, 6, "Expected ':' after property name"],
			['a missing comma', '{"a":1 "b":2}', 1, 8, "Expected ',' or '}' after property value"],
			['a missing array comma', '[1 2]', 1, 4, "Expected ',' or ']' after array element"],
			['an unclosed object', '{"a":1', 1, 7, 'Unexpected end of input'],
			['an unterminated string', '{"a":"x}', 1, 6, 'Unterminated string'],
			['a raw newline in a string', '["a\nb"]', 1, 4, 'Bad control character in string literal'],
			['a bad escape', '["\\x"]', 1, 3, 'Bad escaped character'],
			['a bad unicode escape', '["\\u12G4"]', 1, 3, 'Bad Unicode escape'],
			['a leading zero', '[01]', 1, 2, 'Leading zeros are not allowed'],
			['a bare minus', '[-]', 1, 3, 'No number after minus sign'],
			['a bare decimal point', '1.', 1, 3, 'Unterminated fractional number'],
			['an empty exponent', '1e', 1, 3, 'Exponent part is missing a number'],
			['trailing content', '{}\n{}', 2, 1, 'Unexpected non-whitespace character after JSON'],
			['a single quote', "{'a':1}", 1, 2, 'Expected double-quoted property name'],
			['an invisible character', '[1,\u200B2]', 1, 4, 'Unexpected character U+200B'],
			[
				'a leading BOM',
				'\uFEFF{"a":1}',
				1,
				1,
				'Byte order mark (U+FEFF) is not allowed at the start of JSON; remove it'
			]
		])('locates %s', (_name, text, line, col, message) => {
			expect(validateJson(text)).toEqual({
				valid: false,
				message: `Invalid JSON at line ${line}, column ${col}: ${message}`
			});
		});

		it('reports the location once, not again after the engine message', () => {
			const { message } = validateJson('{"a":1,}');
			expect(message.match(/line/g)).toHaveLength(1);
			expect(message).not.toMatch(/position|is not valid JSON/);
		});

		it('locates empty input at its end', () => {
			expect(validateJson(' ').message).toBe(
				'Invalid JSON at line 1, column 2: Unexpected end of input'
			);
		});

		it('agrees with JSON.parse on what is valid', () => {
			const corpus = [
				'{}',
				'[]',
				'0',
				'-0',
				'-0.5e+10',
				'1E3',
				'"\\u00e9\\n"',
				'{"a":[1,{"b":null}],"c":false}',
				' \r\n\t[ ] ',
				'"\u0085"',
				'[1,]',
				'{,}',
				'01',
				'.5',
				'+1',
				'NaN',
				'"\t"',
				'[',
				']',
				'{"a"}',
				'[[[[[]]]]]',
				'[[[[[]]]]',
				'{"a":{"b":{"c":{}}}}}'
			];
			for (const text of corpus) {
				let parses = true;
				try {
					JSON.parse(text);
				} catch {
					parses = false;
				}
				expect(findJsonError(text) === null, text).toBe(parses);
			}
		});

		it('scans deep nesting without overflowing the stack', () => {
			const deep = '['.repeat(200_000) + ']'.repeat(199_999);
			expect(findJsonError(deep)).toEqual({
				offset: deep.length,
				message: 'Unexpected end of input'
			});
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

		it.each([
			['a:\n  b: 1', 'nested mapping'],
			['- a\n- b', 'sequence'],
			['a: 1\n---\nb: 2', 'multi-document stream'],
			['description: |\n  line one\n  line two', 'block scalar'],
			['"123": value\n123: other', 'numeric key'],
			['- : x', 'sequence of a mapping with an empty key'],
			['key: value\r\nother: 2\r\n', 'CRLF line endings']
		])('accepts %j (%s)', (text) => {
			expect(validateYaml(text)).toEqual({ valid: true, message: 'Valid YAML' });
		});

		// Probe inputs from review finding format/F1 that the old validator called valid
		it.each([
			['key: [unclosed', 1],
			['a: b: c', 1],
			['\tkey: tab', 1],
			['key: "unterminated', 1],
			['{{{', 1],
			['a:\n  b: 1\n c: 2', 3],
			['foo\nbar: baz\n  - x', 1],
			['key: value\x00with null', 1],
			['ok: 1\nbad: \x07bell', 2],
			['a: 1\n---\nb: [', 3]
		])('rejects %j and reports line %i', (text, line) => {
			const result = validateYaml(text);
			expect(result.valid).toBe(false);
			expect(result.message).toMatch(new RegExp(`^Invalid YAML at line ${line}, column \\d+: \\S`));
		});

		it('rejects tab indentation with the parser message and position', () => {
			expect(validateYaml('a:\n\tb: 1')).toEqual({
				valid: false,
				message: 'Invalid YAML at line 2, column 1: Tabs are not allowed as indentation'
			});
		});

		it('names the non-printable character', () => {
			expect(validateYaml('key: value\x00with null').message).toBe(
				'Invalid YAML at line 1, column 11: non-printable character U+0000'
			);
		});
	});

	describe('XML validation', () => {
		it('accepts a document without a parsererror and parses as application/xml', () => {
			const parser = stubParser(null);
			expect(validateXml('<root/>', parser)).toEqual({ valid: true, message: 'Valid XML' });
			expect(parser.calls).toEqual([['<root/>', 'application/xml']]);
		});

		it('reports line and column from the parsererror text', () => {
			const result = validateXml('<root>\n  <child></root>', stubParser(CHROMIUM_MISMATCH));
			expect(result.valid).toBe(false);
			expect(result.message).toBe(
				'Invalid XML at line 2, column 15: Opening and ending tag mismatch: child line 2 and root'
			);
		});

		it('detects the parsererror in the namespace this browser uses', () => {
			for (const errorNs of [XHTML_NS, FIREFOX_PARSERERROR_NS]) {
				expect(validateXml('<a>\n<b></a>', stubParser(CHROMIUM_MISMATCH, { errorNs }))).toEqual({
					valid: false,
					message:
						'Invalid XML at line 2, column 15: Opening and ending tag mismatch: child line 2 and root'
				});
			}
		});

		it('accepts a user element named parsererror outside the error namespace', () => {
			// What a browser returns for <root><parsererror/></root>: the element exists in no
			// namespace, so a local-name lookup finds it and a namespaced lookup does not
			const userElements = [{ namespaceURI: null, textContent: '' }];
			expect(
				validateXml('<root><parsererror/></root>', stubParser(null, { userElements }))
			).toEqual({ valid: true, message: 'Valid XML' });
		});

		it("accepts a user parsererror in another engine's error namespace", () => {
			// Firefox-namespaced content is ordinary content to Chromium, and vice versa
			const userElements = [{ namespaceURI: FIREFOX_PARSERERROR_NS, textContent: '' }];
			const parser = stubParser(null, { errorNs: XHTML_NS, userElements });
			expect(
				validateXml(
					'<p:parsererror xmlns:p="http://www.mozilla.org/newlayout/xml/parsererror.xml"/>',
					parser
				).valid
			).toBe(true);
		});

		it('falls back to a generic message when the parsererror is empty', () => {
			expect(validateXml('<a>', stubParser(''))).toEqual({
				valid: false,
				message: 'Invalid XML: not well-formed'
			});
		});

		describe('describeXmlError', () => {
			it('reads the line from Firefox "Line Number" wording', () => {
				expect(describeXmlError(FIREFOX_MISMATCH)).toBe(
					'Invalid XML at line 2, column 18: mismatched tag. Expected: </child>.'
				);
			});

			it('strips the Chromium boilerplate around the message', () => {
				expect(describeXmlError(CHROMIUM_MISMATCH)).not.toMatch(
					/This page contains|Below is a rendering/
				);
			});

			it('omits a column when no line is reported', () => {
				expect(describeXmlError('Unexpected token at column 3')).toBe(
					'Invalid XML: Unexpected token at column 3'
				);
			});
		});
	});

	describe('Markdown validation', () => {
		it('validates simple text', () => {
			const result = validateMarkdown('This is plain text.');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Markdown');
		});

		it('validates headings', () => {
			const result = validateMarkdown('# Heading 1\n## Heading 2');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Markdown');
		});

		it('validates links', () => {
			const result = validateMarkdown('[Link](https://example.com)');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Markdown');
		});

		it('validates links with angle brackets', () => {
			const result = validateMarkdown('[Link](<https://example.com/path with spaces>)');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Markdown');
		});

		it('validates code blocks', () => {
			const result = validateMarkdown('```\ncode here\n```');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Markdown');
		});

		it('validates tilde code blocks', () => {
			const result = validateMarkdown('~~~\ncode here\n~~~');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Markdown');
		});

		it('validates void HTML elements', () => {
			const result = validateMarkdown('Some text<br/>more text');
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Markdown');
		});

		it('validates nested markdown with code blocks', () => {
			const result = validateMarkdown(
				'# Title\n\nParagraph\n\n```\nconst x = 1;\n```\n\nMore text'
			);
			expect(result.valid).toBe(true);
			expect(result.message).toBe('Valid Markdown');
		});

		it('accepts heading without space', () => {
			// '#' without space after # doesn't match heading pattern
			const result = validateMarkdown('#');
			expect(result.valid).toBe(true);
		});

		it('flags a link destination with bare spaces, which renders as text', () => {
			expect(validateMarkdown('ok\n[Link](https://example.com/path with spaces)')).toEqual({
				valid: false,
				message:
					'Markdown lint at line 2: link destination contains spaces, so it renders as text; wrap it in <> or encode spaces as %20'
			});
		});

		it('flags a non-void self-closing tag', () => {
			expect(validateMarkdown('Some <div/> text')).toEqual({
				valid: false,
				message:
					'Markdown lint at line 1: <div/> is not a void element, so HTML ignores the slash and leaves it open'
			});
		});

		// Probe inputs from review finding format/F3: all valid CommonMark the old validator rejected
		it.each([
			['a ~~~ line inside a backtick fence', '```\n~~~\n```'],
			['a closing fence indented differently (0-3 spaces)', '```\ncode\n  ```'],
			['a 4-backtick fence containing a 3-backtick line', '````\n```\n````'],
			['a longer closing fence', '```\ncode\n`````'],
			['a link with a title', '[a](https://x.com "title")'],
			['a link with a single-quoted title', "[a](https://x.com 'title')"],
			['a link with a parenthesised title', '[a](https://x.com (title))'],
			['a link with balanced parentheses in the destination', '[a](https://x.com/foo_(bar))'],
			['a void self-closing tag after a closed element', '<div>a</div> <br/>'],
			['an empty ATX heading', '# '],
			['an empty heading with closing hashes', '## ##'],
			['an unclosed fence, which runs to the end of the document', '```\nunclosed code'],
			['a self-closing tag inside an unclosed fence', '~~~\n<div/>']
		])('accepts %s', (_name, text) => {
			expect(validateMarkdown(text)).toEqual({ valid: true, message: 'Valid Markdown' });
		});

		it('checks lines after a fence closes', () => {
			expect(validateMarkdown('```\n<div/>\n```\n<span/>').message).toContain('<span/>');
		});

		it('does not close a backtick fence with tildes', () => {
			expect(validateMarkdown('```\n~~~\n<div/>\n```').valid).toBe(true);
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

		it.each([
			['tab', 'a\tb'],
			['line feed', 'a\nb'],
			['carriage return', 'a\r\nb'],
			['form feed (page break)', 'Page 1\x0CPage 2'],
			['NBSP, the first character after C1', 'a\u00A0b'],
			['U+FFFD', 'a\uFFFDb'],
			['whitespace only', ' \n\t ']
		])('accepts %s', (_name, text) => {
			expect(validatePlainText(text)).toEqual({ valid: true, message: 'Valid Plain Text' });
		});

		// Policy (format/F8): reject C0 except tab/LF/CR/FF, DEL, and all of C1
		it.each([
			['NUL', 'Hello\x00World', '0000', 6],
			['BEL', 'Hello\x07World', '0007', 6],
			['backspace (last below tab)', 'a\x08b', '0008', 2],
			['vertical tab', 'a\x0Bb', '000B', 2],
			['shift out (first after CR)', 'a\x0Eb', '000E', 2],
			['unit separator (last C0)', 'a\x1Fb', '001F', 2],
			['DEL', 'a\x7Fb', '007F', 2],
			['first C1', 'a\u0080b', '0080', 2],
			['NEL (mis-decoded ellipsis)', 'a\u0085b', '0085', 2],
			['last C1', 'a\u009Fb', '009F', 2]
		])('rejects %s', (_name, text, code, col) => {
			expect(validatePlainText(text)).toEqual({
				valid: false,
				message: `Text contains a control character U+${code} at line 1, column ${col}`
			});
		});

		it('reports the line of a control character', () => {
			expect(validatePlainText('one\ntwo\x07').message).toBe(
				'Text contains a control character U+0007 at line 2, column 4'
			);
		});

		it.each([
			['FFFE', 'Hello\uFFFEWorld'],
			['FFFF', 'Hello\uFFFFWorld']
		])('rejects noncharacter U+%s', (code, text) => {
			expect(validatePlainText(text)).toEqual({
				valid: false,
				message: `Text contains a noncharacter U+${code} at line 1, column 6`
			});
		});

		it.each([
			['a high surrogate', 'a\uD800b', 'D800', 2],
			['a low surrogate', 'a\uDC00b', 'DC00', 2],
			['a reversed pair', '\uDE00\uD83D', 'DE00', 1]
		])('rejects %s, which is not UTF-8 encodable', (_name, text, code, col) => {
			expect(validatePlainText(text)).toEqual({
				valid: false,
				message: `Text contains a lone surrogate U+${code} at line 1, column ${col}, which cannot be encoded as UTF-8`
			});
		});

		it('accepts a surrogate pair', () => {
			expect(validatePlainText('emoji \uD83D\uDE00').valid).toBe(true);
		});
	});

	describe('validateFormat', () => {
		it('returns null (the page placeholder) for blank content in every format', () => {
			for (const f of ['json', 'yaml', 'xml', 'markdown', 'plaintext']) {
				expect(validateFormat(f, '')).toBeNull();
				expect(validateFormat(f, ' \n\t ')).toBeNull();
			}
		});

		it('dispatches to the validator for the format', () => {
			expect(validateFormat('json', '{}')).toEqual({ valid: true, message: 'Valid JSON' });
			expect(validateFormat('yaml', 'a: 1')?.message).toBe('Valid YAML');
			expect(validateFormat('markdown', '# Hi')?.message).toBe('Valid Markdown');
			expect(validateFormat('plaintext', 'hi')?.message).toBe('Valid Plain Text');
			expect(validateFormat('toml', 'a = 1')).toEqual({ valid: false, message: 'Unknown format' });
		});
	});
});
