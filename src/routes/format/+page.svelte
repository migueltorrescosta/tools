<script lang="ts">
	import { onMount } from 'svelte';
	import { copyToClipboard } from '$lib/clipboard';
	import { FORMATS as formats, validateFormat, type ValidationResult } from '$lib/format/validate';

	let content = $state('');
	let selectedFormat = $state('json');
	let copyState = $state<'idle' | 'copied' | 'failed'>('idle');
	let copyTimer: ReturnType<typeof setTimeout> | undefined;
	let hydrated = $state(false);

	// Blank content (empty or whitespace-only) is null, shown as the neutral placeholder
	const validationResult: ValidationResult | null = $derived(
		validateFormat(selectedFormat, content)
	);

	const COPY_LABELS = { idle: 'COPY INPUT', copied: 'COPIED', failed: 'COPY FAILED' } as const;

	async function copyInput() {
		try {
			await copyToClipboard(content);
			copyState = 'copied';
		} catch {
			// No clipboard permission or an insecure context
			copyState = 'failed';
		}
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copyState = 'idle'), 2000);
	}

	onMount(() => {
		content = '{\n  "name": "example",\n  "value": 123\n}';
		hydrated = true;
		return () => clearTimeout(copyTimer);
	});
</script>

<svelte:head>
	<title>Format Checker</title>
</svelte:head>

<div class="container" data-hydrated={hydrated || undefined}>
	<header>
		<h1>FORMAT CHECKER</h1>
		<p class="subtitle">Validate JSON, YAML, XML, Markdown & More</p>
	</header>

	<div class="format-selector-section">
		<div class="section-header">
			<span class="label">FORMAT</span>
			<span class="hint">Select the format to validate</span>
		</div>
		<div class="format-buttons" role="group" aria-label="Format">
			{#each formats as format (format.value)}
				<button
					class="format-btn"
					class:active={selectedFormat === format.value}
					aria-pressed={selectedFormat === format.value}
					onclick={() => (selectedFormat = format.value)}
				>
					{format.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="content-input-section">
		<div class="section-header">
			<label class="label" for="format-content">CONTENT</label>
			<span class="hint">Paste your {selectedFormat.toUpperCase()} content</span>
			<button
				class="copy-btn"
				class:copied={copyState === 'copied'}
				class:failed={copyState === 'failed'}
				onclick={copyInput}
				disabled={!content}>{COPY_LABELS[copyState]}</button
			>
		</div>
		<textarea
			id="format-content"
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
			<span class="panel-title" id="format-result-title">VALIDATION RESULT</span>
		</div>
		<div
			class="panel-content"
			role="status"
			aria-live="polite"
			aria-labelledby="format-result-title"
		>
			{#if validationResult}
				<div
					class="result"
					class:valid={validationResult.valid}
					class:invalid={!validationResult.valid}
				>
					<span class="result-icon" aria-hidden="true">{validationResult.valid ? '✓' : '✗'}</span>
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
						<li>Parsed as YAML 1.2; every document in a --- stream is checked</li>
						<li>Indentation uses spaces (not tabs)</li>
						<li>Flow collections and quoted strings must be closed</li>
						<li>No non-printable characters (YAML c-printable set)</li>
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
						<li>CommonMark accepts any text; these are lint checks</li>
						<li>Link destinations with spaces must be wrapped in &lt;&gt; or encoded</li>
						<li>Self-closing tags only for void elements</li>
						<li>Fenced code blocks are not checked</li>
					</ul>
				{:else}
					<ul>
						<li>
							No control characters other than tab, line feed, carriage return and form feed (DEL
							and U+0080-U+009F are rejected)
						</li>
						<li>No noncharacters U+FFFE or U+FFFF</li>
						<li>No lone surrogates (must be encodable as UTF-8)</li>
					</ul>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.copy-btn.copied {
		border-color: #4dff6a;
		color: #4dff6a;
	}

	.copy-btn.failed {
		border-color: #ff6666;
		color: #ff6666;
	}

	.copy-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
