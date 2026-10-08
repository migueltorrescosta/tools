<script lang="ts">
	import { onMount } from 'svelte';
	import { copyToClipboard } from '$lib/clipboard';
	import { FORMATS as formats, validateFormat, type ValidationResult } from '$lib/format/validate';

	let content = $state('');
	let selectedFormat = $state('json');
	let validationResult = $state<ValidationResult | null>(null);

	function validate() {
		validationResult = validateFormat(selectedFormat, content);
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
						<li>Must contain non-whitespace text</li>
						<li>No control characters other than tab, line feed and carriage return</li>
						<li>No noncharacters U+FFFE or U+FFFF</li>
						<li>No lone surrogates (must be encodable as UTF-8)</li>
					</ul>
				{/if}
			</div>
		</div>
	</div>
</div>
