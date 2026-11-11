<script lang="ts">
	import { onMount } from 'svelte';
	import { copyToClipboard } from '#lib/clipboard.js';
	import {
		Alert,
		Button,
		Field,
		Fold,
		PageHeader,
		Panel,
		SegmentedControl,
		Select
	} from '#lib/ui/index.js';
	import {
		ALGORITHMS,
		decrypt as decryptWith,
		encrypt as encryptWith,
		errorMessage,
		exportPrivateKeyPem,
		exportPublicKeyPem,
		generateRsaKeyPair,
		importPrivateKeyPem,
		importPublicKeyPem,
		keyKind,
		randomKey,
		type Algorithm,
		type CipherKeys
	} from '#lib/cipher.js';

	type Mode = 'encrypt' | 'decrypt';
	const MODES = [
		{ value: 'encrypt', label: 'Encrypt' },
		{ value: 'decrypt', label: 'Decrypt' }
	] as const;

	let mode = $state<Mode>('encrypt');
	let selectedAlgorithm = $state<Algorithm>('AES-GCM');
	let password = $state('');
	let publicKeyPem = $state('');
	let privateKeyPem = $state('');
	let message = $state('');

	/** The last result, or the error that replaced it. Hidden while both are empty. */
	let result = $state('');
	let resultError = $state('');
	/** Errors about one field, shown under it. */
	let keyError = $state('');
	let messageError = $state('');
	let rsaKeyError = $state('');

	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	type CopyStatus = 'idle' | 'copied' | 'failed';
	const COPY_LABEL: Record<CopyStatus, string> = {
		idle: 'Copy',
		copied: 'Copied',
		failed: 'Copy failed'
	};
	const COPY_FEEDBACK_MS = 1500;
	let copyStatus = $state<CopyStatus>('idle');
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	const kind = $derived(keyKind(selectedAlgorithm));
	const verb = $derived(mode === 'encrypt' ? 'Encrypt' : 'Decrypt');
	const algorithms = ALGORITHMS.map((alg) => ({ value: alg, label: alg }));

	/** The keys this mode needs, or a field error saying what is missing. */
	async function readKeys(): Promise<CipherKeys | undefined> {
		if (kind === 'passphrase') {
			if (password) return { passphrase: password };
			keyError =
				mode === 'encrypt' ? 'Enter a password' : 'Enter the password it was encrypted with';
			return undefined;
		}
		if (kind === 'none') return {};
		const pem = mode === 'encrypt' ? publicKeyPem : privateKeyPem;
		if (!pem.trim()) {
			keyError =
				mode === 'encrypt'
					? 'Enter a public key, or generate a key pair'
					: 'Enter the private key of the pair';
			return undefined;
		}
		try {
			return mode === 'encrypt'
				? { publicKey: await importPublicKeyPem(pem) }
				: { privateKey: await importPrivateKeyPem(pem) };
		} catch (e) {
			keyError = errorMessage(e, 'This key could not be read');
			return undefined;
		}
	}

	async function run() {
		clearOutputs();
		if (!message) {
			messageError = mode === 'encrypt' ? 'Enter a message' : 'Enter the encrypted message';
		}
		const keys = await readKeys();
		if (!keys || messageError) return;
		try {
			result =
				mode === 'encrypt'
					? await encryptWith(message, selectedAlgorithm, keys)
					: await decryptWith(message, selectedAlgorithm, keys);
		} catch (e) {
			resultError = errorMessage(e, mode === 'encrypt' ? 'Encryption failed' : 'Decryption failed');
		}
	}

	async function generateRsaKeys() {
		rsaKeyError = '';
		keyError = '';
		try {
			const pair = await generateRsaKeyPair();
			publicKeyPem = await exportPublicKeyPem(pair.publicKey);
			privateKeyPem = await exportPrivateKeyPem(pair.privateKey);
		} catch (e) {
			rsaKeyError = errorMessage(e, 'Key generation failed');
		}
	}

	function generatePassword() {
		password = randomKey();
		keyError = '';
	}

	/** A result belongs to the mode and algorithm that produced it, so switching either clears it. */
	function clearOutputs() {
		result = '';
		resultError = '';
		keyError = '';
		messageError = '';
	}

	async function copyResult() {
		clearTimeout(copyTimer);
		try {
			await copyToClipboard(result);
			copyStatus = 'copied';
		} catch {
			copyStatus = 'failed';
		}
		copyTimer = setTimeout(() => (copyStatus = 'idle'), COPY_FEEDBACK_MS);
	}
</script>

