<script lang="ts">
	import typeset from './equations.generated.json';
</script>

<!-- The glyph paths every <Tex /> references. Render once per page. -->
<!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG generated from our own TeX sources -->
{@html typeset.defs}
