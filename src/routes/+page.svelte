<script lang="ts">
	const routes = [
		{
			path: '/jwt',
			name: 'JWT Parser',
			description: 'Decode, encode and verify JSON Web Tokens. View header, payload and signature components.'
		},
		{
			path: '/format',
			name: 'Format Checker',
			description: 'Validate JSON, YAML, XML, Markdown and plain text with detailed error reporting.'
		},
		{
			path: '/cipher',
			name: 'Encrypter/Decrypter',
			description: 'Encrypt and decrypt messages using AES-GCM, AES-CBC, RSA-OAEP, Base64, Hex, and ROT13.'
		}
	];
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
		{#each routes as route}
			<a href={route.path} class="route-card">
				<h2>{route.name}</h2>
				<p>{route.description}</p>
			</a>
		{/each}
	</div>
</div>
