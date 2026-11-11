<script lang="ts">
	import { onMount } from 'svelte';
	import { copyToClipboard } from '#lib/clipboard.js';
	import { Alert, Button, Field, PageHeader, Panel, SegmentedControl } from '#lib/ui/index.js';
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
			<SegmentedControl legend="Format" options={formats} bind:value={selectedFormat} />

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
						<Alert tone={validationResult.valid ? 'success' : 'danger'} live={false}
							><span data-testid="result-message">{validationResult.message}</span></Alert
						>
					{:else}
						<p class="placeholder" data-testid="result-placeholder">
							Enter content above to validate
						</p>
					{/if}
				</div>
				{#if !content}
					<Button variant="link" onclick={tryExample}>Try an example</Button>
				{/if}
			</div>
		</div>
		<details class="how tail">
			<summary>How it works</summary>
			<p>
				Pick a format and paste your text. The checker shows the first problem it finds, with its
				line and column.
			</p>
			<p>
				The rules for each format are in the
				<a href="https://github.com/migueltorrescosta/tools/blob/main/docs/format.md">docs</a>.
			</p>
		</details>
	</Panel>
</div>

<style>
	.result {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--sp-1) var(--sp-3);
	}

	/* The last lines of the box, under a hairline */
	.tail {
		padding-top: var(--sp-3);
		border-top: 1px solid var(--border);
	}

	.placeholder {
		margin: 0;
		color: var(--text-muted);
	}
</style>
