<script lang="ts">
	import { onMount } from 'svelte';
	import { copyToClipboard } from '$lib/clipboard';
	import { Alert, Button, Field, PageHeader, Panel, Select } from '$lib/ui';
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
		type Algorithm
	} from '$lib/cipher';

	let selectedAlgorithm = $state<Algorithm>('AES-GCM');
	let encryptionKey = $state('');
	let decryptionKey = $state('');
	let inputText = $state('');
	let encryptedText = $state('');
	let decryptedText = $state('');
	let encryptionError = $state('');
	let decryptionError = $state('');
	let publicKeyPem = $state('');
	let privateKeyPem = $state('');
	let rsaKeyError = $state('');

	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	type OutputPanel = 'encrypted' | 'decrypted';
	type CopyStatus = 'idle' | 'copied' | 'failed';
	const COPY_LABEL: Record<CopyStatus, string> = {
		idle: 'Copy',
		copied: 'Copied',
		failed: 'Copy failed'
	};
	const COPY_FEEDBACK_MS = 1500;
	let copyStatus = $state<Record<OutputPanel, CopyStatus>>({
		encrypted: 'idle',
		decrypted: 'idle'
	});
	const copyTimers: Partial<Record<OutputPanel, ReturnType<typeof setTimeout>>> = {};

	const kind = $derived(keyKind(selectedAlgorithm));
	const canCopyEncrypted = $derived(!encryptionError && encryptedText !== '');
	const canCopyDecrypted = $derived(!decryptionError && decryptedText !== '');

	const algorithms = ALGORITHMS.map((alg) => ({ value: alg, label: alg }));

	async function encrypt(text: string, algorithm: Algorithm, key: string): Promise<string> {
		if (!text) {
			throw new Error('Input text is required');
		}

		if (algorithm === 'RSA-OAEP') {
			if (!publicKeyPem.trim()) {
				throw new Error('A public key is required: generate a key pair or paste a PEM public key');
			}
			return encryptWith(text, algorithm, { publicKey: await importPublicKeyPem(publicKeyPem) });
		}

		if (!key && keyKind(algorithm) === 'passphrase') {
			throw new Error('Encryption key is required');
		}

		return encryptWith(text, algorithm, { passphrase: key });
	}

	async function decrypt(text: string, algorithm: Algorithm, key: string): Promise<string> {
		if (!text) {
			throw new Error('Encrypted text is required');
		}

		if (algorithm === 'RSA-OAEP') {
			if (!privateKeyPem.trim()) {
				throw new Error('A private key is required: paste the PEM private key of the pair');
			}
			return decryptWith(text, algorithm, {
				privateKey: await importPrivateKeyPem(privateKeyPem)
			});
		}

		if (!key && keyKind(algorithm) === 'passphrase') {
			throw new Error('Decryption key is required');
		}

		return decryptWith(text, algorithm, { passphrase: key });
	}

	async function encryptText() {
		encryptionError = '';
		encryptedText = '';

		try {
			encryptedText = await encrypt(inputText, selectedAlgorithm, encryptionKey);
		} catch (e) {
			encryptionError = errorMessage(e, 'Encryption failed');
		}
	}

	async function decryptText() {
		decryptionError = '';
		decryptedText = '';

		try {
			decryptedText = await decrypt(inputText, selectedAlgorithm, decryptionKey);
		} catch (e) {
			decryptionError = errorMessage(e, 'Decryption failed');
		}
	}

	async function generateRsaKeys() {
		rsaKeyError = '';
		try {
			const pair = await generateRsaKeyPair();
			publicKeyPem = await exportPublicKeyPem(pair.publicKey);
			privateKeyPem = await exportPrivateKeyPem(pair.privateKey);
		} catch (e) {
			rsaKeyError = errorMessage(e, 'Key generation failed');
		}
	}

	/** Outputs belong to the algorithm that produced them, so a switch clears them. */
	function clearOutputs() {
		encryptedText = '';
		decryptedText = '';
		encryptionError = '';
		decryptionError = '';
	}

	function useEncryptedAsInput() {
		inputText = encryptedText;
	}

	async function copyOutput(panel: OutputPanel, text: string) {
		clearTimeout(copyTimers[panel]);
		try {
			await copyToClipboard(text);
			copyStatus[panel] = 'copied';
		} catch {
			copyStatus[panel] = 'failed';
		}
		copyTimers[panel] = setTimeout(() => (copyStatus[panel] = 'idle'), COPY_FEEDBACK_MS);
	}

	function generateExampleKeys() {
		const key = randomKey();
		encryptionKey = key;
		decryptionKey = key;
	}
</script>

