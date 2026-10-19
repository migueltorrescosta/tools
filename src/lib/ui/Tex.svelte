<script lang="ts">
	import 'katex/dist/katex.min.css';

	/** HTML from `renderTex` in `$lib/tex`, rendered in the browser or at prerender. */
	let { html }: { html: string } = $props();
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- KaTeX output of TeX the tools generate -->
<span class="ui-tex">{@html html}</span>

<style>
	.ui-tex {
		display: inline-block;
		max-width: 100%;
		vertical-align: middle;
		color: var(--text);
	}
</style>
