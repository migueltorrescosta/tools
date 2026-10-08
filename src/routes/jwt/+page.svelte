<script lang="ts">
	import { onMount } from 'svelte';
	import { copyToClipboard } from '$lib/clipboard';
	import {
		ALGORITHMS as algorithms,
		decodeJwt,
		isSymmetric,
		parseEncodeInputs,
		signJwt,
		verifyJwt,
		type VerifyResult
	} from '$lib/jwt';

	let token = $state('');
	let secret = $state('');
	let selectedAlgorithm = $state('HS256');
	let headerJson = $state('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
	let payloadJson = $state(
		'{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}'
	);
	let headerError = $state('');
	let payloadError = $state('');
	let encodeError = $state('');
	let encodeNote = $state('');
	let verification = $state<VerifyResult | null>(null);
	// Bumped per verification so a slow earlier result cannot overwrite a newer one
	let verifySeq = 0;
	let signatureResult = $state('');
	let signatureError = $state('');

	function decodeToken(t: string) {
		if (!t.trim()) {
			headerJson = '{\n  "alg": "",\n  "typ": "JWT"\n}';
			payloadJson = '';
			headerError = '';
			payloadError = '';
			signatureResult = '';
			signatureError = '';
			return;
		}

		const decoded = decodeJwt(t);
		if (decoded.formatError) {
			headerError = decoded.formatError;
			payloadError = '';
			return;
		}

		headerError = decoded.headerError;
		if (decoded.headerError) {
			headerJson = '';
		} else {
			headerJson = JSON.stringify(decoded.header, null, 2);
			const alg = decoded.header?.alg;
			selectedAlgorithm = typeof alg === 'string' && alg ? alg : 'HS256';
		}

		payloadError = decoded.payloadError;
		payloadJson = decoded.payloadError ? '' : JSON.stringify(decoded.payload, null, 2);

		signatureResult = decoded.signature;
		signatureError = decoded.signatureError;
	}

	async function encodeToken() {
		const parsed = parseEncodeInputs(headerJson, payloadJson, selectedAlgorithm);
		headerError = parsed.ok ? '' : parsed.headerError;
		payloadError = parsed.ok ? '' : parsed.payloadError;
		if (!parsed.ok) return;
		const { header, payload } = parsed;

		try {
			token = await signJwt(header, payload, secret, selectedAlgorithm);
			encodeError = '';
			encodeNote =
				selectedAlgorithm === 'none' ? 'Unsigned token (alg "none"): the signature is empty' : '';
		} catch (e) {
			encodeError = `Not encoded: ${e instanceof Error ? e.message : String(e)}`;
			encodeNote = '';
		}
	}

	$effect(() => {
		decodeToken(token);
	});

	$effect(() => {
		const t = token;
		const key = secret;
		const alg = selectedAlgorithm;
		const seq = ++verifySeq;
		if (!t.trim() || (!key && alg !== 'none')) {
			verification = null;
			return;
		}
		verifyJwt(t, key, alg).then((r) => {
			if (seq === verifySeq) verification = r;
		});
	});

	onMount(() => {
		token =
			'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
	});
</script>

<svelte:head>
	<title>JWT Parser</title>
</svelte:head>

<div class="container">
	<header>
		<h1>JWT PARSER</h1>
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
						<label class="input-label" for="secret-input"
							>{isSymmetric(selectedAlgorithm) ? 'SECRET' : 'KEY (PEM OR JWK)'}</label
						>
						<input
							id="secret-input"
							type="text"
							class="secret-input"
							bind:value={secret}
							placeholder={isSymmetric(selectedAlgorithm)
								? 'secret'
								: 'public key verifies, private key signs'}
						/>
					</div>

					<div class="algorithm-section">
						<label class="input-label" for="algorithm-select">ALGORITHM</label>
						<select id="algorithm-select" class="algorithm-select" bind:value={selectedAlgorithm}>
							{#each algorithms as alg (alg)}
								<option value={alg}>{alg}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="signature-display">
					<span class="input-label">SIGNATURE</span>
					<div class="signature-value">{signatureResult || 'Not available'}</div>
					{#if signatureError}<div class="error-small">{signatureError}</div>{/if}
				</div>

				{#if verification?.status === 'valid'}
					<div class="signature-status valid">Signature Verified</div>
				{:else if verification?.status === 'invalid'}
					<div class="signature-status invalid">Signature Invalid</div>
					<div class="error-small">{verification.message}</div>
				{:else if verification}
					<div class="key-warning">{verification.message}</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="encode-section">
		<div class="section-header">
			<span class="label">DECODE & ENCODE</span>
			<span class="hint">Modify header and payload, then sign with the key above</span>
		</div>

		<div class="encode-inputs">
			<div class="encode-input-group">
				<label class="input-label" for="header-json">HEADER (JSON)</label>
				<textarea
					id="header-json"
					class="encode-textarea"
					bind:value={headerJson}
					placeholder={'{"alg": "HS256", "typ": "JWT"}'}
					spellcheck="false"
				></textarea>
				{#if headerError}<div class="error-small">{headerError}</div>{/if}
			</div>

			<div class="encode-input-group">
				<label class="input-label" for="payload-json">PAYLOAD (JSON)</label>
				<textarea
					id="payload-json"
					class="encode-textarea"
					bind:value={payloadJson}
					placeholder={'{"sub": "1234567890", "name": "John Doe"}'}
					spellcheck="false"
				></textarea>
				{#if payloadError}<div class="error-small">{payloadError}</div>{/if}
			</div>
		</div>

		<button class="encode-btn" onclick={encodeToken}>
			<span class="btn-text"
				>{selectedAlgorithm === 'none' ? 'ENCODE UNSIGNED' : 'SIGN & ENCODE'}</span
			>
			<span class="btn-glow"></span>
		</button>
		{#if encodeError}<div class="error-small" role="alert">{encodeError}</div>{/if}
		{#if encodeNote}<div class="key-warning">{encodeNote}</div>{/if}
	</div>
</div>
