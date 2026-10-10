<script lang="ts">
	import { onMount } from 'svelte';
	import { copyToClipboard } from '$lib/clipboard';
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
		idle: 'COPY',
		copied: 'COPIED',
		failed: 'COPY FAILED'
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

	const algorithms = ALGORITHMS;

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

<svelte:head>
	<title>Encrypter/Decrypter</title>
</svelte:head>

<div class="container" data-hydrated={hydrated || undefined}>
	<header>
		<h1>ENCRYPTER/DECRYPTER</h1>
		<p class="subtitle">Encrypt & Decrypt Messages</p>
	</header>

	<div class="algorithm-row">
		<div class="algorithm-section">
			<div class="section-header">
				<span class="label">ALGORITHM</span>
			</div>
			<select class="algorithm-select" bind:value={selectedAlgorithm} onchange={clearOutputs}>
				{#each algorithms as alg (alg)}
					<option value={alg}>{alg}</option>
				{/each}
			</select>
		</div>
	</div>

	{#if kind === 'keypair'}
		<div class="generate-keys-container">
			<button class="generate-keys-btn" onclick={generateRsaKeys}>
				<span class="btn-text">GENERATE KEY PAIR</span>
				<span class="btn-glow"></span>
			</button>
		</div>

		<p class="key-note">
			Encrypt uses the public key; decrypt needs the matching private key. Save the private key:
			without it the ciphertext cannot be recovered. A 2048-bit key encrypts at most 190 bytes of
			UTF-8 text.
		</p>
		{#if rsaKeyError}
			<div class="error">{rsaKeyError}</div>
		{/if}

		<div class="key-row">
			<div class="key-input-group">
				<label class="input-label" for="public-key">PUBLIC KEY (PEM, ENCRYPTS)</label>
				<textarea
					id="public-key"
					class="key-input pem-input"
					bind:value={publicKeyPem}
					placeholder="-----BEGIN PUBLIC KEY-----"
					spellcheck="false"
				></textarea>
			</div>
			<div class="key-input-group">
				<label class="input-label" for="private-key">PRIVATE KEY (PEM, DECRYPTS)</label>
				<textarea
					id="private-key"
					class="key-input pem-input"
					bind:value={privateKeyPem}
					placeholder="-----BEGIN PRIVATE KEY-----"
					spellcheck="false"
				></textarea>
			</div>
		</div>
	{:else if kind === 'passphrase'}
		<div class="generate-keys-container">
			<button class="generate-keys-btn" onclick={generateExampleKeys}>
				<span class="btn-text">GENERATE RANDOM KEYS</span>
				<span class="btn-glow"></span>
			</button>
		</div>

		<div class="key-row">
			<div class="key-input-group">
				<label class="input-label" for="encryption-key">ENCRYPTION KEY</label>
				<input
					id="encryption-key"
					type="text"
					class="key-input"
					bind:value={encryptionKey}
					placeholder="Enter encryption key"
				/>
			</div>
			<div class="key-input-group">
				<label class="input-label" for="decryption-key">DECRYPTION KEY</label>
				<input
					id="decryption-key"
					type="text"
					class="key-input"
					bind:value={decryptionKey}
					placeholder="Enter decryption key"
				/>
			</div>
		</div>
	{:else}
		<p class="key-note">{selectedAlgorithm} is an encoding, not encryption: it needs no key.</p>
	{/if}

	<div class="process-btn-container">
		<div class="btn-row">
			<button class="process-btn" onclick={encryptText}>
				<span class="btn-text">ENCRYPT</span>
				<span class="btn-glow"></span>
			</button>
			<button class="process-btn" onclick={decryptText}>
				<span class="btn-text">DECRYPT</span>
				<span class="btn-glow"></span>
			</button>
		</div>
	</div>

	<div class="panels">
		<div class="panel">
			<div class="panel-header">
				<span class="dot red"></span>
				<span class="dot yellow"></span>
				<span class="dot green"></span>
				<span class="panel-title">DECRYPTED</span>
				<button
					class="copy-btn"
					class:copy-failed={copyStatus.decrypted === 'failed'}
					disabled={!canCopyDecrypted}
					onclick={() => copyOutput('decrypted', decryptedText)}
					>{COPY_LABEL[copyStatus.decrypted]}</button
				>
			</div>
			<div class="panel-content">
				{#if decryptionError}
					<div class="error">{decryptionError}</div>
				{:else}
					<textarea
						class="panel-textarea"
						bind:value={decryptedText}
						placeholder="Decrypted message will appear here"
						spellcheck="false"
					></textarea>
				{/if}
			</div>
		</div>

		<div class="panel input-panel">
			<div class="panel-header">
				<span class="dot red"></span>
				<span class="dot yellow"></span>
				<span class="dot green"></span>
				<span class="panel-title">INPUT</span>
				<span class="panel-hint">ENCRYPT and DECRYPT both read this</span>
			</div>
			<div class="panel-content">
				<textarea
					class="panel-textarea"
					bind:value={inputText}
					placeholder="Plaintext to encrypt, or ciphertext to decrypt"
					spellcheck="false"
				></textarea>
			</div>
		</div>

		<div class="panel">
			<div class="panel-header">
				<span class="dot red"></span>
				<span class="dot yellow"></span>
				<span class="dot green"></span>
				<span class="panel-title">ENCRYPTED</span>
				<span class="panel-actions">
					<button
						class="copy-btn"
						disabled={!canCopyEncrypted}
						title="Copy the ciphertext into INPUT so DECRYPT can read it"
						onclick={useEncryptedAsInput}>USE AS INPUT</button
					>
					<button
						class="copy-btn"
						class:copy-failed={copyStatus.encrypted === 'failed'}
						disabled={!canCopyEncrypted}
						onclick={() => copyOutput('encrypted', encryptedText)}
						>{COPY_LABEL[copyStatus.encrypted]}</button
					>
				</span>
			</div>
			<div class="panel-content">
				{#if encryptionError}
					<div class="error">{encryptionError}</div>
				{:else}
					<textarea
						class="panel-textarea"
						bind:value={encryptedText}
						placeholder="Encrypted message will appear here"
						spellcheck="false"
					></textarea>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.pem-input {
		height: 160px;
		resize: vertical;
		font-size: 0.75rem;
		white-space: pre;
	}

	.panel-actions {
		margin-left: auto;
		display: flex;
		gap: 0.5rem;
	}

	.panel-actions .copy-btn {
		margin-left: 0;
	}

	.panel-hint {
		margin-left: auto;
		font-size: 0.7rem;
		color: var(--futuristic-text-dim);
	}

	.copy-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		pointer-events: none;
	}

	.copy-btn.copy-failed {
		border-color: #ff7777;
		color: #ff7777;
	}

	.key-note {
		margin: 0 0 1rem;
		font-size: 0.85rem;
		color: var(--futuristic-text-dim);
	}
</style>
