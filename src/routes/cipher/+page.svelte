<script lang="ts">
	import { copyToClipboard } from '$lib/clipboard';
	import {
		ALGORITHMS,
		decrypt as decryptWith,
		encrypt as encryptWith,
		exportPrivateKeyPem,
		exportPublicKeyPem,
		generateRsaKeyPair,
		importPrivateKeyPem,
		importPublicKeyPem,
		keyKind,
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

	const kind = $derived(keyKind(selectedAlgorithm));

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
			encryptionError = e instanceof Error ? e.message : 'Encryption failed';
		}
	}

	async function decryptText() {
		decryptionError = '';
		decryptedText = '';

		try {
			decryptedText = await decrypt(inputText, selectedAlgorithm, decryptionKey);
		} catch (e) {
			decryptionError = e instanceof Error ? e.message : 'Decryption failed';
		}
	}

	async function generateRsaKeys() {
		rsaKeyError = '';
		try {
			const pair = await generateRsaKeyPair();
			publicKeyPem = await exportPublicKeyPem(pair.publicKey);
			privateKeyPem = await exportPrivateKeyPem(pair.privateKey);
		} catch (e) {
			rsaKeyError = e instanceof Error ? e.message : 'Key generation failed';
		}
	}

	function generateExampleKeys() {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let key = '';
		for (let i = 0; i < 16; i++) {
			key += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		encryptionKey = key;
		decryptionKey = key;
	}
</script>

<svelte:head>
	<title>Encrypter/Decrypter</title>
</svelte:head>

<div class="container">
	<header>
		<h1>ENCRYPTER/DECRYPTER</h1>
		<p class="subtitle">Encrypt & Decrypt Messages</p>
	</header>

	<div class="algorithm-row">
		<div class="algorithm-section">
			<div class="section-header">
				<span class="label">ALGORITHM</span>
			</div>
			<select class="algorithm-select" bind:value={selectedAlgorithm}>
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
				<button class="copy-btn" onclick={() => copyToClipboard(decryptedText)}>COPY</button>
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
			</div>
			<div class="panel-content">
				<textarea
					class="panel-textarea"
					bind:value={inputText}
					placeholder="Enter your message here"
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
				<button class="copy-btn" onclick={() => copyToClipboard(encryptedText)}>COPY</button>
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

	.key-note {
		margin: 0 0 1rem;
		font-size: 0.85rem;
		color: var(--futuristic-text-dim);
	}
</style>
