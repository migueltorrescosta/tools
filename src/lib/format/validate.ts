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

/** Namespace Chromium, Firefox and WebKit put their parsererror element in. */
export const PARSERERROR_NS = 'http://www.mozilla.org/newlayout/xml/parsererror.xml';

export const FORMATS = [
	{ value: 'json', label: 'JSON' },
	{ value: 'yaml', label: 'YAML' },
	{ value: 'xml', label: 'XML' },
	{ value: 'markdown', label: 'Markdown' },
	{ value: 'plaintext', label: 'Plain Text' }
] as const;

export function validateJson(text: string): ValidationResult {
	if (!text.trim()) {
		return { valid: false, message: 'JSON cannot be empty' };
	}
	try {
		JSON.parse(text);
		return { valid: true, message: 'Valid JSON' };
	} catch (e) {
		const error = e as SyntaxError;
		const match = error.message.match(/position (\d+)/);
		if (match) {
			const pos = parseInt(match[1]);
			const lines = text.substring(0, pos).split('\n');
			const line = lines.length;
			const col = lines[lines.length - 1].length + 1;
			return {
				valid: false,
				message: `Invalid JSON: ${error.message} at line ${line}, column ${col}`
			};
		}
		return { valid: false, message: `Invalid JSON: ${error.message}` };
	}
}

// YAML 1.2 c-printable: tab, LF, CR, x20-x7E, x85, xA0-xD7FF, xE000-xFFFD and astral planes
// eslint-disable-next-line no-control-regex
const YAML_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]/;

export function validateYaml(text: string): ValidationResult {
	if (!text.trim()) {
		return { valid: false, message: 'YAML cannot be empty' };
	}

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

export function validateXml(text: string, parser: XmlParser = new DOMParser()): ValidationResult {
	if (!text.trim()) {
		return { valid: false, message: 'XML cannot be empty' };
	}

	const doc = parser.parseFromString(text, 'application/xml');
	// Match by namespace: a user element named parsererror is well-formed content
	const parseError = doc.getElementsByTagNameNS(PARSERERROR_NS, 'parsererror')[0];

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
	if (!text.trim()) {
		return { valid: false, message: 'Markdown cannot be empty' };
	}

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

export function validatePlainText(text: string): ValidationResult {
	if (!text.trim()) {
		return { valid: false, message: 'Text cannot be empty' };
	}

	const invalidBytes = text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/); // eslint-disable-line no-control-regex
	if (invalidBytes) {
		return { valid: false, message: 'Text contains invalid control characters' };
	}

	return { valid: true, message: 'Valid Plain Text' };
}

export function validateFormat(format: string, content: string): ValidationResult {
	if (!content.trim()) {
		return { valid: false, message: 'Content cannot be empty' };
	}

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
