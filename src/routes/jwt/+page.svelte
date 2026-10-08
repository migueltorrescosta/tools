<script lang="ts">
	import { onMount } from 'svelte';
	import { copyToClipboard } from '$lib/clipboard';
	import {
		algorithmOptions,
		describeClaims,
		headerJsonAlg,
		isSymmetric,
		jsonWarnings,
		parseEncodeInputs,
		signJwt,
		tokenView,
		verifyJwt,
		withHeaderAlg,
		type JsonObject,
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
	let decodeWarnings = $state<string[]>([]);
	let decodedPayload = $state<JsonObject | undefined>(undefined);
	let unsignedBanner = $state('');
	let now = $state(Date.now());
	let showSecret = $state(false);
	let copyStatus = $state('');
	let hydrated = $state(false);
	// An unknown header alg (e.g. ES256K) gets its own option so the select never shows a blank
	const algorithms = $derived(algorithmOptions(selectedAlgorithm));
	const claims = $derived(describeClaims(decodedPayload, now));
	// What ENCODE would change: JSON.parse rounds big integers and drops duplicate keys
	const encodeWarnings = $derived([
		...jsonWarnings(headerJson).map((w) => `Header: ${w}`),
		...jsonWarnings(payloadJson).map((w) => `Payload: ${w}`)
	]);

	function decodeToken(t: string) {
		const view = tokenView(t);
		headerJson = view.headerJson;
		payloadJson = view.payloadJson;
		headerError = view.headerError;
		payloadError = view.payloadError;
		signatureResult = view.signature;
		signatureError = view.signatureError;
		decodeWarnings = view.warnings;
		decodedPayload = view.payload;
		unsignedBanner = view.unsigned;
		copyStatus = '';
		if (view.alg) selectedAlgorithm = view.alg;
	}

	// The header JSON and the select name the same alg: each edit updates the other
	function selectAlgorithm(alg: string) {
		selectedAlgorithm = alg;
		headerJson = withHeaderAlg(headerJson, alg);
	}

	function editHeader(text: string) {
		headerJson = text;
		const alg = headerJsonAlg(text);
		if (alg) selectedAlgorithm = alg;
	}

	async function copy(label: string, text: string) {
		try {
			await copyToClipboard(text);
			copyStatus = `${label} copied`;
		} catch (e) {
			copyStatus = `Could not copy ${label.toLowerCase()}: ${e instanceof Error ? e.message : String(e)}`;
		}
	}

	async function encodeToken() {
		const parsed = parseEncodeInputs(headerJson, payloadJson, selectedAlgorithm);
		headerError = parsed.ok ? '' : parsed.headerError;
		payloadError = parsed.ok ? '' : parsed.payloadError;
		if (!parsed.ok) return;
		const { header, payload, alg } = parsed;
		selectedAlgorithm = alg;

		try {
			token = await signJwt(header, payload, secret, alg);
			encodeError = '';
			encodeNote = alg === 'none' ? 'Unsigned token (alg "none"): the signature is empty' : '';
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
		hydrated = true;
		const clock = setInterval(() => (now = Date.now()), 1000);
		token =
			'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
		return () => clearInterval(clock);
	});
</script>

<svelte:head>
	<title>JWT Parser</title>
</svelte:head>

<div class="container" data-hydrated={hydrated || undefined}>
	<header>
		<h1>JWT PARSER</h1>
		<p class="subtitle">Decode, Encode & Verify JSON Web Tokens</p>
	</header>

	<div class="token-input-section">
		<div class="section-header">
			<label class="label" for="token-input">ENCODED</label>
			<span class="hint">Paste your JWT token</span>
		</div>
		<textarea
			id="token-input"
			class="token-input"
			bind:value={token}
			placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
			spellcheck="false"
		></textarea>
	</div>

	{#if unsignedBanner}
		<div class="signature-status invalid" role="alert">{unsignedBanner}</div>
	{/if}

	{#if decodeWarnings.length}
		<div class="key-warning" role="status">
			{#each decodeWarnings as warning, i (i)}<div>{warning}</div>{/each}
		</div>
	{/if}

	{#if copyStatus}<div class="copy-status" role="status">{copyStatus}</div>{/if}

	<div class="panels">
		<div class="panel header-panel">
			<div class="panel-header">
				<span class="dot red"></span>
				<span class="dot yellow"></span>
				<span class="dot green"></span>
				<span class="panel-title">HEADER</span>
				<button
					class="copy-btn"
					aria-label="Copy header JSON"
					disabled={!!headerError || !headerJson}
					onclick={() => copy('Header', headerJson)}>COPY</button
				>
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
				<button
					class="copy-btn"
					aria-label="Copy payload JSON"
					disabled={!!payloadError || !payloadJson}
					onclick={() => copy('Payload', payloadJson)}>COPY</button
				>
			</div>
			<div class="panel-content">
				{#if payloadError}
					<div class="error">{payloadError}</div>
				{:else}
					<pre class="json-display">{payloadJson}</pre>
				{/if}
				{#if claims.expired}
					<div class="signature-status invalid">Expired</div>
				{:else if claims.notYetValid}
					<div class="signature-status invalid">Not yet valid (nbf)</div>
				{/if}
				{#if claims.issuedInFuture}
					<div class="key-warning">Issued in the future (iat)</div>
				{/if}
				{#each claims.times as claim (claim.name)}
					<div class="claim-time">
						{claim.name}: {claim.iso} ({claim.relative})
					</div>
				{/each}
				{#each claims.errors as error, i (i)}
					<div class="error-small">{error}</div>
				{/each}
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
						<div class="secret-row">
							<input
								id="secret-input"
								type={showSecret ? 'text' : 'password'}
								class="secret-input"
								autocomplete="off"
								spellcheck="false"
								bind:value={secret}
								placeholder={isSymmetric(selectedAlgorithm)
									? 'secret'
									: 'public key verifies, private key signs'}
							/>
							<button
								type="button"
								class="copy-btn"
								aria-pressed={showSecret}
								aria-controls="secret-input"
								onclick={() => (showSecret = !showSecret)}>{showSecret ? 'HIDE' : 'SHOW'}</button
							>
						</div>
					</div>

					<div class="algorithm-section">
						<label class="input-label" for="algorithm-select">ALGORITHM</label>
						<select
							id="algorithm-select"
							class="algorithm-select"
							bind:value={() => selectedAlgorithm, selectAlgorithm}
						>
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
					bind:value={() => headerJson, editHeader}
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
		{#if encodeWarnings.length}
			<div class="key-warning">
				{#each encodeWarnings as warning, i (i)}<div>ENCODE changes this: {warning}</div>{/each}
			</div>
		{/if}
		{#if encodeError}<div class="error-small" role="alert">{encodeError}</div>{/if}
		{#if encodeNote}<div class="key-warning">{encodeNote}</div>{/if}
	</div>
</div>

<style>
	.secret-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.secret-row .secret-input {
		flex: 1;
		min-width: 0;
	}

	.copy-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.copy-status {
		margin-bottom: 1rem;
		font-size: 0.8rem;
		color: var(--futuristic-text-dim);
	}

	.claim-time {
		margin-top: 0.25rem;
		font-size: 0.8rem;
		color: var(--futuristic-text-dim);
	}
</style>
