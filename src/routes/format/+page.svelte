<script lang="ts">
	import { onMount } from 'svelte';
	import { copyToClipboard } from '#lib/clipboard.js';
	import { Button, Field, PageHeader, Panel, SegmentedControl } from '#lib/ui/index.js';
	import {
		FORMATS as formats,
		validateFormat,
		type ValidationResult
	} from '#lib/format/validate.js';

	const EXAMPLE = '{\n  "name": "example",\n  "value": 123\n}';

	let content = $state('');
	let selectedFormat = $state<(typeof formats)[number]['value']>('json');
	const placeholder = $derived(
		selectedFormat === 'plaintext'
			? 'Paste your text here...'
			: `Paste your ${formats.find((f) => f.value === selectedFormat)?.label} here...`
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

	// The example is JSON, so it switches the format to JSON too.
	function tryExample() {
		selectedFormat = 'json';
		content = EXAMPLE;
	}

	onMount(() => {
		hydrated = true;
		return () => clearTimeout(copyTimer);
	});
</script>

<div class="container stack" data-hydrated={hydrated || undefined}>
	<PageHeader path="/format" />

	<SegmentedControl legend="Format" options={formats} bind:value={selectedFormat} />

	<Panel title="Content">
		{#snippet actions()}
			<Button
				size="sm"
				variant={copyState === 'failed' ? 'danger' : 'ghost'}
				onclick={copyInput}
				disabled={!content}>{COPY_LABELS[copyState]}</Button
			>
		{/snippet}
		<div class="stack">
			<Field label="Content" hideLabel>
				{#snippet children(props)}
					<textarea
						{...props}
						class="control"
						rows="12"
						bind:value={content}
						{placeholder}
						spellcheck="false"
					></textarea>
				{/snippet}
			</Field>

			<div class="result">
				<div role="status" aria-live="polite" aria-label="Validation result">
					{#if validationResult}
						<p class="verdict" class:valid={validationResult.valid}>
							<span class="icon" aria-hidden="true">{validationResult.valid ? '✓' : '✕'}</span>
							<span data-testid="result-message">{validationResult.message}</span>
						</p>
					{:else}
						<p class="placeholder" data-testid="result-placeholder">
							Enter content above to validate
						</p>
					{/if}
				</div>
				{#if !content}
					<button type="button" class="example" onclick={tryExample}>Try an example</button>
				{/if}
			</div>
		</div>
	</Panel>

	<details class="how">
		<summary>How it works</summary>
		<p>
			Pick a format and paste your text. The checker shows the first problem it finds, with its line
			and column.
		</p>
		<p>
			The rules for each format are in the
			<a href="https://github.com/migueltorrescosta/tools/blob/main/docs/format.md">docs</a>.
		</p>
	</details>
</div>

<style>
	.result {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--sp-1) var(--sp-3);
	}

	/* The verdict is its symbol and coloured text, with no box. */
	.verdict {
		display: flex;
		align-items: baseline;
		gap: var(--sp-2);
		margin: 0;
		color: var(--danger-text);
		word-break: break-word;
	}

	.verdict.valid {
		color: var(--success-text);
	}

	.icon {
		font-weight: 700;
		min-width: 1ch;
	}

	.placeholder {
		margin: 0;
		color: var(--text-muted);
	}

	/* A link-styled button: it fills the box, it does not navigate. */
	.example {
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	.example:hover {
		text-decoration-thickness: 2px;
	}
</style>
