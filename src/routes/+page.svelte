<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { routes, TOOL_GROUPS } from '#lib/routes.js';

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

<div class="container">
	<h1 class="sr-only">Tools</h1>
	<p class="intro">Small tools that run in your browser.</p>

	<div class="filter-row">
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
			<span class="filter-count" role="status">{count} of {routes.length}</span>
		{/if}
	</div>

	{#if count === 0}
		<p class="empty">No tool matches “{query.trim()}”. Try a shorter word.</p>
	{:else if flatten}
		<ul class="tools-list sheet flat">
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
		<div class="sheet groups">
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
</div>

<style>
	.intro {
		margin: var(--sp-2) 0 var(--sp-4);
		font-size: 1.05rem;
		color: var(--text);
	}
	.filter-row {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		margin-bottom: var(--sp-4);
	}
	.filter {
		width: 100%;
		max-width: 26rem;
		min-height: 40px;
		padding: 0 var(--sp-3);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--sunken);
		color: var(--text);
		font-size: 1rem;
	}
	.filter-count {
		color: var(--text-muted);
		font-size: var(--text-sm);
		white-space: nowrap;
	}
	.empty {
		color: var(--text-muted);
	}
	.sheet {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--box-shadow);
		padding: var(--sp-4) var(--sp-5);
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
	.sheet.flat {
		padding: var(--sp-2) var(--sp-3);
	}
	.flat .tool {
		margin: 0;
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
	@media (max-width: 40rem) {
		.sheet {
			margin: 0 calc(-1 * var(--sp-4));
			border-inline: 0;
			border-radius: 0;
			padding: var(--sp-3) var(--sp-4);
		}
	}
</style>
