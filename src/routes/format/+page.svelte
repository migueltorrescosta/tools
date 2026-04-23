<script lang="ts">
	import { onMount } from 'svelte';
	import { copyToClipboard } from '$lib/clipboard';

	let content = $state('');
	let selectedFormat = $state('json');
	let validationResult = $state<{ valid: boolean; message: string } | null>(null);

	const formats = [
		{ value: 'json', label: 'JSON' },
		{ value: 'yaml', label: 'YAML' },
		{ value: 'xml', label: 'XML' },
		{ value: 'markdown', label: 'Markdown' },
		{ value: 'plaintext', label: 'Plain Text' }
	];

	function validateJson(text: string): { valid: boolean; message: string } {
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

	function validateYaml(text: string): { valid: boolean; message: string } {
		if (!text.trim()) {
			return { valid: false, message: 'YAML cannot be empty' };
		}
		try {
			// Inline YAML validation logic
			const lines = text.split('\n');
			let indentStack: number[] = [0];
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
				const keyMatch = trimmed.match(/^-\s+([^:]+):?\s*(.*)$/);
				if (keyMatch) {
					const key = keyMatch[1].trim();
					const value = keyMatch[2].trim();
					if (!key) {
						return { valid: false, message: `Invalid YAML at line ${i + 1}: empty key` };
					}
					// Check for invalid characters
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

	function validateXml(text: string): { valid: boolean; message: string } {
		if (!text.trim()) {
			return { valid: false, message: 'XML cannot be empty' };
		}

		const parser = new DOMParser();
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

	function validateMarkdown(text: string): { valid: boolean; message: string } {
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

	function validatePlainText(text: string): { valid: boolean; message: string } {
		if (!text.trim()) {
			return { valid: false, message: 'Text cannot be empty' };
		}

		const invalidBytes = text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/); // eslint-disable-line no-control-regex
		if (invalidBytes) {
			return { valid: false, message: 'Text contains invalid control characters' };
		}

		return { valid: true, message: 'Valid Plain Text' };
	}

	function validate() {
		if (!content.trim()) {
			validationResult = { valid: false, message: 'Content cannot be empty' };
			return;
		}

		switch (selectedFormat) {
			case 'json':
				validationResult = validateJson(content);
				break;
			case 'yaml':
				validationResult = validateYaml(content);
				break;
			case 'xml':
				validationResult = validateXml(content);
				break;
			case 'markdown':
				validationResult = validateMarkdown(content);
				break;
			case 'plaintext':
				validationResult = validatePlainText(content);
				break;
			default:
				validationResult = { valid: false, message: 'Unknown format' };
		}
	}

	$effect(() => {
		if (content) {
			validate();
		} else {
			validationResult = null;
		}
	});

	onMount(() => {
		content = '{\n  "name": "example",\n  "value": 123\n}';
	});
</script>

<svelte:head>
	<title>Format Checker</title>
</svelte:head>

<div class="container">
	<header>
		<h1>FORMAT CHECKER</h1>
		<p class="subtitle">Validate JSON, YAML, XML, Markdown & More</p>
	</header>

	<div class="format-selector-section">
		<div class="section-header">
			<span class="label">FORMAT</span>
			<span class="hint">Select the format to validate</span>
		</div>
		<div class="format-buttons">
			{#each formats as format (format.value)}
				<button
					class="format-btn"
					class:active={selectedFormat === format.value}
					onclick={() => (selectedFormat = format.value)}
				>
					{format.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="content-input-section">
		<div class="section-header">
			<span class="label">CONTENT</span>
			<span class="hint">Paste your {selectedFormat.toUpperCase()} content</span>
		</div>
		<textarea
			class="content-input"
			bind:value={content}
			placeholder={`Paste your ${selectedFormat.toUpperCase()} here...`}
			spellcheck="false"
		></textarea>
	</div>

	<div class="result-panel">
		<div class="panel-header">
			<span class="dot red"></span>
			<span class="dot yellow"></span>
			<span class="dot green"></span>
			<span class="panel-title">VALIDATION RESULT</span>
			<button class="copy-btn" onclick={() => copyToClipboard(content)}>COPY</button>
		</div>
		<div class="panel-content">
			{#if validationResult}
				<div
					class="result"
					class:valid={validationResult.valid}
					class:invalid={!validationResult.valid}
				>
					<span class="result-icon">{validationResult.valid ? '✓' : '✗'}</span>
					<span class="result-message">{validationResult.message}</span>
				</div>
			{:else}
				<div class="result-placeholder">Enter content above to validate</div>
			{/if}
		</div>
	</div>

	<div class="info-section">
		<div class="info-panel">
			<div class="info-header">
				<span class="panel-title">VALIDATION RULES</span>
			</div>
			<div class="info-content">
				{#if selectedFormat === 'json'}
					<ul>
						<li>Must be valid JSON syntax (RFC 8259)</li>
						<li>Keys must be double-quoted strings</li>
						<li>No trailing commas allowed</li>
						<li>No comments allowed</li>
						<li>Values: strings, numbers, objects, arrays, true, false, null</li>
					</ul>
				{:else if selectedFormat === 'yaml'}
					<ul>
						<li>Must follow YAML 1.2 specification</li>
						<li>Indentation uses spaces (not tabs)</li>
						<li>Keys should not be numeric without quoting</li>
						<li>Multi-part keys must be quoted</li>
						<li>Block scalars (| , >) must have content</li>
					</ul>
				{:else if selectedFormat === 'xml'}
					<ul>
						<li>Must be well-formed XML</li>
						<li>All tags must be properly closed</li>
						<li>Attributes must have quoted values</li>
						<li>Root element required</li>
						<li>Special characters must be escaped (&lt;, &gt;, &amp;)</li>
					</ul>
				{:else if selectedFormat === 'markdown'}
					<ul>
						<li>Follows CommonMark specification</li>
						<li>Headings (# - ######) require text</li>
						<li>Links must have valid URL syntax</li>
						<li>Code blocks must be closed</li>
						<li>Self-closing tags only for void elements</li>
					</ul>
				{:else}
					<ul>
						<li>Must contain visible text</li>
						<li>No invalid control characters</li>
						<li>UTF-8 encoded</li>
					</ul>
				{/if}
			</div>
		</div>
	</div>
</div>
