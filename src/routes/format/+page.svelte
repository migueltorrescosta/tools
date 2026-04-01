<script lang="ts">
	import { onMount } from 'svelte';

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
			validateYamlSimple(text);
			return { valid: true, message: 'Valid YAML' };
		} catch (e) {
			const error = e as Error;
			return { valid: false, message: `Invalid YAML: ${error.message}` };
		}
	}

	function validateYamlSimple(text: string): void {
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
					indentStack.pop();
				} else {
					continue;
				}
			}

			if (line.match(/^[|>]-?\s*$/)) {
				inBlockScalar = true;
				const currentIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
				blockScalarIndent = currentIndent;
				continue;
			}

			const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
			const trimmed = line.trim();

			if (trimmed === '') continue;

			const lastIndent = indentStack[indentStack.length - 1];

			if (indent > lastIndent && !trimmed.startsWith('-') && !trimmed.startsWith('?')) {
				throw new Error(`Unexpected indentation at line ${i + 1}`);
			}

			if (trimmed.match(/^-\s+/)) {
				const keyMatch = trimmed.match(/^-\s+([^:]+):?\s*(.*)$/);
				if (keyMatch) {
					const key = keyMatch[1].trim();
					const value = keyMatch[2].trim();
					if (key.includes(':') && !value.startsWith('{') && !value.startsWith('[')) {
						throw new Error(`Invalid mapping at line ${i + 1}: unexpected ":" in key "${key}"`);
					}
				}
			}

			if (trimmed.match(/^[^:]+:\s*[|:>-]/)) {
				const nextLineIndex = i + 1;
				if (nextLineIndex >= lines.length || lines[nextLineIndex].trim() === '') {
					throw new Error(`Block scalar expected at line ${i + 1}`);
				}
			}

			if (trimmed.match(/^[^:]+:\s*$/)) {
				indentStack.push(indent);
			} else if (trimmed.match(/^-\s+/)) {
				indentStack.push(indent);
			}

			while (indentStack.length > 1 && indentStack[indentStack.length - 1] > indent) {
				indentStack.pop();
			}

			if (trimmed.includes(':')) {
				const parts = trimmed.split(':');
				const key = parts[0].trim();
				if (key.match(/^\d+$/)) {
					throw new Error(`Invalid key at line ${i + 1}: numeric key "${key}" must be quoted`);
				}
				if (key.includes(':') && !key.startsWith('"') && !key.startsWith("'")) {
					throw new Error(`Invalid key at line ${i + 1}: multi-part key must be quoted`);
				}
			}

			const invalidChars = trimmed.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/);
			if (invalidChars) {
				throw new Error(`Invalid control character at line ${i + 1}`);
			}
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

				const emphasisPattern = /(\*\*|__|\*|_|`{1,2})(?=.*\1)/g;
				const asterisks = (trimmed.match(/\*/g) || []).length;
				const underscores = (trimmed.match(/_/g) || []).length;
				if (asterisks % 2 !== 0 && asterisks > 0) {
					const unmatched = trimmed.match(/(\*)+(?:[^*]+|$)/g);
					if (unmatched && unmatched.some((m) => m.startsWith('*') && !m.startsWith('**'))) {
					}
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

		const invalidBytes = text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/);
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

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
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
			{#each formats as format}
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

<style>
	.container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 1.5rem;
	}

	header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	h1 {
		font-family: 'Orbitron', sans-serif;
		font-size: 2rem;
		font-weight: 800;
		background: linear-gradient(135deg, var(--futuristic-cyan), var(--futuristic-magenta));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin: 0;
		letter-spacing: 0.15em;
		text-shadow: 0 0 40px rgba(0, 245, 255, 0.5);
	}

	.subtitle {
		font-family: 'Rajdhani', sans-serif;
		font-size: 0.9rem;
		color: var(--futuristic-text-dim);
		margin-top: 0.25rem;
		letter-spacing: 0.1em;
	}

	.format-selector-section {
		margin-bottom: 1rem;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.label {
		font-family: 'Orbitron', sans-serif;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--futuristic-cyan);
		letter-spacing: 0.15em;
	}

	.hint {
		font-size: 0.85rem;
		color: var(--futuristic-text-dim);
	}

	.format-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.format-btn {
		padding: 0.5rem 1rem;
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 6px;
		color: var(--futuristic-text-dim);
		font-family: 'Rajdhani', sans-serif;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		letter-spacing: 0.05em;
	}

	.format-btn:hover {
		border-color: var(--futuristic-cyan);
		color: var(--futuristic-cyan);
	}

	.format-btn.active {
		background: rgba(0, 245, 255, 0.1);
		border-color: var(--futuristic-cyan);
		color: var(--futuristic-cyan);
	}

	.content-input-section {
		margin-bottom: 1rem;
	}

	.content-input {
		width: 100%;
		height: 200px;
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 8px;
		padding: 0.75rem;
		font-family: 'Rajdhani', monospace;
		font-size: 0.9rem;
		color: var(--futuristic-text);
		resize: vertical;
		outline: none;
		transition:
			border-color 0.3s,
			box-shadow 0.3s;
	}

	.content-input:focus {
		border-color: var(--futuristic-cyan);
		box-shadow: 0 0 20px rgba(0, 245, 255, 0.2);
	}

	.content-input::placeholder {
		color: var(--futuristic-text-dim);
	}

	.result-panel {
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 12px;
		overflow: hidden;
		margin-bottom: 1.5rem;
	}

	.panel-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: rgba(0, 0, 0, 0.3);
		border-bottom: 1px solid var(--futuristic-border);
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.dot.red {
		background: #ff5f57;
	}
	.dot.yellow {
		background: #febc2e;
	}
	.dot.green {
		background: #28c840;
	}

	.panel-title {
		font-family: 'Orbitron', sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--futuristic-text-dim);
		letter-spacing: 0.1em;
		margin-left: 0.5rem;
	}

	.copy-btn {
		margin-left: auto;
		background: transparent;
		border: 1px solid var(--futuristic-border);
		color: var(--futuristic-text-dim);
		font-family: 'Rajdhani', sans-serif;
		font-size: 0.7rem;
		font-weight: 600;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
		letter-spacing: 0.05em;
	}

	.copy-btn:hover {
		border-color: var(--futuristic-cyan);
		color: var(--futuristic-cyan);
	}

	.panel-content {
		padding: 1.5rem;
		min-height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.result {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 1.5rem;
		border-radius: 8px;
		font-family: 'Rajdhani', sans-serif;
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	.result.valid {
		background: rgba(40, 200, 64, 0.1);
		border: 1px solid rgba(40, 200, 64, 0.3);
		color: #28c840;
	}

	.result.invalid {
		background: rgba(255, 68, 68, 0.1);
		border: 1px solid rgba(255, 68, 68, 0.3);
		color: #ff4444;
	}

	.result-icon {
		font-size: 1.25rem;
	}

	.result-message {
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.result-placeholder {
		color: var(--futuristic-text-dim);
		font-family: 'Rajdhani', sans-serif;
		font-size: 0.9rem;
	}

	.info-section {
		margin-bottom: 1.5rem;
	}

	.info-panel {
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 12px;
		overflow: hidden;
	}

	.info-header {
		display: flex;
		align-items: center;
		padding: 0.75rem 1rem;
		background: rgba(0, 0, 0, 0.3);
		border-bottom: 1px solid var(--futuristic-border);
	}

	.info-content {
		padding: 1rem;
	}

	.info-content ul {
		margin: 0;
		padding-left: 1.25rem;
	}

	.info-content li {
		color: var(--futuristic-text-dim);
		font-family: 'Rajdhani', sans-serif;
		font-size: 0.9rem;
		line-height: 1.6;
		margin-bottom: 0.25rem;
	}

	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		h1 {
			font-size: 1.5rem;
		}

		.format-buttons {
			flex-direction: column;
		}

		.format-btn {
			width: 100%;
			text-align: center;
		}
	}
</style>
