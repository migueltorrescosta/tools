<script lang="ts">
	import { copyToClipboard } from '$lib/clipboard';
	import Button from './Button.svelte';
	import Panel from './Panel.svelte';

	let {
		label,
		value,
		placeholder = 'Nothing yet',
		copy = true
	}: {
		label: string;
		value: string;
		placeholder?: string;
		/** Show a Copy button in the header. */
		copy?: boolean;
	} = $props();

	let copied = $state(false);

	async function onCopy() {
		await copyToClipboard(value);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<Panel title={label}>
	{#snippet actions()}
		{#if copy}
			<Button size="sm" variant="ghost" disabled={!value} onclick={onCopy}
				>{copied ? 'Copied' : 'Copy'}</Button
			>
		{/if}
	{/snippet}
	<output aria-live="polite" aria-label={label}>
		{#if value}<pre>{value}</pre>{:else}<span class="placeholder">{placeholder}</span>{/if}
	</output>
</Panel>

<style>
	output {
		display: block;
	}

	pre {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.placeholder {
		color: var(--text-muted);
	}
</style>
