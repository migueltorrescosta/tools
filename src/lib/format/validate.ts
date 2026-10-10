// Format validators shared by the /format page and its spec

import { parseAllDocuments } from 'yaml';

export interface ValidationResult {
	valid: boolean;
	message: string;
}

/** The part of DOMParser validateXml needs; injectable so it runs outside a browser. */
export interface XmlParser {
	parseFromString(text: string, type: 'application/xml'): Pick<Document, 'getElementsByTagNameNS'>;
}

/** Where Firefox puts its parsererror element; Chromium and WebKit use the XHTML namespace. */
export const FIREFOX_PARSERERROR_NS = 'http://www.mozilla.org/newlayout/xml/parsererror.xml';
export const XHTML_NS = 'http://www.w3.org/1999/xhtml';

/** Input every XML parser rejects, used to learn which namespace its parsererror uses. */
export const XML_PROBE = '<';

export const FORMATS = [
	{ value: 'json', label: 'JSON' },
	{ value: 'yaml', label: 'YAML' },
	{ value: 'xml', label: 'XML' },
	{ value: 'markdown', label: 'Markdown' },
	{ value: 'plaintext', label: 'Plain Text' }
] as const;

export function validateJson(text: string): ValidationResult {
	try {
		JSON.parse(text);
		return { valid: true, message: 'Valid JSON' };
	} catch (e) {
		// Engines disagree on wording and most V8 errors carry no position, so locate the
		// error with our own scanner and keep the engine message only as a fallback
		const found = findJsonError(text);
		if (found) {
			const pos = lineCol(text, found.offset);
			return {
				valid: false,
				message: `Invalid JSON at line ${pos.line}, column ${pos.col}: ${found.message}`
			};
		}
		return { valid: false, message: `Invalid JSON: ${(e as Error).message}` };
	}
}

export interface JsonError {
	/** UTF-16 offset of the offending character (text.length for unexpected end) */
	offset: number;
	message: string;
}

const JSON_NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const JSON_WORD = /[A-Za-z_$][\w$]*/y;
const JSON_ESCAPES = '"\\/bfnrt';

