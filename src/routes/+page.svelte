<script lang="ts">
	import { base } from '$app/paths';
	import { routes } from '$lib/routes';
</script>

<svelte:head>
	<title>Tools</title>
</svelte:head>

<div class="container">
	<header>
		<h1>TOOLS</h1>
	</header>

	<div class="homepage-grid">
		{#each routes as route (route.path)}
			<a class="route-card" href={`${base}${route.path}`}>
				<h2>{route.name}</h2>
				<p>{route.description}</p>
			</a>
		{/each}
	</div>
</div>
