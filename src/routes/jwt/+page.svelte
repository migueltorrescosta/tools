<script lang="ts">
	import { onMount } from 'svelte';

	let token = $state('');
	let secret = $state('');
	let selectedAlgorithm = $state('HS256');
	let headerJson = $state('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
	let payloadJson = $state(
		'{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}'
	);
	let headerError = $state('');
	let payloadError = $state('');
	let signatureValid = $state<boolean | null>(null);
	let signatureResult = $state('');

	const algorithms = [
		'HS256',
		'HS384',
		'HS512',
		'RS256',
		'RS384',
		'RS512',
		'ES256',
		'ES384',
		'ES512',
		'PS256',
		'PS384',
		'PS512',
		'none'
	];

	function base64UrlEncode(str: string): string {
		return btoa(unescape(encodeURIComponent(str)))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=/g, '');
	}

	function base64UrlDecode(str: string): string {
		str = str.replace(/-/g, '+').replace(/_/g, '/');
		while (str.length % 4) str += '=';
		return decodeURIComponent(escape(atob(str)));
	}

	function decodeToken(t: string) {
		if (!t.trim()) {
			headerJson = '{\n  "alg": "",\n  "typ": "JWT"\n}';
			payloadJson = '';
			headerError = '';
			payloadError = '';
			signatureValid = null;
			signatureResult = '';
			return;
		}

		const parts = t.split('.');
		if (parts.length !== 3) {
			headerError = 'Invalid JWT format';
			payloadError = '';
			return;
		}

		try {
			const header = JSON.parse(base64UrlDecode(parts[0]));
			headerJson = JSON.stringify(header, null, 2);
			headerError = '';
			selectedAlgorithm = header.alg || 'HS256';
		} catch {
			headerError = 'Invalid header JSON';
			headerJson = '';
		}

		try {
			const payload = JSON.parse(base64UrlDecode(parts[1]));
			payloadJson = JSON.stringify(payload, null, 2);
			payloadError = '';
		} catch {
			payloadError = 'Invalid payload JSON';
			payloadJson = '';
		}

		signatureResult = parts[2];
		signatureValid = null;
	}

	function encodeToken() {
		let header: Record<string, unknown>;
		let payload: Record<string, unknown>;

		try {
			header = JSON.parse(headerJson);
		} catch {
			headerError = 'Invalid header JSON';
			return;
		}
		headerError = '';

		try {
			payload = JSON.parse(payloadJson);
		} catch {
			payloadError = 'Invalid payload JSON';
			return;
		}
		payloadError = '';

		header.alg = selectedAlgorithm;
		header.typ = 'JWT';

		const encodedHeader = base64UrlEncode(JSON.stringify(header));
		const encodedPayload = base64UrlEncode(JSON.stringify(payload));
		token = `${encodedHeader}.${encodedPayload}.`;
	}

	function verifySignature() {
		if (!token || !token.includes('.')) return;
		signatureResult = 'Verification requires crypto library';
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
	}

	$effect(() => {
		decodeToken(token);
	});

	onMount(() => {
		token =
			'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
	});
</script>

<svelte:head>
	<title>JWT Tool</title>
</svelte:head>

<div class="container">
	<header>
		<h1>JWT TOOL</h1>
		<p class="subtitle">Decode, Encode & Verify JSON Web Tokens</p>
	</header>

	<div class="token-input-section">
		<div class="section-header">
			<span class="label">ENCODED</span>
			<span class="hint">Paste your JWT token</span>
		</div>
		<textarea
			class="token-input"
			bind:value={token}
			placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
			spellcheck="false"
		></textarea>
	</div>

	<div class="panels">
		<div class="panel header-panel">
			<div class="panel-header">
				<span class="dot red"></span>
				<span class="dot yellow"></span>
				<span class="dot green"></span>
				<span class="panel-title">HEADER</span>
				<button class="copy-btn" onclick={() => copyToClipboard(headerJson)}>COPY</button>
			</div>
			<div class="panel-content">
				{#if headerError}
					<div class="error">{headerError}</div>
				{:else}
					<pre class="json-display">{headerJson}</pre>
				{/if}
			</div>
		</div>

		<div class="panel payload-panel">
			<div class="panel-header">
				<span class="dot red"></span>
				<span class="dot yellow"></span>
				<span class="dot green"></span>
				<span class="panel-title">PAYLOAD</span>
				<button class="copy-btn" onclick={() => copyToClipboard(payloadJson)}>COPY</button>
			</div>
			<div class="panel-content">
				{#if payloadError}
					<div class="error">{payloadError}</div>
				{:else}
					<pre class="json-display">{payloadJson}</pre>
				{/if}
			</div>
		</div>

		<div class="panel signature-panel">
			<div class="panel-header">
				<span class="dot red"></span>
				<span class="dot yellow"></span>
				<span class="dot green"></span>
				<span class="panel-title">VERIFY</span>
			</div>
			<div class="panel-content">
				<div class="signature-row">
					<div class="secret-section">
						<label class="input-label">SECRET</label>
						<input type="text" class="secret-input" bind:value={secret} placeholder="secret" />
					</div>

					<div class="algorithm-section">
						<label class="input-label">ALGORITHM</label>
						<select class="algorithm-select" bind:value={selectedAlgorithm}>
							{#each algorithms as alg}
								<option value={alg}>{alg}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="signature-display">
					<label class="input-label">SIGNATURE</label>
					<div class="signature-value">{signatureResult || 'Not available'}</div>
				</div>

				{#if signatureValid === true}
					<div class="signature-status valid">Signature Verified</div>
				{:else if signatureValid === false}
					<div class="signature-status invalid">Signature Invalid</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="encode-section">
		<div class="section-header">
			<span class="label">DECODE & ENCODE</span>
			<span class="hint">Modify header and payload, then encode</span>
		</div>

		<div class="encode-inputs">
			<div class="encode-input-group">
				<label class="input-label">HEADER (JSON)</label>
				<textarea
					class="encode-textarea"
					bind:value={headerJson}
					placeholder={'{"alg": "HS256", "typ": "JWT"}'}
					spellcheck="false"
				></textarea>
				{#if headerError}<div class="error-small">{headerError}</div>{/if}
			</div>

			<div class="encode-input-group">
				<label class="input-label">PAYLOAD (JSON)</label>
				<textarea
					class="encode-textarea"
					bind:value={payloadJson}
					placeholder={'{"sub": "1234567890", "name": "John Doe"}'}
					spellcheck="false"
				></textarea>
				{#if payloadError}<div class="error-small">{payloadError}</div>{/if}
			</div>
		</div>

		<button class="encode-btn" onclick={encodeToken}>
			<span class="btn-text">ENCODE TOKEN</span>
			<span class="btn-glow"></span>
		</button>
	</div>
</div>
