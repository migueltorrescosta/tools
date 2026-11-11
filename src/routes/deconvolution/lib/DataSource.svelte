<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Alert, Field, SegmentedControl } from '#lib/ui/index.js';
	import { parseSample, type ParsedSample } from '#lib/deconvolution/upload.js';

	/** Where the estimate's data comes from: the simulated sample or an upload (one or two columns). */
	let {
		source = $bindable(),
		uploaded = $bindable(),
		onparsed,
		children
	}: {
		source: 'simulated' | 'uploaded';
		uploaded: ParsedSample | null;
		/** Called with each successful parse, so the page can follow its dimension. */
		onparsed?: (p: ParsedSample) => void;
		/** The noise assumption and any warning about the data, at the end of the box. */
		children?: Snippet;
	} = $props();

	let text = $state('');
	let name = $state('');

	function parse(value: string, file = '') {
		text = value;
		name = file;
		uploaded = value.trim() ? parseSample(value) : null;
		if (uploaded && !uploaded.error) onparsed?.(uploaded);
	}

	async function onFile(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		if (file.size > 10 * 1024 * 1024) {
			uploaded = {
				dim: 1,
				width: 1,
				columns: [],
				data: new Float64Array(0),
				data2: new Float64Array(0),
				header: false,
				invalid: [],
				invalidCount: 0,
				error: 'The file is larger than 10 MB.'
			};
			return;
		}
		parse(await file.text(), file.name);
	}
</script>

<div class="stack">
	<SegmentedControl
		legend="Data to estimate from"
		options={[
			{ value: 'simulated', label: 'Simulated sample' },
			{ value: 'uploaded', label: 'Your data' }
		]}
		bind:value={source}
	/>
	{#if source === 'uploaded'}
		<div class="upload">
			<Field
				label="CSV or text file"
				hint="One column of numbers, or more: the noise assumption below says what extra columns hold. A header line is fine."
			>
				{#snippet children(props)}
					<input
						class="control"
						type="file"
						accept=".csv,.txt,.tsv,text/csv,text/plain"
						onchange={onFile}
						data-testid="file"
						{...props}
					/>
				{/snippet}
			</Field>
			<Field label="Or paste numbers">
				{#snippet children(props)}
					<textarea
						class="control paste"
						rows="4"
						value={text}
						oninput={(e) => parse(e.currentTarget.value)}
						data-testid="paste"
						{...props}
					></textarea>
				{/snippet}
			</Field>
			{#if uploaded}
				{#if uploaded.error}
					<Alert tone="danger">{uploaded.error}</Alert>
				{:else}
					<p class="hint" data-testid="upload-status">
						{uploaded.data.length.toLocaleString('en')}
						{uploaded.width >= 3
							? `${uploaded.width} columns`
							: uploaded.dim === 2
								? 'points (2 columns)'
								: 'numbers'}{name ? ` from ${name}` : ''}{uploaded.header
							? ', header skipped'
							: ''}.
					</p>
				{/if}
				{#if uploaded.invalidCount}
					<Alert tone="warning">
						Skipped {uploaded.invalidCount} line{uploaded.invalidCount === 1 ? '' : 's'} that didn't match:
						{uploaded.invalid
							.map((r) => `line ${r.line} (“${r.text}”)`)
							.join(', ')}{uploaded.invalidCount > uploaded.invalid.length ? ', …' : ''}.
					</Alert>
				{/if}
			{/if}
			<p class="hint">Your data stays in this browser and isn't saved.</p>
		</div>
	{/if}
	{@render children?.()}
</div>

<style>
	.stack,
	.upload {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-width: 0;
	}
	.paste {
		font-family: var(--font-mono);
		min-height: 5rem;
		height: auto;
	}
</style>
