<script lang="ts">
	import { alsoIn, relationId, type Context, type Relation } from '#lib/institutions/index.js';
	import { KIND_STYLE } from '#lib/institutions/style.js';
	import { Button, Panel } from '#lib/ui/index.js';
	import type { Selection } from './InstitutionGraph.svelte';

	let {
		context,
		selected = $bindable(),
		onswitch
	}: {
		context: Context;
		selected: Selection;
		/** Show the same institution in another context. */
		onswitch: (contextId: string, id: string) => void;
	} = $props();

	const byId = $derived(new Map(context.institutions.map((i) => [i.id, i])));
	const node = $derived(selected?.type === 'node' ? byId.get(selected.id) : undefined);
	const edge = $derived(
		selected?.type === 'edge'
			? context.relations.find((r) => relationId(r) === selected?.id)
			: undefined
	);
	const outgoing = $derived(node ? context.relations.filter((r) => r.from === node.id) : []);
	const incoming = $derived(node ? context.relations.filter((r) => r.to === node.id) : []);
	const elsewhere = $derived(node ? alsoIn(node.id, context.id) : []);

	const LEVEL = {
		global: 'Global',
		european: 'European',
		national: 'National',
		regional: 'Regional',
		local: 'Local',
		private: 'Private'
	} as const;

	const short = (id: string) => {
		const i = byId.get(id);
		return i ? (i.acronym ?? i.name) : id;
	};
	const host = (url: string) => new URL(url).hostname.replace(/^www\./, '');
	const pick = (id: string) => (selected = { type: 'node', id });
	const pickEdge = (r: Relation) => (selected = { type: 'edge', id: relationId(r) });
</script>

{#snippet sources(list: string[])}
	<h4>Sources</h4>
	<ul class="dp-sources">
		{#each list as url (url)}
			<li><a href={url} target="_blank" rel="noopener">{host(url)}</a></li>
		{/each}
	</ul>
{/snippet}

{#snippet bullets(title: string, list: string[])}
	{#if list.length}
		<h4>{title}</h4>
		<ul>
			{#each list as item (item)}<li>{item}</li>{/each}
		</ul>
	{/if}
{/snippet}

<Panel title={node ? node.name : (edge?.label ?? 'Relation')} level={3}>
	{#snippet actions()}
		<Button size="sm" variant="ghost" aria-label="Close details" onclick={() => (selected = null)}
			>✕</Button
		>
	{/snippet}
	<div class="dp" data-testid="detail">
		{#if node}
			<p class="dp-meta">
				{[
					node.officialName,
					node.acronym,
					KIND_STYLE[node.kind].label,
					LEVEL[node.level],
					node.founded && `since ${node.founded}`,
					node.seat
				]
					.filter(Boolean)
					.join(' · ')}
			</p>
			<p>{node.summary}</p>
			{#if node.url}<p>
					<a href={node.url} target="_blank" rel="noopener">{host(node.url)}</a>
				</p>{/if}
			{@render bullets('Responsibilities', node.responsibilities)}
			{@render bullets('Obligations', node.obligations)}
			{#if node.accountableTo.length}
				<h4>Accountable to</h4>
				<ul>
					{#each node.accountableTo as a (a)}
						<li>
							{#if byId.has(a)}
								<button type="button" class="dp-link" onclick={() => pick(a)}
									>{byId.get(a)!.name}</button
								>
							{:else}{a}{/if}
						</li>
					{/each}
				</ul>
			{/if}
			{#if node.overlaps.length}
				<h4>Overlaps</h4>
				<ul>
					{#each node.overlaps as o (o.with)}
						<li>
							<button type="button" class="dp-link" onclick={() => pick(o.with)}
								>{short(o.with)}</button
							>: {o.note}
						</li>
					{/each}
				</ul>
			{/if}
			{#each [{ title: 'Acts on', list: outgoing, other: 'to' }, { title: 'Acted on by', list: incoming, other: 'from' }] as group (group.title)}
				{#if group.list.length}
					<h4>{group.title}</h4>
					<ul>
						{#each group.list as r (relationId(r))}
							{@const id = group.other === 'to' ? r.to : r.from}
							<li>
								<button type="button" class="dp-link" onclick={() => pick(id)}>{short(id)}</button>:
								<button type="button" class="dp-link" onclick={() => pickEdge(r)}>{r.label}</button>
							</li>
						{/each}
					</ul>
				{/if}
			{/each}
			{#if elsewhere.length}
				<h4>Also in</h4>
				<ul>
					{#each elsewhere as c (c.id)}
						<li>
							<button type="button" class="dp-link" onclick={() => onswitch(c.id, node.id)}
								>{c.title}</button
							>
						</li>
					{/each}
				</ul>
			{/if}
			{@render sources(node.sources)}
		{:else if edge}
			<p class="dp-meta">
				<button type="button" class="dp-link" onclick={() => pick(edge.from)}
					>{short(edge.from)}</button
				>
				{edge.label}
				<button type="button" class="dp-link" onclick={() => pick(edge.to)}>{short(edge.to)}</button
				>
			</p>
			{#if edge.detail}<p>{edge.detail}</p>{/if}
			{@render sources(edge.sources)}
		{/if}
	</div>
</Panel>

<style>
	.dp {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		font-size: var(--text-md);
		line-height: var(--leading);
	}

	.dp p,
	.dp ul,
	.dp h4 {
		margin: 0;
	}

	.dp h4 {
		margin-top: var(--sp-1);
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.dp ul {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
		padding-left: var(--sp-4);
	}

	.dp-meta {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.dp-sources {
		font-size: var(--text-sm);
	}

	.dp-link {
		padding: 0;
		font: inherit;
		color: var(--accent);
		text-align: left;
		text-decoration: underline;
		background: none;
		border: none;
		cursor: pointer;
	}
</style>
