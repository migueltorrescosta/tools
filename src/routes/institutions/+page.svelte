<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { CONTEXTS, relationId } from '#lib/institutions/index.js';
	import { FAMILY_STYLE, KIND_STYLE, shapePath } from '#lib/institutions/style.js';
	import { PageHeader, Panel, Select } from '#lib/ui/index.js';
	import InstitutionGraph, { type Selection } from './lib/InstitutionGraph.svelte';
	import DetailPanel from './lib/DetailPanel.svelte';

	let contextId = $state(CONTEXTS[0].id);
	let routeId = $state('');
	let selected = $state<Selection>(null);
	/** Institution kinds and relation families turned off in the key. */
	let hidden = $state(new Set<string>());
	let hydrated = $state(false);

	const context = $derived(CONTEXTS.find((c) => c.id === contextId) ?? CONTEXTS[0]);
	const route = $derived(context.routes.find((r) => r.id === routeId));

	const contextOptions = CONTEXTS.map((c) => ({ value: c.id, label: c.title }));
	const routeOptions = $derived([
		{ value: '', label: 'None: the whole map' },
		...context.routes.map((r) => ({ value: r.id, label: r.title }))
	]);

	/** The kinds this context uses, in legend order. */
	const kinds = $derived(
		Object.entries(KIND_STYLE).filter(([k]) => context.institutions.some((i) => i.kind === k))
	);

	function writeUrl() {
		const url = new URL(page.url.href);
		url.searchParams.set('context', context.id);
		if (route) url.searchParams.set('route', route.id);
		else url.searchParams.delete('route');
		goto(url, { shallow: true, replace: true, state: page.state });
	}

	function chooseContext() {
		routeId = '';
		selected = null;
		writeUrl();
	}

	function chooseRoute() {
		selected = null;
		writeUrl();
	}

	function toggle(key: string) {
		const next = new Set(hidden);
		if (!next.delete(key)) next.add(key);
		hidden = next;
	}

	function switchTo(id: string, node: string) {
		contextId = id;
		routeId = '';
		writeUrl();
		selected = { type: 'node', id: node };
	}

	// The details drawer takes focus when it opens and hands it back to its opener when it closes.
	let drawer = $state<HTMLElement>();
	$effect(() => {
		if (!drawer) return;
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		drawer.focus();
		return () => {
			if (opener?.isConnected) opener.focus();
		};
	});

	// ?context and ?route pick the map; unknown values fall back to the first context and no route.
	onMount(() => {
		const params = new URLSearchParams(page.url.search);
		const fromUrl = CONTEXTS.find((c) => c.id === params.get('context'));
		if (fromUrl) contextId = fromUrl.id;
		routeId = context.routes.find((r) => r.id === params.get('route'))?.id ?? '';
		hydrated = true;
	});
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (selected = null)} />

