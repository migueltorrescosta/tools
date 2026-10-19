<script lang="ts">
	import { copyToClipboard } from '$lib/clipboard';

	let {
		url,
		onClear,
		description
	}: {
		/** The share link to copy. */
		url: string;
		/** Clears the tool's saved data; called after the second, confirming click. */
		onClear: () => void;
		/** What the share link carries, read by the copy button's label. */
		description: string;
	} = $props();

	let copied = $state(false);
	let confirming = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function later(f: () => void) {
		clearTimeout(timer);
		timer = setTimeout(f, 2500);
	}

	async function copy() {
		try {
			await copyToClipboard(url);
			copied = true;
			later(() => (copied = false));
		} catch {
			copied = false;
		}
	}

	function clear() {
		if (!confirming) {
			confirming = true;
			later(() => (confirming = false));
			return;
		}
		confirming = false;
		onClear();
	}
</script>

<div class="ui-share-actions">
	<span class="ui-share-status" role="status" data-testid="share-status"
		>{#if copied}Link copied{/if}</span
	>
	<button
		type="button"
		class="ui-icon-btn"
		aria-label="Copy share link ({description})"
		title="Copy share link ({description})"
		data-testid="copy-link"
		data-url={url}
		onclick={copy}
	>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<rect x="8" y="8" width="12" height="12" rx="2" />
			<path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
		</svg>
	</button>
	<button
		type="button"
		class="ui-icon-btn danger"
		class:confirming
		aria-label={confirming ? 'Confirm: clear saved data' : 'Clear saved data'}
		title={confirming ? 'Click again to clear saved data' : 'Clear saved data'}
		data-testid="clear-saved"
		onclick={clear}
		onblur={() => (confirming = false)}
	>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
		</svg>
		{#if confirming}<span>Clear?</span>{/if}
	</button>
</div>

<style>
	.ui-share-actions {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
	}
	.ui-share-status {
		font-size: var(--text-sm);
		color: var(--success-text);
	}
	.ui-icon-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		min-width: var(--control-h);
		min-height: var(--control-h);
		padding: 0 var(--sp-2);
		justify-content: center;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
	}
	.ui-icon-btn:hover {
		background: var(--surface-2);
	}
	.ui-icon-btn.danger {
		color: var(--danger-text);
		border-color: var(--danger);
	}
	.ui-icon-btn.danger:hover,
	.ui-icon-btn.confirming {
		background: var(--danger-bg);
	}
	svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
