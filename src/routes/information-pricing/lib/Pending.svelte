<script lang="ts">
	/** A section still computing: a fixed-size box with a centred spinner and a short label. */
	let {
		label,
		height,
		inline = false
	}: {
		/** E.g. "Computing the policy tree…"; screen-reader only when `inline`. */
		label: string;
		/** Box height in pixels, so the page doesn't jump when the result arrives. */
		height?: number;
		/** A small spinner in a line of text (the label is read, not shown). */
		inline?: boolean;
	} = $props();
</script>

<div
	class="pending"
	class:inline
	style:height={height ? `${height}px` : undefined}
	aria-busy="true"
	data-testid="pending"
>
	<span class="spinner" aria-hidden="true"></span>
	<span class:sr-only={inline}>{label}</span>
</div>

<style>
	.pending {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sp-2);
		min-height: 6rem;
		font-size: var(--text-sm);
		color: var(--text-muted);
		background: var(--surface-2);
		border-radius: var(--radius-sm);
	}
	.pending.inline {
		display: inline-flex;
		flex-direction: row;
		justify-content: flex-start;
		min-height: 0;
		width: 7.5rem;
		height: 1.25rem;
		background: none;
	}
	.spinner {
		width: 1.25rem;
		height: 1.25rem;
		border: 2px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	.inline .spinner {
		width: 0.875rem;
		height: 0.875rem;
	}
	/* Still under reduced motion: a static ring. */
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
		}
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
