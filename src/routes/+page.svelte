<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { routes, TOOL_GROUPS } from '#lib/routes.js';
	import { Panel } from '#lib/ui/index.js';

	const groups = TOOL_GROUPS.map((group) => ({
		group,
		id: `group-${group.toLowerCase().replaceAll(' ', '-')}`,
		tools: routes.filter((route) => route.group === group)
	}));

	let query = $state('');
	const words = $derived(query.trim().toLowerCase().split(/\s+/).filter(Boolean));
	const matches = (route: (typeof routes)[number]) => {
		const text = `${route.name} ${route.description} ${route.group}`.toLowerCase();
		return words.every((w) => text.includes(w));
	};
	const shown = $derived(
		groups.map((g) => ({ ...g, tools: g.tools.filter(matches) })).filter((g) => g.tools.length)
	);
	const flat = $derived(routes.filter(matches));
	// While filtering, the matches drop their groups: one list, the first opened by Enter.
	const flatten = $derived(words.length > 0);
	const count = $derived(flat.length);

	let input: HTMLInputElement | undefined = $state();
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && flat[0]) goto(resolve(flat[0].path));
		if (e.key === 'Escape') query = '';
	}
	function onWindowKey(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		if (e.key === '/' && !t.closest('input, textarea, select')) {
			e.preventDefault();
			input?.focus();
		}
	}
</script>

<svelte:head>
	<title>Tools</title>
</svelte:head>
<svelte:window onkeydown={onWindowKey} />

<div class="container home">
	<h1 class="sr-only">Tools</h1>

	<div class="find">
		<Panel>
			<p class="intro">Small tools that run in your browser.</p>
			<label class="sr-only" for="tool-filter">Filter tools</label>
			<input
				id="tool-filter"
				class="filter"
				type="search"
				placeholder="Filter tools  ( / )"
				autocomplete="off"
				bind:this={input}
				bind:value={query}
				onkeydown={onKey}
			/>
			{#if words.length}
				<p class="filter-count" role="status">{count} of {routes.length}</p>
			{/if}
		</Panel>
	</div>

	<Panel>
		{#if count === 0}
			<p class="empty">No tool matches “{query.trim()}”. Try a shorter word.</p>
		{:else if flatten}
			<ul class="tools-list flat">
				{#each flat as route, i (route.path)}
					<li>
						<a class="tool" class:first={i === 0} href={resolve(route.path)}>
							<span class="tool-name">{route.name}</span>
							<span class="tool-desc">{route.description}</span>
							{#if i === 0}<span class="enter" aria-hidden="true">Enter ↵</span>{/if}
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<div class="groups">
				{#each shown as { group, id, tools } (group)}
					<section class="tools-group" aria-labelledby={id}>
						<h2 {id}>{group}</h2>
						<ul class="tools-list">
							{#each tools as route (route.path)}
								<li>
									<a class="tool" href={resolve(route.path)}>
										<span class="tool-name">{route.name}</span>
										<span class="tool-desc">{route.description}</span>
									</a>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		{/if}
	</Panel>
</div>

<style>
	/* Two boxes: the find box (intro, filter, count) and the list box. On a wide screen the
	   find box is a narrow column beside the list; on a phone it sits on top. Either way it
	   stays in view while the list scrolls. */
	.home {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}
	.find {
		position: sticky;
		top: var(--topbar-h);
		z-index: 5;
	}
	@media (min-width: 48rem) {
		.home {
			display: grid;
			grid-template-columns: 17rem minmax(0, 1fr);
			gap: var(--sp-4);
			align-items: start;
		}
		.find {
			top: calc(var(--topbar-h) + var(--sp-2));
		}
	}
	.intro {
		margin: 0 0 var(--sp-3);
		font-size: 1.05rem;
		color: var(--text);
	}
	.filter {
		width: 100%;
		min-height: 40px;
		padding: 0 var(--sp-3);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--sunken);
		color: var(--text);
		font-size: 1rem;
	}
	.filter-count {
		margin: var(--sp-2) 0 0;
		color: var(--text-muted);
		font-size: var(--text-sm);
	}
	.empty {
		margin: 0;
		color: var(--text-muted);
	}
	@media (min-width: 64rem) {
		.groups {
			columns: 2;
			column-gap: var(--sp-6);
		}
	}
	.tools-group {
		break-inside: avoid;
		margin-bottom: var(--sp-5);
	}
	.tools-group:last-child {
		margin-bottom: 0;
	}
	.tools-group h2 {
		margin: 0 0 var(--sp-1);
		padding-bottom: var(--sp-1);
		border-bottom: 1px solid var(--border);
		color: var(--text-muted);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.tools-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tool {
		display: block;
		position: relative;
		margin: 0 calc(-1 * var(--sp-2));
		padding: var(--sp-2);
		border-radius: var(--radius);
		color: var(--text);
		text-decoration: none;
	}
	.tool:hover {
		background: var(--surface-2);
	}
	.tool:hover .tool-name {
		color: var(--accent);
	}
	.tool-name {
		display: block;
		font-size: 1rem;
		font-weight: 600;
	}
	.tool-desc {
		display: block;
		margin-top: 2px;
		color: var(--text-muted);
		font-size: var(--text-md);
	}
	.flat .tool.first {
		background: var(--accent-bg);
	}
	.enter {
		position: absolute;
		top: var(--sp-2);
		right: var(--sp-2);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
</style>
