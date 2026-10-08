<script lang="ts">
	import { copyToClipboard } from '$lib/clipboard';
	import {
		ALGORITHMS,
		decrypt as decryptWith,
		encrypt as encryptWith,
		generateRsaKeyPair,
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
	let cachedKeyPair = $state<CryptoKeyPair | null>(null);

	const algorithms = ALGORITHMS;

	async function encrypt(text: string, algorithm: Algorithm, key: string): Promise<string> {
		if (!text) {
			throw new Error('Input text is required');
		}

		if (!key && algorithm !== 'ROT13') {
			throw new Error('Encryption key is required');
		}

		if (algorithm === 'RSA-OAEP') {
			cachedKeyPair = await generateRsaKeyPair();
			return encryptWith(text, algorithm, { publicKey: cachedKeyPair.publicKey });
		}
		return encryptWith(text, algorithm, { passphrase: key });
	}

	async function decrypt(text: string, algorithm: Algorithm, key: string): Promise<string> {
		if (!text) {
			throw new Error('Encrypted text is required');
		}

		if (!key && algorithm !== 'ROT13') {
			throw new Error('Decryption key is required');
		}

		if (algorithm === 'RSA-OAEP') {
			if (!cachedKeyPair) {
				throw new Error('No RSA key pair found. Please encrypt a message first using RSA-OAEP.');
			}
			return decryptWith(text, algorithm, { privateKey: cachedKeyPair.privateKey });
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
