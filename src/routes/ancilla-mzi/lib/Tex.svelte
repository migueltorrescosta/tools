<script lang="ts">
	import typeset from './equations.generated.json';
	import type { EquationId } from './equations';

	/** An equation typeset at build time (see scripts/typeset-ancilla-mzi.ts). Needs one <TexDefs /> on the page. */
	let { id }: { id: EquationId } = $props();
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG generated from our own TeX sources -->
<span class="tex">{@html typeset.equations[id]}</span>

<style>
	.tex {
		display: inline-block;
		max-width: 100%;
		vertical-align: middle;
		color: var(--text);
	}
	.tex :global(mjx-container) {
		display: inline-block;
		position: relative;
		direction: ltr;
		line-height: 0;
	}
	.tex :global(svg) {
		overflow: visible;
		max-width: 100%;
		height: auto;
	}
	/* The MathML copy is for screen readers only */
	.tex :global(mjx-assistive-mml) {
		position: absolute !important;
		top: 0;
		left: 0;
		width: 1px !important;
		height: 1px !important;
		padding: 1px 0 0 0 !important;
		border: 0 !important;
		overflow: hidden !important;
		clip: rect(1px, 1px, 1px, 1px);
		user-select: none;
	}
</style>