<div class="container in-page" data-hydrated={hydrated || undefined}>
	<PageHeader path="/institutions" />

	<Panel>
		<div class="in-pickers">
			<Select
				label="Context"
				options={contextOptions}
				bind:value={contextId}
				onchange={chooseContext}
				data-testid="context"
			/>
			<Select
				label="Situation"
				options={routeOptions}
				bind:value={routeId}
				onchange={chooseRoute}
				data-testid="route"
			/>
		</div>
		<section class="in-intro" aria-labelledby="in-title">
			<h2 id="in-title">{route?.title ?? context.title}</h2>
			{#if route}
				<ol class="in-steps" data-testid="steps">
					{#each route.steps as step (step.id)}
						{@const i = context.institutions.find((i) => i.id === step.id)!}
						<li>
							<button
								type="button"
								class="in-link"
								onclick={() => (selected = { type: 'node', id: step.id })}
								>{i.acronym ?? i.name}</button
							>: {step.note}
						</li>
					{/each}
				</ol>
			{:else}
				<p>{context.summary}</p>
			{/if}
		</section>
	</Panel>

	<Panel>
		<div class="in-key">
			<ul aria-label="Institutions to show">
				{#each kinds as [kind, style] (kind)}
					<li>
						<button
							type="button"
							class="in-toggle"
							aria-pressed={!hidden.has(kind)}
							data-testid="kind-{kind}"
							onclick={() => toggle(kind)}
						>
							<svg viewBox="0 0 30 16" aria-hidden="true"
								><path
									d={shapePath(style.shape, 15, 8, 28, 14)}
									class="in-swatch"
									style:--kind="var({style.colour})"
									stroke-dasharray={style.dashed ? '4 2' : undefined}
								/></svg
							>{style.label}
						</button>
					</li>
				{/each}
			</ul>
			<ul aria-label="Relations to show">
				{#each Object.entries(FAMILY_STYLE) as [family, style] (family)}
					<li>
						<button
							type="button"
							class="in-toggle"
							aria-pressed={!hidden.has(family)}
							data-testid="family-{family}"
							onclick={() => toggle(family)}
						>
							<svg viewBox="0 0 24 10" aria-hidden="true"
								><line
									x1="1"
									y1="5"
									x2="23"
									y2="5"
									stroke="var({style.colour})"
									stroke-width="2.5"
									stroke-dasharray={style.dash}
								/></svg
							>{style.label}
						</button>
					</li>
				{/each}
			</ul>
		</div>
		{#key context.id}
			<InstitutionGraph {context} {hidden} steps={route?.steps.map((s) => s.id)} bind:selected />
		{/key}

		<div class="in-end">
			<details class="how">
				<summary>How it works</summary>
				<p>
					Each map shows institutions as boxes and how they relate as arrows. The shape and colour
					of a box give its kind; the colour and dashes of an arrow give the kind of relation.
				</p>
				<p>
					Select a box or a label for its details. Pick a situation to light up the bodies involved,
					numbered in order. Turn kinds of institution or relation on or off with the buttons above
					the map.
				</p>
			</details>
			<p class="in-asof">Facts checked on {context.asOf}. Each detail lists its sources.</p>
		</div>
	</Panel>

	{#if selected}
		<aside class="in-drawer" aria-label="Details" tabindex="-1" bind:this={drawer}>
			<DetailPanel {context} bind:selected onswitch={switchTo} />
		</aside>
	{/if}
</div>

<style>
	.in-pickers {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
		gap: var(--sp-3);
		margin-bottom: var(--sp-2);
	}

	.in-intro {
		margin-top: var(--sp-2);
	}

	.in-intro h2 {
		margin: 0;
		font-size: var(--text-xl);
	}

	.in-intro p,
	.in-steps {
		margin: var(--sp-1) 0 0;
		max-width: 70ch;
		line-height: var(--leading);
	}

	.in-steps {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
		padding-left: var(--sp-4);
	}

	.in-link {
		padding: 0;
		font: inherit;
		font-weight: 600;
		color: var(--accent);
		text-decoration: underline;
		background: none;
		border: none;
		cursor: pointer;
	}

	.in-page {
		max-width: none;
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.in-key {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		margin-bottom: var(--sp-3);
	}

	.in-key ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1) var(--sp-3);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.in-key li {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
	}

	.in-key svg {
		width: 1.9rem;
		height: 1rem;
		flex: none;
	}

	.in-swatch {
		fill: color-mix(in srgb, var(--kind) 14%, var(--surface));
		stroke: var(--kind);
		stroke-width: 1.5;
	}

	.in-toggle {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		min-height: 28px;
		padding: 2px var(--sp-2);
		font: inherit;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		cursor: pointer;
	}

	.in-toggle[aria-pressed='false'] {
		color: var(--text-muted);
		text-decoration: line-through;
		background: none;
		border-style: dashed;
	}

	.in-toggle[aria-pressed='false'] svg {
		opacity: 0.35;
	}

	.in-end {
		margin-top: var(--sp-3);
		padding-top: var(--sp-3);
		border-top: 1px solid var(--border);
	}

	.in-end :global(details.how) {
		margin-top: 0;
	}

	.in-asof {
		margin: var(--sp-2) 0 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.in-drawer {
		position: fixed;
		top: var(--topbar-h);
		right: 0;
		bottom: 0;
		z-index: 10;
		width: min(26rem, 100vw);
		overflow-y: auto;
		animation: in-slide 0.15s ease-out;
	}

	.in-drawer:focus {
		outline: none;
	}

	.in-drawer:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.in-drawer > :global(.ui-panel) {
		min-height: 100%;
		border-radius: 0;
	}

	@keyframes in-slide {
		from {
			transform: translateX(100%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.in-drawer {
			animation: none;
		}
	}
</style>
