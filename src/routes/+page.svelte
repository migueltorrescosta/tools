<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';

	const routes = [
		{
			path: '/jwt',
			name: 'JWT Parser',
			description:
				'Decode, encode and verify JSON Web Tokens. View header, payload and signature components.'
		},
		{
			path: '/format',
			name: 'Format Checker',
			description:
				'Validate JSON, YAML, XML, Markdown and plain text with detailed error reporting.'
		},
		{
			path: '/cipher',
			name: 'Encrypter/Decrypter',
			description:
				'Encrypt and decrypt messages using AES-GCM, AES-CBC, RSA-OAEP, Base64, Hex, and ROT13.'
		}
	];

	function navigate(path: string) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(path);
	}
</script>

<svelte:head>
	<title>Tools</title>
</svelte:head>

<div class="container">
	<header>
		<h1>TOOLS</h1>
		<p class="subtitle">Collection of Developer Utilities</p>
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
