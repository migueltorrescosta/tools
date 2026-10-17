<script lang="ts">
	import { onMount } from 'svelte';
	import { copyToClipboard } from '$lib/clipboard';
	import { Alert, Button, Field, PageHeader, Panel, Select } from '$lib/ui';
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
	const algorithms = $derived(
		algorithmOptions(selectedAlgorithm).map((alg) => ({ value: alg, label: alg }))
	);
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

<div class="container" data-hydrated={hydrated || undefined}>
	<PageHeader path="/jwt" />

	<div class="split-view top">
		<div class="stack">
			<Panel title="Encoded token">
				<div class="stack">
					<Field label="Encoded token" hideLabel>
						{#snippet children(props)}
							<textarea
								{...props}
								class="control token"
								rows="4"
								bind:value={token}
								placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
								spellcheck="false"
							></textarea>
						{/snippet}
					</Field>
					{#if unsignedBanner}<Alert tone="danger">{unsignedBanner}</Alert>{/if}
					{#if decodeWarnings.length}
						<Alert tone="warning">
							{#each decodeWarnings as warning, i (i)}<div>{warning}</div>{/each}
						</Alert>
					{/if}
					{#if copyStatus}<p class="muted" role="status">{copyStatus}</p>{/if}
				</div>
			</Panel>

			<Panel title="Verify signature">
				<div class="stack">
					<div class="verify-row">
						<Field label={isSymmetric(selectedAlgorithm) ? 'Secret' : 'Key (PEM or JWK)'}>
							{#snippet children(props)}
								<div class="cluster secret-row">
									<input
										{...props}
										type={showSecret ? 'text' : 'password'}
										class="control"
										autocomplete="off"
										spellcheck="false"
										bind:value={secret}
										placeholder={isSymmetric(selectedAlgorithm)
											? 'secret'
											: 'public key verifies, private key signs'}
									/>
									<Button
										pressed={showSecret}
										aria-controls={props.id}
										onclick={() => (showSecret = !showSecret)}>Show</Button
									>
								</div>
							{/snippet}
						</Field>
						<Select
							label="Algorithm"
							options={algorithms}
							bind:value={() => selectedAlgorithm, selectAlgorithm}
						/>
					</div>

					<div>
						<p class="sig-label">Signature</p>
						<code class="signature" data-testid="signature-value"
							>{signatureResult || 'Not available'}</code
						>
						{#if signatureError}<p class="error-text">{signatureError}</p>{/if}
					</div>

					{#if verification?.status === 'valid'}
						<Alert tone="success"
							><span data-testid="signature-status">Signature Verified</span></Alert
						>
					{:else if verification?.status === 'invalid'}
						<Alert tone="danger">
							<div data-testid="signature-status">Signature Invalid</div>
							<div>{verification.message}</div>
						</Alert>
					{:else if verification}
						<Alert tone="warning">{verification.message}</Alert>
					{/if}
				</div>
			</Panel>
		</div>

		<div class="stack">
			<Panel title="Header">
				{#snippet actions()}
					<Button
						size="sm"
						variant="ghost"
						aria-label="Copy header JSON"
						disabled={!!headerError || !headerJson}
						onclick={() => copy('Header', headerJson)}>Copy</Button
					>
				{/snippet}
				<div data-testid="decoded-header">
					{#if headerError}
						<p class="error-text">{headerError}</p>
					{:else}
						<pre>{headerJson}</pre>
					{/if}
				</div>
			</Panel>

			<Panel title="Payload">
				{#snippet actions()}
					<Button
						size="sm"
						variant="ghost"
						aria-label="Copy payload JSON"
						disabled={!!payloadError || !payloadJson}
						onclick={() => copy('Payload', payloadJson)}>Copy</Button
					>
				{/snippet}
				<div class="stack" data-testid="decoded-payload">
					{#if payloadError}
						<p class="error-text">{payloadError}</p>
					{:else}
						<pre>{payloadJson}</pre>
					{/if}
					{#if claims.expired}
						<Alert tone="danger">Expired</Alert>
					{:else if claims.notYetValid}
						<Alert tone="danger">Not yet valid (nbf)</Alert>
					{/if}
					{#if claims.issuedInFuture}
						<Alert tone="warning">Issued in the future (iat)</Alert>
					{/if}
					{#if claims.times.length || claims.errors.length}
						<ul class="claims">
							{#each claims.times as claim (claim.name)}
								<li>{claim.name}: {claim.iso} ({claim.relative})</li>
							{/each}
							{#each claims.errors as error, i (i)}
								<li class="error-text">{error}</li>
							{/each}
						</ul>
					{/if}
				</div>
			</Panel>
		</div>
	</div>

	<div class="encode">
		<Panel title="Encode">
			<div class="stack">
				<p class="muted">Edit the header and payload, then sign with the key above.</p>
				<div class="split-view">
					<Field label="Header (JSON)" error={headerError || undefined}>
						{#snippet children(props)}
							<textarea
								{...props}
								class="control"
								rows="6"
								bind:value={() => headerJson, editHeader}
								placeholder={'{"alg": "HS256", "typ": "JWT"}'}
								spellcheck="false"
							></textarea>
						{/snippet}
					</Field>
					<Field label="Payload (JSON)" error={payloadError || undefined}>
						{#snippet children(props)}
							<textarea
								{...props}
								class="control"
								rows="6"
								bind:value={payloadJson}
								placeholder={'{"sub": "1234567890", "name": "John Doe"}'}
								spellcheck="false"
							></textarea>
						{/snippet}
					</Field>
				</div>
				{#if encodeWarnings.length}
					<Alert tone="warning">
						{#each encodeWarnings as warning, i (i)}<div>Encode changes this: {warning}</div>{/each}
					</Alert>
				{/if}
				{#if encodeError}<Alert tone="danger">{encodeError}</Alert>{/if}
				{#if encodeNote}<Alert tone="info">{encodeNote}</Alert>{/if}
				<div>
					<Button variant="primary" onclick={encodeToken}
						>{selectedAlgorithm === 'none' ? 'Encode unsigned' : 'Sign & encode'}</Button
					>
				</div>
			</div>
		</Panel>
	</div>
</div>

<style>
	.top {
		align-items: start;
	}

	.verify-row {
		display: grid;
		grid-template-columns: 1fr minmax(8rem, 10rem);
		gap: var(--sp-3);
		align-items: start;
	}

	.secret-row {
		flex-wrap: nowrap;
	}

	.secret-row .control {
		flex: 1;
		min-width: 0;
	}

	.token,
	.signature,
	pre {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		word-break: break-all;
	}

	pre {
		margin: 0;
		white-space: pre-wrap;
	}

	.signature {
		display: block;
		color: var(--text);
	}

	.sig-label {
		margin: 0 0 var(--sp-1);
		font-size: var(--text-sm);
		font-weight: 500;
	}

	.muted,
	.claims {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.claims {
		padding-left: var(--sp-4);
	}

	.error-text {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--danger-text);
	}

	.encode {
		margin-top: var(--sp-3);
	}
</style>