<div class="container" data-hydrated={hydrated || undefined}>
	<PageHeader path="/cipher" />

	<div class="split-view">
		<Panel title="Input">
			<div class="stack">
				<div class="algorithm">
					<Select
						label="Algorithm"
						options={algorithms}
						bind:value={selectedAlgorithm}
						onchange={clearOutputs}
					/>
				</div>

				{#if kind === 'keypair'}
					<div class="keys">
						<Field label="Public key (PEM, encrypts)">
							{#snippet children(props)}
								<textarea
									class="control pem"
									{...props}
									bind:value={publicKeyPem}
									placeholder="-----BEGIN PUBLIC KEY-----"
									spellcheck="false"
								></textarea>
							{/snippet}
						</Field>
						<Field label="Private key (PEM, decrypts)">
							{#snippet children(props)}
								<textarea
									class="control pem"
									{...props}
									bind:value={privateKeyPem}
									placeholder="-----BEGIN PRIVATE KEY-----"
									spellcheck="false"
								></textarea>
							{/snippet}
						</Field>
					</div>
					<p class="note">
						Encrypt uses the public key; decrypt needs the matching private key. Save the private
						key: without it the ciphertext cannot be recovered. A 2048-bit key encrypts at most 190
						bytes of UTF-8 text.
					</p>
					{#if rsaKeyError}
						<Alert tone="danger">{rsaKeyError}</Alert>
					{/if}
					<div class="cluster">
						<Button size="sm" onclick={generateRsaKeys}>Generate key pair</Button>
					</div>
				{:else if kind === 'passphrase'}
					<div class="keys">
						<Field label="Encryption key">
							{#snippet children(props)}
								<input
									class="control"
									type="text"
									{...props}
									bind:value={encryptionKey}
									placeholder="Enter encryption key"
								/>
							{/snippet}
						</Field>
						<Field label="Decryption key">
							{#snippet children(props)}
								<input
									class="control"
									type="text"
									{...props}
									bind:value={decryptionKey}
									placeholder="Enter decryption key"
								/>
							{/snippet}
						</Field>
					</div>
					<div class="cluster">
						<Button size="sm" onclick={generateExampleKeys}>Generate random keys</Button>
					</div>
				{:else}
					<p class="note">{selectedAlgorithm} is an encoding, not encryption: it needs no key.</p>
				{/if}

				<Field label="Text" hint="Encrypt and Decrypt both read this.">
					{#snippet children(props)}
						<textarea
							class="control text"
							{...props}
							bind:value={inputText}
							placeholder="Plaintext to encrypt, or ciphertext to decrypt"
							spellcheck="false"
						></textarea>
					{/snippet}
				</Field>

				<div class="cluster">
					<Button variant="primary" onclick={encryptText}>Encrypt</Button>
					<Button onclick={decryptText}>Decrypt</Button>
				</div>
			</div>
		</Panel>

		<div class="stack">
			<div data-testid="encrypted-panel">
				<Panel title="Encrypted">
					{#snippet actions()}
						<Button
							size="sm"
							variant="ghost"
							disabled={!canCopyEncrypted}
							title="Copy the ciphertext into Text so Decrypt can read it"
							onclick={useEncryptedAsInput}>Use as input</Button
						>
						<Button
							size="sm"
							variant={copyStatus.encrypted === 'failed' ? 'danger' : 'ghost'}
							disabled={!canCopyEncrypted}
							onclick={() => copyOutput('encrypted', encryptedText)}
							>{COPY_LABEL[copyStatus.encrypted]}</Button
						>
					{/snippet}
					{#if encryptionError}
						<Alert tone="danger"><span data-testid="encrypted-error">{encryptionError}</span></Alert
						>
					{/if}
					<output class="out" aria-live="polite" aria-label="Encrypted">{encryptedText}</output>
					{#if !encryptedText && !encryptionError}
						<p class="placeholder">Encrypted message will appear here</p>
					{/if}
				</Panel>
			</div>

			<div data-testid="decrypted-panel">
				<Panel title="Decrypted">
					{#snippet actions()}
						<Button
							size="sm"
							variant={copyStatus.decrypted === 'failed' ? 'danger' : 'ghost'}
							disabled={!canCopyDecrypted}
							onclick={() => copyOutput('decrypted', decryptedText)}
							>{COPY_LABEL[copyStatus.decrypted]}</Button
						>
					{/snippet}
					{#if decryptionError}
						<Alert tone="danger"><span data-testid="decrypted-error">{decryptionError}</span></Alert
						>
					{/if}
					<output class="out" aria-live="polite" aria-label="Decrypted">{decryptedText}</output>
					{#if !decryptedText && !decryptionError}
						<p class="placeholder">Decrypted message will appear here</p>
					{/if}
				</Panel>
			</div>
		</div>
	</div>
</div>

<style>
	.algorithm {
		max-width: 16rem;
	}

	.keys {
		display: grid;
		gap: var(--sp-3);
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
	}

	.pem {
		height: 9rem;
		font-size: var(--text-xs);
		white-space: pre;
	}

	.text {
		min-height: 6rem;
	}

	.note,
	.placeholder {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.out {
		display: block;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		white-space: pre-wrap;
		word-break: break-all;
	}
</style>