function describeChar(c: string): string {
	if (/^[\p{L}\p{N}\p{P}\p{S}]$/u.test(c)) return `'${c}'`;
	return `U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * First RFC 8259 syntax error in `text`, or null when it is valid JSON. Iterative, so
 * deeply nested input cannot overflow the stack.
 */
export function findJsonError(text: string): JsonError | null {
	const n = text.length;
	let i = 0;
	const err = (message: string, offset = i): JsonError => ({ offset, message });
	const skipWs = () => {
		while (i < n && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r'))
			i++;
	};
	const unexpected = (): JsonError =>
		i >= n ? err('Unexpected end of input') : err(`Unexpected character ${describeChar(text[i])}`);

	const scanString = (): JsonError | null => {
		const start = i++;
		while (i < n) {
			const c = text[i];
			if (c === '"') {
				i++;
				return null;
			}
			if (c === '\\') {
				const e = text[i + 1];
				if (e === 'u') {
					if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6)))
						return err('Bad Unicode escape', i);
					i += 6;
				} else if (e !== undefined && JSON_ESCAPES.includes(e)) {
					i += 2;
				} else {
					return err('Bad escaped character', i);
				}
				continue;
			}
			if (c.charCodeAt(0) < 0x20) return err('Bad control character in string literal');
			i++;
		}
		return err('Unterminated string', start);
	};

	const scanScalar = (): JsonError | null => {
		const c = text[i];
		if (c === '"') return scanString();
		if (c === '-' || (c >= '0' && c <= '9')) {
			JSON_NUMBER.lastIndex = i;
			const m = JSON_NUMBER.exec(text);
			if (!m) return err('No number after minus sign', i + 1);
			const end = i + m[0].length;
			const next = text[end] ?? '';
			if (next >= '0' && next <= '9') return err('Leading zeros are not allowed', i);
			if (next === '.') return err('Unterminated fractional number', end + 1);
			if (next === 'e' || next === 'E') return err('Exponent part is missing a number', end + 1);
			i = end;
			return null;
		}
		JSON_WORD.lastIndex = i;
		const word = JSON_WORD.exec(text)?.[0];
		if (word === 'true' || word === 'false' || word === 'null') {
			i += word.length;
			return null;
		}
		if (word) return err(`Unexpected token '${word}'`);
		return unexpected();
	};

	if (text[0] === '\uFEFF') {
		return err('Byte order mark (U+FEFF) is not allowed at the start of JSON; remove it', 0);
	}

	const stack: ('{' | '[')[] = [];
	// What the next token must be: a value, an object key, or either closing bracket first
	let want: 'value' | 'key' | 'firstValue' | 'firstKey' = 'value';
	for (;;) {
		skipWs();
		if (want === 'firstKey' || want === 'key') {
			if (text[i] === '}') {
				if (want === 'key') return err("Trailing comma before '}'");
				i++;
				stack.pop();
			} else if (text[i] === '"') {
				const e = scanString();
				if (e) return e;
				skipWs();
				if (text[i] !== ':') return i >= n ? unexpected() : err("Expected ':' after property name");
				i++;
				want = 'value';
				continue;
			} else {
				return i >= n ? unexpected() : err('Expected double-quoted property name');
			}
		} else if (text[i] === ']' && want === 'firstValue') {
			i++;
			stack.pop();
		} else if (text[i] === ']' && stack.at(-1) === '[') {
			return err("Trailing comma before ']'");
		} else if (text[i] === '{' || text[i] === '[') {
			stack.push(text[i] as '{' | '[');
			want = text[i] === '{' ? 'firstKey' : 'firstValue';
			i++;
			continue;
		} else {
			const e = scanScalar();
			if (e) return e;
		}

		// A value just ended: close containers until a comma asks for the next one
		for (;;) {
			skipWs();
			const top = stack.at(-1);
			if (!top) return i < n ? err('Unexpected non-whitespace character after JSON') : null;
			if (text[i] === ',') {
				i++;
				want = top === '{' ? 'key' : 'value';
				break;
			}
			if (text[i] === (top === '{' ? '}' : ']')) {
				i++;
				stack.pop();
				continue;
			}
			if (i >= n) return unexpected();
			return err(
				top === '{'
					? "Expected ',' or '}' after property value"
					: "Expected ',' or ']' after array element"
			);
		}
	}
}

// YAML 1.2 c-printable: tab, LF, CR, x20-x7E, x85, xA0-xD7FF, xE000-xFFFD and astral planes
// eslint-disable-next-line no-control-regex
const YAML_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]/;

export function validateYaml(text: string): ValidationResult {
	const lines = text.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const m = YAML_NON_PRINTABLE.exec(lines[i]);
		if (m) {
			const code = m[0].charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
			return {
				valid: false,
				message: `Invalid YAML at line ${i + 1}, column ${m.index + 1}: non-printable character U+${code}`
			};
		}
	}

	for (const doc of parseAllDocuments(text, { prettyErrors: false })) {
		const error = doc.errors[0];
		if (error) {
			const pos = lineCol(text, error.pos[0]);
			return {
				valid: false,
				message: `Invalid YAML at line ${pos.line}, column ${pos.col}: ${error.message}`
			};
		}
	}
	return { valid: true, message: 'Valid YAML' };
}

function lineCol(text: string, offset: number): { line: number; col: number } {
	const before = text.slice(0, offset).split('\n');
	return { line: before.length, col: before[before.length - 1].length + 1 };
}

// Chromium/WebKit: "This page contains the following errors:error on line 2 at column 15: <msg>\nBelow is a rendering..."
// Firefox: "XML Parsing Error: <msg>\nLocation: <url>\nLine Number 2, Column 15:<source line and caret>"
const XML_LINE = /\bline(?: number)?\s+(\d+)/i;
const XML_COLUMN = /\bcolumn\s+(\d+)/i;
const XML_BOILERPLATE = [
	/^\s*This page contains the following errors:/i,
	/Below is a rendering of the page up to the first error\.?\s*$/i
];
const XML_MESSAGE_PREFIX = /^(?:error on line \d+ at column \d+:|XML Parsing Error:)\s*/i;

/** Turn a browser's parsererror text into "Invalid XML at line L, column C: message". */
export function describeXmlError(errorText: string): string {
	let text = errorText;
	for (const re of XML_BOILERPLATE) text = text.replace(re, '');
	const lineMatch = XML_LINE.exec(text);
	const colMatch = lineMatch ? XML_COLUMN.exec(text) : null;
	let location = '';
	if (lineMatch) location += ` at line ${lineMatch[1]}`;
	if (colMatch) location += `, column ${colMatch[1]}`;
	const firstLine = text.split('\n').find((l) => l.trim()) ?? '';
	const detail = firstLine.trim().replace(XML_MESSAGE_PREFIX, '').trim();
	return `Invalid XML${location}: ${detail || 'not well-formed'}`;
}

/**
 * Namespaces this parser puts its parsererror element in. Browsers disagree (Firefox uses
 * its own, Chromium and WebKit XHTML), so ask the parser by feeding it known-bad input.
 */
function parserErrorNamespaces(parser: XmlParser): string[] {
	const probe = parser
		.parseFromString(XML_PROBE, 'application/xml')
		.getElementsByTagNameNS('*', 'parsererror')[0];
	return probe?.namespaceURI ? [probe.namespaceURI] : [FIREFOX_PARSERERROR_NS, XHTML_NS];
}

export function validateXml(text: string, parser: XmlParser = new DOMParser()): ValidationResult {
	const doc = parser.parseFromString(text, 'application/xml');
	// Match by namespace: a user element named parsererror is well-formed content
	const parseError = parserErrorNamespaces(parser)
		.map((ns) => doc.getElementsByTagNameNS(ns, 'parsererror')[0])
		.find(Boolean);

	if (parseError) {
		return { valid: false, message: describeXmlError(parseError.textContent ?? '') };
	}

	return { valid: true, message: 'Valid XML' };
}

// CommonMark defines no invalid documents: every string parses. These are lint checks for
// constructs that silently stop being what the author meant (a link that renders as text,
// a non-void tag written as self-closing). Fenced code is skipped per the spec's fence rules.
// Unbracketed link destinations end at whitespace or an ASCII control character
// eslint-disable-next-line no-control-regex
const DESTINATION_END = /[\s\x00-\x1f]/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const VOID_ELEMENTS = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr'
]);

interface Fence {
	char: string;
	length: number;
}

function openFence(line: string): Fence | null {
	const m = FENCE_OPEN.exec(line);
	if (!m) return null;
	// A backtick fence's info string may not contain backticks (CommonMark 4.5)
	if (m[1][0] === '`' && m[2].includes('`')) return null;
	return { char: m[1][0], length: m[1].length };
}

function closesFence(line: string, fence: Fence): boolean {
	const m = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
	return m !== null && m[1][0] === fence.char && m[1].length >= fence.length;
}

/**
 * Index just past the `)` closing an inline link whose `(` is at `start`, or -1 when the
 * text is not a CommonMark link destination with an optional title (CommonMark 6.3).
 */
export function inlineLinkEnd(text: string, start: number): number {
	let i = start + 1;
	const skipSpace = () => {
		while (i < text.length && /\s/.test(text[i])) i++;
	};
	skipSpace();
	if (text[i] === '<') {
		i++;
		while (i < text.length && text[i] !== '>') {
			if (text[i] === '<' || text[i] === '\n') return -1;
			if (text[i] === '\\') i++;
			i++;
		}
		if (text[i] !== '>') return -1;
		i++;
	} else {
		let depth = 0;
		while (i < text.length && !DESTINATION_END.test(text[i])) {
			if (text[i] === '\\') i++;
			else if (text[i] === '(') depth++;
			else if (text[i] === ')') {
				if (depth === 0) break;
				depth--;
			}
			i++;
		}
		if (depth !== 0) return -1;
	}
	const afterDestination = i;
	skipSpace();
	const close = { '"': '"', "'": "'", '(': ')' }[text[i]];
	if (close && i > afterDestination) {
		i++;
		while (i < text.length && text[i] !== close) {
			if (text[i] === '\\') i++;
			i++;
		}
		if (text[i] !== close) return -1;
		i++;
		skipSpace();
	}
	return text[i] === ')' ? i + 1 : -1;
}

export function validateMarkdown(text: string): ValidationResult {
	const lines = text.split('\n');
	let fence: Fence | null = null;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (fence) {
			if (closesFence(line, fence)) fence = null;
			continue;
		}
		fence = openFence(line);
		if (fence) continue;

		const linkStart = /\[[^\]]*\]\(/g;
		let linkMatch;
		while ((linkMatch = linkStart.exec(line)) !== null) {
			const paren = linkMatch.index + linkMatch[0].length - 1;
			if (inlineLinkEnd(line, paren) === -1 && /^\([^)]*\s[^)]*\)/.test(line.slice(paren))) {
				return {
					valid: false,
					message: `Markdown lint at line ${i + 1}: link destination contains spaces, so it renders as text; wrap it in <> or encode spaces as %20`
				};
			}
		}

		const htmlTagPattern = /<([a-zA-Z][a-zA-Z0-9-]*)[^>]*>/g;
		let htmlMatch;
		while ((htmlMatch = htmlTagPattern.exec(line)) !== null) {
			const tagName = htmlMatch[1].toLowerCase();
			if (htmlMatch[0].endsWith('/>') && !VOID_ELEMENTS.has(tagName)) {
				return {
					valid: false,
					message: `Markdown lint at line ${i + 1}: <${tagName}/> is not a void element, so HTML ignores the slash and leaves it open`
				};
			}
		}
	}

	return { valid: true, message: 'Valid Markdown' };
}

// Plain-text control policy: tab, LF, CR and form feed (page break) are ordinary text.
// Every other C0 control, DEL and the C1 block are rejected; C1 in pasted text is almost
// always mis-decoded Windows-1252 (U+0085 is a mangled ellipsis). U+FFFE/U+FFFF are
// noncharacters.
// eslint-disable-next-line no-control-regex
const PLAIN_TEXT_CONTROL = /[\x00-\x08\x0B\x0E-\x1F\x7F-\x9F]/;
const PLAIN_TEXT_NONCHARACTER = /[\uFFFE\uFFFF]/;

function codePoint(c: string): string {
	return `U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
}

