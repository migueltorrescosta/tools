<script lang="ts">
	import { onMount } from 'svelte';
	import { copyToClipboard } from '$lib/clipboard';
	import { Button, Field, PageHeader, Panel } from '$lib/ui';
	import { FORMATS as formats, validateFormat, type ValidationResult } from '$lib/format/validate';

	let content = $state('');
	let selectedFormat = $state('json');
	const formatLabel = $derived(
		formats.find((f) => f.value === selectedFormat)?.label ?? selectedFormat
	);
	let copyState = $state<'idle' | 'copied' | 'failed'>('idle');
	let copyTimer: ReturnType<typeof setTimeout> | undefined;
	let hydrated = $state(false);

	// Blank content (empty or whitespace-only) is null, shown as the neutral placeholder
	const validationResult: ValidationResult | null = $derived(
		validateFormat(selectedFormat, content)
	);

	const COPY_LABELS = { idle: 'Copy input', copied: 'Copied', failed: 'Copy failed' } as const;

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

<div class="container" data-hydrated={hydrated || undefined}>
	<PageHeader path="/format" />

	<div class="split-view top">
		<div class="stack">
			<div class="format-group" role="group" aria-labelledby="format-label">
				<span id="format-label" class="group-label">Format</span>
				<div class="cluster">
					{#each formats as format (format.value)}
						<Button
							pressed={selectedFormat === format.value}
							onclick={() => (selectedFormat = format.value)}>{format.label}</Button
						>
					{/each}
				</div>
			</div>

			<Panel title="Content">
				{#snippet actions()}
					<Button
						size="sm"
						variant={copyState === 'failed' ? 'danger' : 'ghost'}
						onclick={copyInput}
						disabled={!content}>{COPY_LABELS[copyState]}</Button
					>
				{/snippet}
				<Field label="Content" hideLabel>
					{#snippet children(props)}
						<textarea
							{...props}
							class="control"
							rows="12"
							bind:value={content}
							placeholder={`Paste your ${formatLabel} here...`}
							spellcheck="false"
						></textarea>
					{/snippet}
				</Field>
			</Panel>
		</div>

		<Panel title="Validation result">
			<div role="status" aria-live="polite" aria-label="Validation result">
				{#if validationResult}
					<div class="verdict" class:valid={validationResult.valid}>
						<span class="icon" aria-hidden="true">{validationResult.valid ? '✓' : '✕'}</span>
						<span data-testid="result-message">{validationResult.message}</span>
					</div>
				{:else}
					<p class="placeholder" data-testid="result-placeholder">
						Enter content above to validate
					</p>
				{/if}
			</div>
		</Panel>
	</div>

	<details class="how">
		<summary>How it works</summary>
		<p>Rules checked for {formatLabel}:</p>
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
					No control characters other than tab, line feed, carriage return and form feed (DEL and
					U+0080-U+009F are rejected)
				</li>
				<li>No noncharacters U+FFFE or U+FFFF</li>
				<li>No lone surrogates (must be encodable as UTF-8)</li>
			</ul>
		{/if}
	</details>
</div>

<style>
	.top {
		align-items: start;
	}

	.format-group {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
	}

	.group-label {
		font-size: var(--text-sm);
		font-weight: 500;
	}

	.verdict {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-2);
		padding: var(--sp-2) var(--sp-3);
		border: 1px solid var(--danger);
		border-radius: var(--radius);
		background: var(--danger-bg);
		color: var(--danger-text);
		word-break: break-word;
	}

	.verdict.valid {
		border-color: var(--success);
		background: var(--success-bg);
		color: var(--success-text);
	}

	.icon {
		font-weight: 700;
	}

	.placeholder {
		margin: 0;
		color: var(--text-muted);
	}
</style>
