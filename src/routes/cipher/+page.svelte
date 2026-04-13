<script lang="ts">
	let selectedAlgorithm = $state('AES-GCM');
	let encryptionKey = $state('');
	let decryptionKey = $state('');
	let inputText = $state('');
	let encryptedText = $state('');
	let decryptedText = $state('');
	let encryptionError = $state('');
	let decryptionError = $state('');
	let keyMismatchWarning = $state('');
	let cachedKeyPair = $state<CryptoKeyPair | null>(null);

	const algorithms = ['AES-GCM', 'AES-CBC', 'RSA-OAEP', 'Base64', 'Hex', 'ROT13'];

	async function generateKey(
		algorithm: string,
		keyString: string
	): Promise<CryptoKey | CryptoKeyPair | string> {
		if (algorithm === 'Base64' || algorithm === 'Hex' || algorithm === 'ROT13') {
			return keyString;
		}

		if (!keyString) {
			throw new Error('Key is required for ' + algorithm);
		}

		const encoder = new TextEncoder();
		const keyData = encoder.encode(keyString);

		if (algorithm.startsWith('AES-')) {
			const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
			return crypto.subtle.importKey('raw', hashBuffer, { name: algorithm }, false, [
				'encrypt',
				'decrypt'
			]);
		}

		if (algorithm === 'RSA-OAEP') {
			const keyPair = await crypto.subtle.generateKey(
				{
					name: 'RSA-OAEP',
					modulusLength: 2048,
					publicExponent: new Uint8Array([1, 0, 1]),
					hash: 'SHA-256'
				},
				true,
				['encrypt', 'decrypt']
			);
			return keyPair;
		}

		throw new Error('Unsupported algorithm');
	}

	function base64Encode(str: string): string {
		return btoa(unescape(encodeURIComponent(str)));
	}

	function base64Decode(str: string): string {
		return decodeURIComponent(escape(atob(str)));
	}

	function toHex(str: string): string {
		return Array.from(new TextEncoder().encode(str))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	}

	function fromHex(hex: string): string {
		const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []);
		return new TextDecoder().decode(bytes);
	}

	function rot13(str: string): string {
		return str.replace(/[a-zA-Z]/g, (char) => {
			const base = char <= 'Z' ? 65 : 97;
			return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base);
		});
	}

	async function encrypt(text: string, algorithm: string, key: string): Promise<string> {
		if (!text) {
			throw new Error('Input text is required');
		}

		if (!key && algorithm !== 'ROT13') {
			throw new Error('Encryption key is required');
		}

		switch (algorithm) {
			case 'Base64':
				return base64Encode(text);
			case 'Hex':
				return toHex(text);
			case 'ROT13':
				return rot13(text);
			case 'AES-GCM':
			case 'AES-CBC': {
				const cryptoKey = await generateKey(algorithm, key);
				const iv = crypto.getRandomValues(new Uint8Array(12));
				const encoder = new TextEncoder();
				const encrypted = await crypto.subtle.encrypt(
					{ name: algorithm, iv },
					cryptoKey as CryptoKey,
					encoder.encode(text)
				);
				const combined = new Uint8Array(iv.length + encrypted.byteLength);
				combined.set(iv);
				combined.set(new Uint8Array(encrypted), iv.length);
				return btoa(String.fromCharCode(...combined));
			}
			case 'RSA-OAEP': {
				const keyPair = (await generateKey(algorithm, key)) as unknown as CryptoKeyPair;
				cachedKeyPair = keyPair;
				const encoder = new TextEncoder();
				const encrypted = await crypto.subtle.encrypt(
					{ name: 'RSA-OAEP' },
					keyPair.publicKey,
					encoder.encode(text)
				);
				return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
			}
			default:
				throw new Error('Unsupported algorithm');
		}
	}

	async function decrypt(text: string, algorithm: string, key: string): Promise<string> {
		if (!text) {
			throw new Error('Encrypted text is required');
		}

		if (!key && algorithm !== 'ROT13') {
			throw new Error('Decryption key is required');
		}

		switch (algorithm) {
			case 'Base64':
				return base64Decode(text);
			case 'Hex':
				return fromHex(text);
			case 'ROT13':
				return rot13(text);
			case 'AES-GCM':
			case 'AES-CBC': {
				const cryptoKey = await generateKey(algorithm, key);
				const combined = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
				const iv = combined.slice(0, 12);
				const encrypted = combined.slice(12);
				const decrypted = await crypto.subtle.decrypt(
					{ name: algorithm, iv },
					cryptoKey as CryptoKey,
					encrypted
				);
				return new TextDecoder().decode(decrypted);
			}
			case 'RSA-OAEP': {
				if (!cachedKeyPair) {
					throw new Error('No RSA key pair found. Please encrypt a message first using RSA-OAEP.');
				}
				const encrypted = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
				const decrypted = await crypto.subtle.decrypt(
					{ name: 'RSA-OAEP' },
					cachedKeyPair.privateKey,
					encrypted
				);
				return new TextDecoder().decode(decrypted);
			}
			default:
				throw new Error('Unsupported algorithm');
		}
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

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
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

	{#if keyMismatchWarning}
		<div class="key-warning">{keyMismatchWarning}</div>
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
