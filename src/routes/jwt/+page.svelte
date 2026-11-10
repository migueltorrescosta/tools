<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { copyToClipboard } from '#lib/clipboard.js';
	import { Alert, Button, Field, Fold, PageHeader, Panel, Select } from '#lib/ui/index.js';
	import {
		SIGNATURE_MISMATCH,
		algorithmOptions,
		claimLines,
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
	} from '#lib/jwt.js';

	let token = $state('');
	let secret = $state('');
	let selectedAlgorithm = $state('HS256');
	let headerJson = $state('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
	let payloadJson = $state(
		'{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}'
	);
	// The Encode editors' own JSON errors; a bad token never touches them
	let headerError = $state('');
	let payloadError = $state('');
	// What the token decodes to, shown in the Header and Payload panels
	let decodedHeaderJson = $state('');
	let decodedPayloadJson = $state('');
	let tokenError = $state('');
	let encodeError = $state('');
	let encodeNote = $state('');
	let verification = $state<VerifyResult | null>(null);
	// Bumped per verification so a slow earlier result cannot overwrite a newer one
	let verifySeq = 0;
	let signatureError = $state('');
	let decodeWarnings = $state<string[]>([]);
	let decodedPayload = $state<JsonObject | undefined>(undefined);
	let unsignedBanner = $state('');
	let now = $state(Date.now());
	let showSecret = $state(false);
	// The alg the token's header names, so the Algorithm line can say where its value came from
	let tokenAlgorithm = $state<string | null>(null);
	// The Algorithm line turns into the menu once Change is pressed
	let changingAlgorithm = $state(false);
	let algorithmBox = $state<HTMLElement>();
	let copyStatus = $state('');
	let hydrated = $state(false);
	// An unknown header alg (e.g. ES256K) gets its own option so the select never shows a blank
	const algorithms = $derived(
		algorithmOptions(selectedAlgorithm).map((alg) => ({ value: alg, label: alg }))
	);
	const claims = $derived(claimLines(describeClaims(decodedPayload, now)));
	// What ENCODE would change: JSON.parse rounds big integers and drops duplicate keys
	const encodeWarnings = $derived([
		...jsonWarnings(headerJson).map((w) => `Header: ${w}`),
		...jsonWarnings(payloadJson).map((w) => `Payload: ${w}`)
	]);

	const NOT_A_JWT = 'Not a JWT. A JWT has three parts separated by dots.';

	function decodeToken(t: string) {
		const view = tokenView(t);
		const bad = !!(view.headerError || view.payloadError);
		tokenError = bad ? NOT_A_JWT : '';
		decodedHeaderJson = bad || !t.trim() ? '' : view.headerJson;
		decodedPayloadJson = bad ? '' : view.payloadJson;
		// Only a good token replaces the Encode editors, so a bad paste keeps the last good JSON
		if (!bad && t.trim()) {
			headerJson = view.headerJson;
			payloadJson = view.payloadJson;
			headerError = '';
			payloadError = '';
		}
		signatureError = bad ? '' : view.signatureError;
		decodeWarnings = view.warnings;
		decodedPayload = view.payload;
		unsignedBanner = view.unsigned;
		copyStatus = '';
		tokenAlgorithm = view.alg;
		if (view.alg) selectedAlgorithm = view.alg;
	}

	// The header JSON and the select name the same alg: each edit updates the other
	function selectAlgorithm(alg: string) {
		selectedAlgorithm = alg;
		headerJson = withHeaderAlg(headerJson, alg);
	}

	async function changeAlgorithm() {
		changingAlgorithm = true;
		await tick();
		algorithmBox?.querySelector('select')?.focus();
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

	<div class="top">
		<div class="area-token">
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
					{#if tokenError}<Alert tone="danger">{tokenError}</Alert>{/if}
					{#if signatureError}<Alert tone="danger">{signatureError}</Alert>{/if}
					{#if unsignedBanner}<Alert tone="danger">{unsignedBanner}</Alert>{/if}
					{#if decodeWarnings.length}
						<Alert tone="warning">
							{#each decodeWarnings as warning, i (i)}<div>{warning}</div>{/each}
						</Alert>
					{/if}
					{#if copyStatus}<p class="hint" role="status">{copyStatus}</p>{/if}
				</div>
			</Panel>
		</div>

		<Fold boxed label="Verify signature" summary="with a secret or key" class="area-verify">
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

			{#if changingAlgorithm}
				<div class="algorithm" bind:this={algorithmBox}>
					<Select
						label="Algorithm"
						options={algorithms}
						bind:value={() => selectedAlgorithm, selectAlgorithm}
					/>
				</div>
			{:else}
				<p class="hint" data-testid="algorithm-text">
					Algorithm: {selectedAlgorithm}{selectedAlgorithm === tokenAlgorithm
						? ', from the token header'
						: ''} ·
					<Button variant="link" onclick={changeAlgorithm}>Change</Button>
				</p>
			{/if}

			{#if verification?.status === 'valid'}
				<Alert tone="success"><span data-testid="signature-status">Signature verified</span></Alert>
			{:else if verification?.status === 'invalid'}
				<Alert tone="danger"
					><span data-testid="signature-status"
						>{verification.message === SIGNATURE_MISMATCH
							? `Signature does not match this ${isSymmetric(selectedAlgorithm) ? 'secret' : 'key'}`
							: verification.message}</span
					></Alert
				>
			{:else if verification}
				<Alert tone="warning">{verification.message}</Alert>
			{/if}
		</Fold>

		<div class="stack area-decoded">
			<Panel title="Header">
				{#snippet actions()}
					<Button
						size="sm"
						variant="ghost"
						aria-label="Copy header JSON"
						disabled={!decodedHeaderJson}
						onclick={() => copy('Header', decodedHeaderJson)}>Copy</Button
					>
				{/snippet}
				<div data-testid="decoded-header">
					{#if decodedHeaderJson}
						<pre>{decodedHeaderJson}</pre>
					{:else}
						<p class="hint">No token to decode</p>
					{/if}
				</div>
			</Panel>

			<Panel title="Payload">
				{#snippet actions()}
					<Button
						size="sm"
						variant="ghost"
						aria-label="Copy payload JSON"
						disabled={!decodedPayloadJson}
						onclick={() => copy('Payload', decodedPayloadJson)}>Copy</Button
					>
				{/snippet}
				<div class="stack" data-testid="decoded-payload">
					{#if decodedPayloadJson}
						<pre>{decodedPayloadJson}</pre>
					{:else}
						<p class="hint">No token to decode</p>
					{/if}
					{#if claims.length}
						<div class="claims">
							{#each claims as claim, i (i)}
								<p class="claim {claim.tone}">
									{#if claim.tone !== 'muted'}<span class="claim-icon" aria-hidden="true"
											>{claim.tone === 'danger' ? '✕' : '!'}</span
										>{/if}{claim.text}
								</p>
							{/each}
						</div>
					{/if}
				</div>
			</Panel>
		</div>
	</div>

	<Fold boxed label="Edit and re-sign this token" class="encode">
		<p class="hint">Signs with the secret or key under Verify signature.</p>
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
	</Fold>
</div>

<style>
	/* Token and Verify on the left, Header and Payload on the right; on a phone the decoded
	   result comes right under the token and Verify follows it. */
	.top {
		display: grid;
		gap: var(--sp-3);
		grid-template-areas: 'token' 'decoded' 'verify';
		align-items: start;
	}

	@media (min-width: 720px) {
		.top {
			grid-template-columns: 1fr 1fr;
			grid-template-rows: auto 1fr;
			grid-template-areas: 'token decoded' 'verify decoded';
		}
	}

	.area-token {
		grid-area: token;
		min-width: 0;
	}

	.top :global(.area-verify) {
		grid-area: verify;
	}

	.area-decoded {
		grid-area: decoded;
		min-width: 0;
	}

	.secret-row {
		flex-wrap: nowrap;
	}

	.secret-row .control {
		flex: 1;
		min-width: 0;
	}

	.algorithm {
		max-width: 12rem;
	}

	.token,
	pre {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		word-break: break-all;
	}

	pre {
		margin: 0;
		white-space: pre-wrap;
	}

	.claims {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
	}

	.claim {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.claim.danger {
		color: var(--danger-text);
	}

	.claim.warning {
		color: var(--warning-text);
	}

	.claim-icon {
		display: inline-block;
		min-width: 1ch;
		margin-right: var(--sp-2);
		font-weight: 700;
	}

	:global(.ui-fold.encode) {
		margin-top: var(--sp-3);
	}
</style>
