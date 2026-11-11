<script lang="ts">
	import { copyToClipboard } from '#lib/clipboard.js';
	import { Button } from '#lib/ui/index.js';

	let {
		text,
		label,
		onerror
	}: {
		/** What the button copies. */
		text: string;
		/** Accessible name and tooltip, e.g. "Copy vote link". */
		label: string;
		/** Called when the clipboard refuses the write. */
		onerror?: () => void;
	} = $props();

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		try {
			await copyToClipboard(text);
		} catch {
			onerror?.();
			return;
		}
		clearTimeout(timer);
		copied = true;
		timer = setTimeout(() => (copied = false), 2000);
	}
</script>

<!-- The classic two-squares copy icon; a tick for two seconds after copying -->
<Button class="rv-icon-btn" aria-label={label} title={label} onclick={copy}>
	{#if copied}
		<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
			<path d="M5 12.5l4.5 4.5L19 7.5" />
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
			<rect x="9" y="9" width="11" height="11" rx="2" />
			<path d="M5 15V6a2 2 0 0 1 2-2h8" />
		</svg>
	{/if}
</Button>
<span class="sr-only" role="status">{copied ? 'Copied' : ''}</span>

<style>
	:global(.ui-btn.rv-icon-btn) {
		min-width: var(--control-h);
		padding: 0;
	}
	svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