<div class="container" data-hydrated={hydrated || undefined}>
	<PageHeader path="/cipher" />

	<Panel>
		<form
			class="stack"
			novalidate
			onsubmit={(e) => {
				e.preventDefault();
				run();
			}}
		>
			<SegmentedControl
				legend="Mode"
				hideLegend
				options={MODES}
				bind:value={
					() => mode,
					(next) => {
						mode = next;
						clearOutputs();
					}
				}
			/>

			{#if kind === 'passphrase'}
				<Field label="Password" error={keyError}>
					{#snippet children(props)}
						<div class="with-button">
							<input
								class="control"
								type="text"
								{...props}
								bind:value={password}
								oninput={() => (keyError = '')}
								placeholder="Enter a password"
								autocomplete="off"
								spellcheck="false"
							/>
							<Button onclick={generatePassword}>Generate</Button>
						</div>
					{/snippet}
				</Field>
			{:else if kind === 'keypair'}
				{#if mode === 'encrypt'}
					<Field
						label="Public key"
						error={keyError}
						hint="Keep the private key of the pair (under Decrypt): without it the message is lost."
					>
						{#snippet children(props)}
							<textarea
								class="control pem"
								{...props}
								bind:value={publicKeyPem}
								oninput={() => (keyError = '')}
								placeholder="-----BEGIN PUBLIC KEY-----"
								spellcheck="false"
							></textarea>
						{/snippet}
					</Field>
				{:else}
					<Field label="Private key" error={keyError}>
						{#snippet children(props)}
							<textarea
								class="control pem"
								{...props}
								bind:value={privateKeyPem}
								oninput={() => (keyError = '')}
								placeholder="-----BEGIN PRIVATE KEY-----"
								spellcheck="false"
							></textarea>
						{/snippet}
					</Field>
				{/if}
				<div class="cluster">
					<Button size="sm" onclick={generateRsaKeys}>Generate key pair</Button>
				</div>
				{#if rsaKeyError}
					<Alert tone="danger">{rsaKeyError}</Alert>
				{/if}
			{:else}
				<p class="hint">{selectedAlgorithm} is an encoding, not encryption: it needs no key.</p>
			{/if}

			<Field label="Message" error={messageError}>
				{#snippet children(props)}
					<textarea
						class="control text"
						{...props}
						bind:value={message}
						oninput={() => (messageError = '')}
						placeholder={mode === 'encrypt'
							? 'The message to encrypt'
							: 'The encrypted message to decrypt'}
						spellcheck="false"
					></textarea>
				{/snippet}
			</Field>

			<div class="cluster">
				<Button type="submit" variant="primary">{verb}</Button>
			</div>

			<Fold label="Advanced" summary="algorithm {selectedAlgorithm}" class="advanced">
				<div class="algorithm">
					<Select
						label="Algorithm"
						options={algorithms}
						bind:value={selectedAlgorithm}
						onchange={clearOutputs}
					/>
				</div>
			</Fold>
		</form>

		{#if result || resultError}
			<section class="part" data-testid="result-panel" aria-labelledby="result-heading">
				<div class="part-head">
					<h2 id="result-heading" class="part-heading">Result</h2>
					{#if result}
						<Button
							size="sm"
							variant={copyStatus === 'failed' ? 'danger' : 'ghost'}
							onclick={copyResult}>{COPY_LABEL[copyStatus]}</Button
						>
					{/if}
				</div>
				{#if resultError}
					<Alert tone="danger"><span data-testid="result-error">{resultError}</span></Alert>
				{:else}
					<output class="out" aria-live="polite" aria-label="Result">{result}</output>
				{/if}
			</section>
		{/if}

		<details class="how last">
			<summary>How it works</summary>
			<p>
				Everything runs in your browser; nothing you type is sent anywhere. AES-GCM (the default)
				and AES-CBC turn the password into a 256-bit key with PBKDF2-SHA-256 over a random salt
				(600,000 rounds), then encrypt with a random IV. The result is <code>v1:</code> followed by the
				salt, IV and ciphertext in Base64, so the same password decrypts it anywhere.
			</p>
			<p>
				RSA-OAEP uses a key pair: the public key encrypts and only the matching private key
				decrypts. Generate key pair makes a 2048-bit pair (SHA-256), which encrypts at most 190
				bytes of UTF-8 text.
			</p>
			<p>
				Base64, Hex and ROT13 are encodings, not encryption: anyone can reverse them without a key.
			</p>
		</details>
	</Panel>
</div>

<style>
	/* The Result and How it works parts of the one box, each under a hairline. */
	.part,
	.how.last {
		margin-top: var(--sp-3);
		padding-top: var(--sp-3);
		border-top: 1px solid var(--border);
	}

	.part {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}

	.part-head {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-2);
	}

	.part-head > :global(:last-child:not(:first-child)) {
		margin-left: auto;
	}

	/* Same as a Panel title: body size over a short accent rule. */
	.part-heading {
		font-size: var(--text-lg);
		font-weight: 600;
	}

	.part-heading::after {
		content: '';
		display: block;
		width: 24px;
		height: 2px;
		margin-top: 6px;
		background: var(--accent);
	}

	.how.last > :global(:last-child) {
		margin-bottom: 0;
	}

	.with-button {
		display: flex;
		gap: var(--sp-2);
	}

	.with-button input {
		flex: 1;
		min-width: 0;
	}

	.algorithm {
		max-width: 16rem;
	}

	.pem {
		height: 9rem;
		font-size: var(--text-xs);
		white-space: pre;
	}

	.text {
		min-height: 6rem;
	}

	.out {
		display: block;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		white-space: pre-wrap;
		word-break: break-all;
	}
</style>
