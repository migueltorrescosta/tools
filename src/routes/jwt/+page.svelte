<script lang="ts">
	import { onMount } from 'svelte';

	let token = $state('');
	let secret = $state('');
	let selectedAlgorithm = $state('HS256');
	let headerJson = $state('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
	let payloadJson = $state(
		'{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}'
	);
	let headerError = $state('');
	let payloadError = $state('');
	let signatureValid = $state<boolean | null>(null);
	let signatureResult = $state('');

	const algorithms = [
		'HS256',
		'HS384',
		'HS512',
		'RS256',
		'RS384',
		'RS512',
		'ES256',
		'ES384',
		'ES512',
		'PS256',
		'PS384',
		'PS512',
		'none'
	];

	function base64UrlEncode(str: string): string {
		return btoa(unescape(encodeURIComponent(str)))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=/g, '');
	}

	function base64UrlDecode(str: string): string {
		str = str.replace(/-/g, '+').replace(/_/g, '/');
		while (str.length % 4) str += '=';
		return decodeURIComponent(escape(atob(str)));
	}

	function decodeToken(t: string) {
		if (!t.trim()) {
			headerJson = '{\n  "alg": "",\n  "typ": "JWT"\n}';
			payloadJson = '';
			headerError = '';
			payloadError = '';
			signatureValid = null;
			signatureResult = '';
			return;
		}

		const parts = t.split('.');
		if (parts.length !== 3) {
			headerError = 'Invalid JWT format';
			payloadError = '';
			return;
		}

		try {
			const header = JSON.parse(base64UrlDecode(parts[0]));
			headerJson = JSON.stringify(header, null, 2);
			headerError = '';
			selectedAlgorithm = header.alg || 'HS256';
		} catch {
			headerError = 'Invalid header JSON';
			headerJson = '';
		}

		try {
			const payload = JSON.parse(base64UrlDecode(parts[1]));
			payloadJson = JSON.stringify(payload, null, 2);
			payloadError = '';
		} catch {
			payloadError = 'Invalid payload JSON';
			payloadJson = '';
		}

		signatureResult = parts[2];
		signatureValid = null;
	}

	function encodeToken() {
		let header: Record<string, unknown>;
		let payload: Record<string, unknown>;

		try {
			header = JSON.parse(headerJson);
		} catch {
			headerError = 'Invalid header JSON';
			return;
		}
		headerError = '';

		try {
			payload = JSON.parse(payloadJson);
		} catch {
			payloadError = 'Invalid payload JSON';
			return;
		}
		payloadError = '';

		header.alg = selectedAlgorithm;
		header.typ = 'JWT';

		const encodedHeader = base64UrlEncode(JSON.stringify(header));
		const encodedPayload = base64UrlEncode(JSON.stringify(payload));
		token = `${encodedHeader}.${encodedPayload}.`;
	}

	function verifySignature() {
		if (!token || !token.includes('.')) return;
		signatureResult = 'Verification requires crypto library';
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
	}

	$effect(() => {
		decodeToken(token);
	});

	onMount(() => {
		token =
			'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
	});
</script>

<svelte:head>
	<title>JWT Tool</title>
</svelte:head>

