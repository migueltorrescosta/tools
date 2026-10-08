<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { routes } from '$lib/routes';

	function navigate(path: string) {
		goto(path);
	}
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
			<button class="route-card" onclick={() => navigate(`${base}${route.path}`)}>
				<h2>{route.name}</h2>
				<p>{route.description}</p>
			</button>
		{/each}
	</div>
</div>
