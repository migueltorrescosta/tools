<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		startAtEnd = false,
		fade = false,
		width = $bindable(0),
		hint,
		class: className = '',
		children,
		...rest
	}: HTMLAttributes<HTMLDivElement> & {
		/** Open scrolled to the right end. */
		startAtEnd?: boolean;
		/** Fade the right edge out instead of shadowing both edges. */
		fade?: boolean;
		/** The scroller's client width. */
		width?: number;
		/** Shown above the box while the content is wider than it, e.g. "Scroll sideways". */
		hint?: Snippet;
		children: Snippet;
	} = $props();

	let scroller = $state<HTMLDivElement>();
	let more = $state({ left: false, right: false });
	let overflows = $state(false);

	function measure() {
		if (!scroller) return;
		const max = scroller.scrollWidth - scroller.clientWidth;
		more = { left: scroller.scrollLeft > 1, right: scroller.scrollLeft < max - 1 };
		overflows = max > 1;
	}

	// Remeasure when the box or its content changes size.
	$effect(() => {
		const el = scroller;
		if (!el) return;
		if (startAtEnd) el.scrollLeft = el.scrollWidth;
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		for (const child of el.children) observer.observe(child);
		return () => observer.disconnect();
	});
</script>

{#if overflows}{@render hint?.()}{/if}
<div
	class="ui-scroll-edges"
	class:fade
	class:more-left={more.left && !fade}
	class:more-right={more.right}
>
	<div
		class="ui-scroll-edges-scroller {className}"
		bind:this={scroller}
		bind:clientWidth={width}
		onscroll={measure}
		{...rest}
	>
		{@render children()}
	</div>
</div>

<style>
	.ui-scroll-edges {
		position: relative;
	}

	.ui-scroll-edges-scroller {
		overflow-x: auto;
	}

	.ui-scroll-edges:not(.fade)::before,
	.ui-scroll-edges:not(.fade)::after {
		content: '';
		position: absolute;
		top: 1px;
		bottom: 1px;
		z-index: 2;
		width: var(--sp-4);
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.ui-scroll-edges::before {
		left: 1px;
		background: linear-gradient(
			to right,
			color-mix(in srgb, var(--text) 22%, transparent),
			transparent
		);
	}

	.ui-scroll-edges::after {
		right: 1px;
		background: linear-gradient(
			to left,
			color-mix(in srgb, var(--text) 22%, transparent),
			transparent
		);
	}

	.ui-scroll-edges.more-left::before,
	.ui-scroll-edges.more-right::after {
		opacity: 1;
	}

	.fade.more-right > .ui-scroll-edges-scroller {
		mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
	}
</style>