export function validatePlainText(text: string): ValidationResult {
	const checks: [RegExp, string][] = [
		[PLAIN_TEXT_CONTROL, 'control character'],
		[PLAIN_TEXT_NONCHARACTER, 'noncharacter'],
		// In u-mode a surrogate pair is one code point, so this matches only unpaired halves
		[/[\uD800-\uDFFF]/u, 'lone surrogate']
	];
	for (const [re, kind] of checks) {
		const m = re.exec(text);
		if (m) {
			const pos = lineCol(text, m.index);
			const why = kind === 'lone surrogate' ? ', which cannot be encoded as UTF-8' : '';
			return {
				valid: false,
				message: `Text contains a ${kind} ${codePoint(m[0])} at line ${pos.line}, column ${pos.col}${why}`
			};
		}
	}
	return { valid: true, message: 'Valid Plain Text' };
}

/** Validate `content` as `format`; null for blank content, which the page shows as a prompt. */
export function validateFormat(format: string, content: string): ValidationResult | null {
	if (!content.trim()) return null;

	switch (format) {
		case 'json':
			return validateJson(content);
		case 'yaml':
			return validateYaml(content);
		case 'xml':
			return validateXml(content);
		case 'markdown':
			return validateMarkdown(content);
		case 'plaintext':
			return validatePlainText(content);
		default:
			return { valid: false, message: 'Unknown format' };
	}
}
