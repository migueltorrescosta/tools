<script lang="ts">
	import { page } from '$app/state';
	import Tex from '$lib/ui/Tex.svelte';
	import type { EquationId } from './equations';

	/** An equation typeset at prerender (+page.server.ts). */
	let { id }: { id: EquationId } = $props();
</script>

<Tex html={page.data.tex[id]} />
