<script lang="ts">
	import { base } from '$app/paths';
	import { routes } from '$lib/routes';
</script>

<svelte:head>
	<title>Tools</title>
</svelte:head>

<div class="container">
	<header>
		<h1>Tools</h1>
		<p class="subtitle">Small utilities that run entirely in your browser.</p>
	</header>

	<ul class="grid">
		{#each routes as route (route.path)}
			<li>
				<a class="tool-card" href={`${base}${route.path}`}>
					<h2>{route.name}</h2>
					<p>{route.description}</p>
				</a>
			</li>
		{/each}
	</ul>
</div>

<style>
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

	h2 {
		font-size: var(--text-md);
		color: var(--accent);
	}

	p {
		margin: var(--sp-1) 0 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
