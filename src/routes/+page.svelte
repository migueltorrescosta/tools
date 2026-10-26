<script lang="ts">
	import { base } from '$app/paths';
	import { routes, TOOL_GROUPS } from '$lib/routes';

	const groups = TOOL_GROUPS.map((group) => ({
		group,
		id: `group-${group.toLowerCase().replaceAll(' ', '-')}`,
		tools: routes.filter((route) => route.group === group)
	}));
</script>

<svelte:head>
	<title>Tools</title>
</svelte:head>

<div class="container">
	<header class="intro">
		<h1>Tools</h1>
		<p class="intro-subtitle">Small utilities that run entirely in your browser.</p>
	</header>

	{#each groups as { group, id, tools } (group)}
		<section aria-labelledby={id}>
			<h2 {id}>{group}</h2>
			<ul class="grid">
				{#each tools as route (route.path)}
					<li>
						<a class="tool-card" href={`${base}${route.path}`}>
							<h3>{route.name}</h3>
							<p>{route.description}</p>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.intro {
		margin-bottom: var(--sp-3);
	}

	.intro-subtitle {
		margin: var(--sp-1) 0 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	section + section {
		margin-top: var(--sp-4);
	}

	h2 {
		margin: 0 0 var(--sp-1);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-muted);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
		gap: var(--sp-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tool-card {
		display: block;
		height: 100%;
		padding: var(--sp-2) var(--sp-3);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
		text-decoration: none;
	}

	.tool-card:hover {
		border-color: var(--accent);
		background: var(--surface-2);
	}

	h3 {
		margin: 0;
		font-size: var(--text-md);
		color: var(--accent);
	}

	p {
		margin: var(--sp-1) 0 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	/* Phones: one list per group, a row per tool with its name beside the sentence */
	@media (max-width: 600px) {
		.grid {
			display: block;
			background: var(--surface);
			border: 1px solid var(--border);
			border-radius: var(--radius);
		}

		li + li {
			border-top: 1px solid var(--border);
		}

		.tool-card {
			display: grid;
			grid-template-columns: 9.5rem 1fr;
			gap: var(--sp-2);
			align-items: baseline;
			background: transparent;
			border: 0;
			border-radius: 0;
		}

		p {
			margin: 0;
		}
	}
</style>
