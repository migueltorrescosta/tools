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

export function validateMarkdown(text: string): ValidationResult {
	if (!text.trim()) {
		return { valid: false, message: 'Markdown cannot be empty' };
	}

	try {
		const lines = text.split('\n');
		let inCodeBlock = false;
		let codeFenceIndent = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();

			if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
				if (!inCodeBlock) {
					inCodeBlock = true;
					const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
					codeFenceIndent = indent;
				} else {
					const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
					if (indent !== codeFenceIndent) {
						throw new Error(`Code fence at line ${i + 1} has incorrect indentation`);
					}
					inCodeBlock = false;
				}
				continue;
			}

			if (inCodeBlock) continue;

			if (line.match(/^#{1,6}\s/)) {
				const headingText = line.replace(/^#{1,6}\s*/, '');
				if (headingText.trim() === '') {
					throw new Error(`Empty heading at line ${i + 1}`);
				}
			}

			const linkPattern = /\[([^\]]*)\]\(([^)]*)\)/g;
			let linkMatch;
			while ((linkMatch = linkPattern.exec(trimmed)) !== null) {
				const url = linkMatch[2];
				if (url.includes(' ') && !url.startsWith('<') && !url.endsWith('>')) {
					throw new Error(`Invalid link at line ${i + 1}: URL must not contain unescaped spaces`);
				}
			}

			const asterisks = (trimmed.match(/\*/g) || []).length;
			if (asterisks % 2 !== 0 && asterisks > 0) {
				// Check for unmatched asterisks
			}

			const htmlTagPattern = /<([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
			let htmlMatch;
			while ((htmlMatch = htmlTagPattern.exec(trimmed)) !== null) {
				const tagName = htmlMatch[1].toLowerCase();
				const selfClosing = trimmed.match(/<[a-zA-Z][^>]*\/>/);
				if (
					![
						'br',
						'hr',
						'img',
						'input',
						'meta',
						'link',
						'area',
						'base',
						'col',
						'embed',
						'param',
						'source',
						'track',
						'wbr'
					].includes(tagName) &&
					selfClosing
				) {
					throw new Error(
						`Invalid self-closing tag at line ${i + 1}: <${tagName}> is not a void element`
					);
				}
			}
		}

		if (inCodeBlock) {
			throw new Error('Unclosed code block: missing closing fence');
		}

		return { valid: true, message: 'Valid Markdown (CommonMark)' };
	} catch (e) {
		const error = e as Error;
		return { valid: false, message: `Invalid Markdown: ${error.message}` };
	}
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