<div class="container">
	<header>
		<h1>JWT TOOL</h1>
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
						<label class="input-label">SECRET</label>
						<input type="text" class="secret-input" bind:value={secret} placeholder="secret" />
					</div>

					<div class="algorithm-section">
						<label class="input-label">ALGORITHM</label>
						<select class="algorithm-select" bind:value={selectedAlgorithm}>
							{#each algorithms as alg}
								<option value={alg}>{alg}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="signature-display">
					<label class="input-label">SIGNATURE</label>
					<div class="signature-value">{signatureResult || 'Not available'}</div>
				</div>

				{#if signatureValid === true}
					<div class="signature-status valid">Signature Verified</div>
				{:else if signatureValid === false}
					<div class="signature-status invalid">Signature Invalid</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="encode-section">
		<div class="section-header">
			<span class="label">DECODE & ENCODE</span>
			<span class="hint">Modify header and payload, then encode</span>
		</div>

		<div class="encode-inputs">
			<div class="encode-input-group">
				<label class="input-label">HEADER (JSON)</label>
				<textarea
					class="encode-textarea"
					bind:value={headerJson}
					placeholder={'{"alg": "HS256", "typ": "JWT"}'}
					spellcheck="false"
				></textarea>
				{#if headerError}<div class="error-small">{headerError}</div>{/if}
			</div>

			<div class="encode-input-group">
				<label class="input-label">PAYLOAD (JSON)</label>
				<textarea
					class="encode-textarea"
					bind:value={payloadJson}
					placeholder={'{"sub": "1234567890", "name": "John Doe"}'}
					spellcheck="false"
				></textarea>
				{#if payloadError}<div class="error-small">{payloadError}</div>{/if}
			</div>
		</div>

		<button class="encode-btn" onclick={encodeToken}>
			<span class="btn-text">ENCODE TOKEN</span>
			<span class="btn-glow"></span>
		</button>
	</div>
</div>

<style>
	.container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 1.5rem;
	}

	header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	h1 {
		font-family: 'Orbitron', sans-serif;
		font-size: 2rem;
		font-weight: 800;
		background: linear-gradient(135deg, var(--futuristic-cyan), var(--futuristic-magenta));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin: 0;
		letter-spacing: 0.15em;
		text-shadow: 0 0 40px rgba(0, 245, 255, 0.5);
	}

	.subtitle {
		font-family: 'Rajdhani', sans-serif;
		font-size: 0.9rem;
		color: var(--futuristic-text-dim);
		margin-top: 0.25rem;
		letter-spacing: 0.1em;
	}

	.token-input-section {
		margin-bottom: 1rem;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.label {
		font-family: 'Orbitron', sans-serif;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--futuristic-cyan);
		letter-spacing: 0.15em;
	}

	.hint {
		font-size: 0.85rem;
		color: var(--futuristic-text-dim);
	}

	.token-input {
		width: 100%;
		height: 60px;
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 8px;
		padding: 0.75rem;
		font-family: 'Rajdhani', monospace;
		font-size: 0.9rem;
		color: var(--futuristic-text);
		resize: none;
		outline: none;
		transition:
			border-color 0.3s,
			box-shadow 0.3s;
	}

	.token-input:focus {
		border-color: var(--futuristic-cyan);
		box-shadow: 0 0 20px rgba(0, 245, 255, 0.2);
	}

	.token-input::placeholder {
		color: var(--futuristic-text-dim);
	}

	.panels {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.panel {
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 12px;
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: rgba(0, 0, 0, 0.3);
		border-bottom: 1px solid var(--futuristic-border);
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.dot.red {
		background: #ff5f57;
	}
	.dot.yellow {
		background: #febc2e;
	}
	.dot.green {
		background: #28c840;
	}

	.panel-title {
		font-family: 'Orbitron', sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--futuristic-text-dim);
		letter-spacing: 0.1em;
		margin-left: 0.5rem;
	}

	.copy-btn {
		margin-left: auto;
		background: transparent;
		border: 1px solid var(--futuristic-border);
		color: var(--futuristic-text-dim);
		font-family: 'Rajdhani', sans-serif;
		font-size: 0.7rem;
		font-weight: 600;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
		letter-spacing: 0.05em;
	}

	.copy-btn:hover {
		border-color: var(--futuristic-cyan);
		color: var(--futuristic-cyan);
	}

	.panel-content {
		padding: 0.75rem;
		min-height: 120px;
	}

	.json-display {
		font-family: 'Rajdhani', monospace;
		font-size: 0.95rem;
		color: var(--futuristic-text);
		margin: 0;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.error {
		color: #ff4444;
		font-size: 0.9rem;
		padding: 1rem;
		text-align: center;
	}

	.error-small {
		color: #ff4444;
		font-size: 0.8rem;
		margin-top: 0.25rem;
	}

	.signature-row {
		display: flex;
		gap: 0.75rem;
	}

	.secret-section,
	.algorithm-section,
	.signature-display {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.input-label {
		font-family: 'Orbitron', sans-serif;
		font-size: 0.65rem;
		font-weight: 600;
		color: var(--futuristic-text-dim);
		letter-spacing: 0.1em;
	}

	.secret-input,
	.algorithm-select {
		background: var(--futuristic-bg);
		border: 1px solid var(--futuristic-border);
		border-radius: 6px;
		padding: 0.5rem;
		font-family: 'Rajdhani', monospace;
		font-size: 0.85rem;
		color: var(--futuristic-text);
		outline: none;
		transition:
			border-color 0.3s,
			box-shadow 0.3s;
	}

	.secret-input:focus,
	.algorithm-select:focus {
		border-color: var(--futuristic-cyan);
		box-shadow: 0 0 15px rgba(0, 245, 255, 0.2);
	}

	.algorithm-select {
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7c93' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.75rem center;
		padding-right: 2rem;
	}

	.algorithm-select option {
		background: var(--futuristic-surface);
		color: var(--futuristic-text);
	}

	.signature-value {
		font-family: 'Rajdhani', monospace;
		font-size: 0.75rem;
		color: var(--futuristic-text);
		background: var(--futuristic-bg);
		border: 1px solid var(--futuristic-border);
		border-radius: 6px;
		padding: 0.5rem;
		word-break: break-all;
		font-size: 0.7rem;
		line-height: 1.3;
	}

	.signature-status {
		text-align: center;
		padding: 0.5rem;
		border-radius: 6px;
		font-family: 'Orbitron', sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
	}

	.signature-status.valid {
		background: rgba(40, 200, 64, 0.1);
		border: 1px solid rgba(40, 200, 64, 0.3);
		color: #28c840;
	}

	.signature-status.invalid {
		background: rgba(255, 68, 68, 0.1);
		border: 1px solid rgba(255, 68, 68, 0.3);
		color: #ff4444;
	}

	.encode-section {
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 12px;
		padding: 1rem;
	}

	.encode-inputs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.encode-input-group {
		display: flex;
		flex-direction: column;
	}

	.encode-textarea {
		flex: 1;
		min-height: 120px;
		background: var(--futuristic-bg);
		border: 1px solid var(--futuristic-border);
		border-radius: 8px;
		padding: 0.75rem;
		font-family: 'Rajdhani', monospace;
		font-size: 0.9rem;
		color: var(--futuristic-text);
		resize: none;
		outline: none;
		transition:
			border-color 0.3s,
			box-shadow 0.3s;
	}

	.encode-textarea:focus {
		border-color: var(--futuristic-cyan);
		box-shadow: 0 0 20px rgba(0, 245, 255, 0.2);
	}

	.encode-btn {
		position: relative;
		display: block;
		width: 100%;
		padding: 1rem 2rem;
		background: linear-gradient(135deg, rgba(0, 245, 255, 0.1), rgba(255, 0, 255, 0.1));
		border: 1px solid var(--futuristic-cyan);
		border-radius: 8px;
		color: var(--futuristic-cyan);
		font-family: 'Orbitron', sans-serif;
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: 0.15em;
		cursor: pointer;
		overflow: hidden;
		transition: all 0.3s;
	}

	.encode-btn:hover {
		background: linear-gradient(135deg, rgba(0, 245, 255, 0.2), rgba(255, 0, 255, 0.2));
		box-shadow: 0 0 30px rgba(0, 245, 255, 0.4);
		transform: translateY(-2px);
	}

	.btn-glow {
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
		transition: left 0.5s;
	}

	.encode-btn:hover .btn-glow {
		left: 100%;
	}

	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		h1 {
			font-size: 2rem;
		}

		.panels {
			grid-template-columns: 1fr;
		}

		.signature-panel {
			grid-column: span 1;
		}

		.signature-content {
			grid-template-columns: 1fr;
		}

		.signature-status {
			grid-column: span 1;
		}

		.encode-inputs {
			grid-template-columns: 1fr;
		}
	}
</style>
