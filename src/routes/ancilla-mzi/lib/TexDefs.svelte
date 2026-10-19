<script lang="ts">
	import { page } from '$app/state';
</script>

<!-- The glyph paths every <Tex /> references. Render once per page. -->
<!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG generated from our own TeX sources -->
{@html page.data.tex.defs}
