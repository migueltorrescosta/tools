// Format validators shared by the /format page and its spec

export interface ValidationResult {
	valid: boolean;
	message: string;
}

/** The part of DOMParser validateXml needs; injectable so it runs outside a browser. */
export interface XmlParser {
	parseFromString(text: string, type: 'application/xml'): Pick<Document, 'querySelector'>;
}

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

export function validateYaml(text: string): ValidationResult {
	if (!text.trim()) {
		return { valid: false, message: 'YAML cannot be empty' };
	}
	try {
		// Inline YAML validation logic
		const lines = text.split('\n');
		const indentStack: number[] = [0];
		let inBlockScalar = false;
		let blockScalarIndent = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (line.trim() === '' || line.trim().startsWith('#')) {
				continue;
			}

			if (inBlockScalar) {
				const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
				if (indent < blockScalarIndent && line.trim() !== '') {
					inBlockScalar = false;
				} else {
					continue;
				}
			}

			// Detect block scalars (|, >)
			if (line.trim().match(/^(\||>)\d*(\+|-)?$/)) {
				inBlockScalar = true;
				blockScalarIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
				continue;
			}

			const currentIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
			const lastIndent = indentStack[indentStack.length - 1];

			if (line.trim().startsWith('-')) {
				// List item
				indentStack.push(currentIndent);
			} else if (currentIndent > lastIndent) {
				// Nested key
				indentStack.push(currentIndent);
			} else if (currentIndent < lastIndent) {
				// Going back up the tree
				while (indentStack.length > 1 && indentStack[indentStack.length - 1] > currentIndent) {
					indentStack.pop();
				}
			}

			// Check for key: value format
			const keyMatch = line.trim().match(/^-\s+([^:]+):?\s*(.*)$/);
			if (keyMatch) {
				const key = keyMatch[1].trim();
				const value = keyMatch[2].trim();
				if (!key) {
					return { valid: false, message: `Invalid YAML at line ${i + 1}: empty key` };
				}
				// Check for invalid characters
				// eslint-disable-next-line no-control-regex
				const invalidChars = line.trim().match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/);
				if (invalidChars) {
					return { valid: false, message: `Invalid YAML: control characters not allowed` };
				}
			}
		}
		return { valid: true, message: 'Valid YAML' };
	} catch (e) {
		const error = e as Error;
		return { valid: false, message: `Invalid YAML: ${error.message}` };
	}
}

export function validateXml(text: string, parser: XmlParser = new DOMParser()): ValidationResult {
	if (!text.trim()) {
		return { valid: false, message: 'XML cannot be empty' };
	}

	const doc = parser.parseFromString(text, 'application/xml');
	const parseError = doc.querySelector('parsererror');

	if (parseError) {
		const errorText = parseError.textContent || 'Invalid XML';
		const lineMatch = errorText.match(/line (\d+)/i);
		const colMatch = errorText.match(/column (\d+)/i);
		let location = '';
		if (lineMatch) location += ` at line ${lineMatch[1]}`;
		if (colMatch) location += `, column ${colMatch[1]}`;
		return { valid: false, message: `Invalid XML${location}: ${errorText.split('\n')[0]}` };
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
