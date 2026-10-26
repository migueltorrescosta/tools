<script lang="ts">
	import { onMount } from 'svelte';
	import { copyToClipboard } from '$lib/clipboard';
	import { Button, Field, PageHeader, Panel, SegmentedControl } from '$lib/ui';
	import { FORMATS as formats, validateFormat, type ValidationResult } from '$lib/format/validate';

	let content = $state('');
	let selectedFormat = $state<(typeof formats)[number]['value']>('json');
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
	.top {
		align-items: start;
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
