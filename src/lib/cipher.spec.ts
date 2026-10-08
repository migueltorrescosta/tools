import { beforeAll, describe, expect, it } from 'vitest';
import {
	base64ToBytes,
	bytesToBase64,
	decrypt,
	encrypt,
	errorMessage,
	exportPrivateKeyPem,
	exportPublicKeyPem,
	generateRsaKeyPair,
	importPrivateKeyPem,
	importPublicKeyPem,
	keyKind,
	PBKDF2_ITERATIONS,
	SALT_LENGTH,
	rsaOaepMaxBytes,
	WRONG_KEY_MESSAGE,
	type Algorithm
} from './cipher';

const UNICODE = 'Grüße, 世界 🔐';

/** Raw bytes of a v1 AES ciphertext. */
const payload = (ciphertext: string) => base64ToBytes(ciphertext.replace(/^v1:/, ''));

let rsa: CryptoKeyPair;
beforeAll(async () => {
	rsa = await generateRsaKeyPair();
});

const keysFor = (algorithm: Algorithm) =>
	algorithm === 'RSA-OAEP'
		? { publicKey: rsa.publicKey, privateKey: rsa.privateKey }
		: { passphrase: 'correct horse battery staple' };

describe('round-trips', () => {
	const algorithms: Algorithm[] = ['AES-GCM', 'AES-CBC', 'RSA-OAEP', 'Base64', 'Hex', 'ROT13'];
	for (const algorithm of algorithms) {
		it(`${algorithm} round-trips ASCII and unicode`, async () => {
			for (const text of ['hello world', UNICODE]) {
				const ciphertext = await encrypt(text, algorithm, keysFor(algorithm));
				if (algorithm !== 'ROT13') expect(ciphertext).not.toBe(text);
				expect(await decrypt(ciphertext, algorithm, keysFor(algorithm))).toBe(text);
			}
		});
	}

	it('AES-GCM round-trips 1 MB', async () => {
		const text = 'x'.repeat(1 << 20);
		const keys = { passphrase: 'k' };
		expect(await decrypt(await encrypt(text, 'AES-GCM', keys), 'AES-GCM', keys)).toBe(text);
	});
});

describe('AES-GCM', () => {
	const keys = { passphrase: 'secret' };

	it('uses a fresh random IV per encryption', async () => {
		const a = await encrypt('same', 'AES-GCM', keys);
		const b = await encrypt('same', 'AES-GCM', keys);
		expect(a).not.toBe(b);
	});

	it('rejects a wrong key', async () => {
		const ciphertext = await encrypt('secret message', 'AES-GCM', keys);
		await expect(decrypt(ciphertext, 'AES-GCM', { passphrase: 'wrong' })).rejects.toThrow();
	});

	it('rejects tampered ciphertext', async () => {
		const bytes = payload(await encrypt('secret message', 'AES-GCM', keys));
		bytes[bytes.length - 1] ^= 1;
		await expect(decrypt(`v1:${bytesToBase64(bytes)}`, 'AES-GCM', keys)).rejects.toThrow();
	});

	it('rejects ciphertext no longer than salt and IV with a clear error', async () => {
		const short = `v1:${bytesToBase64(new Uint8Array(SALT_LENGTH + 12))}`;
		await expect(decrypt(short, 'AES-GCM', keys)).rejects.toThrow(/too short/);
	});

	it('requires a passphrase', async () => {
		await expect(encrypt('x', 'AES-GCM', {})).rejects.toThrow(/Key is required/);
	});
});

describe('AES passphrase KDF and v1 format', () => {
	const keys = { passphrase: 'correct horse battery staple' };

	for (const algorithm of ['AES-GCM', 'AES-CBC'] as const) {
		it(`${algorithm} salts each encryption so equal inputs give unrelated ciphertexts that both decrypt`, async () => {
			const a = await encrypt('same plaintext', algorithm, keys);
			const b = await encrypt('same plaintext', algorithm, keys);
			expect(a).toMatch(/^v1:[A-Za-z0-9+/]+=*$/);
			expect(a).not.toBe(b);
			// Fresh salt, not just a fresh IV.
			expect(payload(a).slice(0, SALT_LENGTH)).not.toEqual(payload(b).slice(0, SALT_LENGTH));
			expect(await decrypt(a, algorithm, keys)).toBe('same plaintext');
			expect(await decrypt(b, algorithm, keys)).toBe('same plaintext');
		});
	}

	it('derives the key with PBKDF2-SHA256 over the stored salt, not a bare SHA-256', async () => {
		expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
		const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const material = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(keys.passphrase),
			'PBKDF2',
			false,
			['deriveKey']
		);
		const key = await crypto.subtle.deriveKey(
			{ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
			material,
			{ name: 'AES-GCM', length: 256 },
			false,
			['encrypt']
		);
		const ct = new Uint8Array(
			await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode('ok'))
		);
		const bytes = new Uint8Array([...salt, ...iv, ...ct]);
		expect(await decrypt(`v1:${bytesToBase64(bytes)}`, 'AES-GCM', keys)).toBe('ok');
	});

	it('rejects an untagged ciphertext from the old unsalted format with a clear message', async () => {
		// Old format: base64(iv || ct) under key = SHA-256(passphrase).
		const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(keys.passphrase));
		const key = await crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt']);
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const ct = new Uint8Array(
			await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode('old'))
		);
		const legacy = bytesToBase64(new Uint8Array([...iv, ...ct]));
		await expect(decrypt(legacy, 'AES-GCM', keys)).rejects.toThrow(/old unsalted format/);
	});

	it('rejects an unknown format version', async () => {
		await expect(decrypt('v2:AAAA', 'AES-CBC', keys)).rejects.toThrow(
			/Unsupported ciphertext version "v2"/
		);
	});

	it('requires a passphrase to decrypt', async () => {
		const ciphertext = await encrypt('x', 'AES-GCM', keys);
		await expect(decrypt(ciphertext, 'AES-GCM', {})).rejects.toThrow(/Key is required/);
	});
});

describe('AES-CBC', () => {
	const keys = { passphrase: 'secret' };

	it('prefixes a 16-byte IV and round-trips', async () => {
		const ciphertext = await encrypt('a', 'AES-CBC', keys);
		// 16-byte salt + 16-byte IV + one padded 16-byte block.
		expect(payload(ciphertext)).toHaveLength(48);
		expect(await decrypt(ciphertext, 'AES-CBC', keys)).toBe('a');
	});

	it('round-trips 1 MB', async () => {
		const text = 'y'.repeat(1 << 20);
		expect(await decrypt(await encrypt(text, 'AES-CBC', keys), 'AES-CBC', keys)).toBe(text);
	});

	it('rejects ciphertext no longer than salt and IV with a clear error', async () => {
		const short = `v1:${bytesToBase64(new Uint8Array(SALT_LENGTH + 16))}`;
		await expect(decrypt(short, 'AES-CBC', keys)).rejects.toThrow(/too short/);
	});

	it('never returns the plaintext for a wrong key', async () => {
		const ciphertext = await encrypt('secret message', 'AES-CBC', keys);
		const result = await decrypt(ciphertext, 'AES-CBC', { passphrase: 'wrong' }).catch(() => null);
		expect(result).not.toBe('secret message');
	});
});

describe('RSA-OAEP', () => {
	it('encrypts up to 190 bytes and rejects 191 with the limit in the message', async () => {
		const keys = keysFor('RSA-OAEP');
		expect(rsaOaepMaxBytes(rsa.publicKey)).toBe(190);
		const max = 'a'.repeat(190);
		expect(await decrypt(await encrypt(max, 'RSA-OAEP', keys), 'RSA-OAEP', keys)).toBe(max);
		await expect(encrypt('a'.repeat(191), 'RSA-OAEP', keys)).rejects.toThrow(
			'RSA-OAEP-2048 limit is 190 bytes; this input is 191 bytes (UTF-8)'
		);
	});

	it('counts UTF-8 bytes, not characters, against the limit', async () => {
		const keys = keysFor('RSA-OAEP');
		// 63 CJK characters are 189 bytes; 64 are 192.
		const ok = '世'.repeat(63);
		expect(await decrypt(await encrypt(ok, 'RSA-OAEP', keys), 'RSA-OAEP', keys)).toBe(ok);
		await expect(encrypt('世'.repeat(64), 'RSA-OAEP', keys)).rejects.toThrow(/190 bytes/);
	});

	it('rejects a different key pair', async () => {
		const other = await generateRsaKeyPair();
		const ciphertext = await encrypt('hi', 'RSA-OAEP', { publicKey: rsa.publicKey });
		await expect(
			decrypt(ciphertext, 'RSA-OAEP', { privateKey: other.privateKey })
		).rejects.toThrow();
	});

	it('requires the matching key half', async () => {
		await expect(encrypt('x', 'RSA-OAEP', {})).rejects.toThrow(/public key/);
		await expect(decrypt('AAAA', 'RSA-OAEP', {})).rejects.toThrow(/private key/);
	});
});

describe('RSA-OAEP PEM keys', () => {
	it('decrypts with a re-imported private key after the original pair is gone', async () => {
		const pair = await generateRsaKeyPair();
		const publicPem = await exportPublicKeyPem(pair.publicKey);
		const privatePem = await exportPrivateKeyPem(pair.privateKey);
		expect(publicPem).toMatch(
			/^-----BEGIN PUBLIC KEY-----\n[A-Za-z0-9+/=\n]+-----END PUBLIC KEY-----\n$/
		);
		expect(privatePem).toMatch(/^-----BEGIN PRIVATE KEY-----\n/);

		// Only the PEM text survives a reload; everything below starts from it.
		const ciphertext = await encrypt('survives reload', 'RSA-OAEP', {
			publicKey: await importPublicKeyPem(publicPem)
		});
		// A later key pair must not affect earlier ciphertexts.
		await generateRsaKeyPair();
		const privateKey = await importPrivateKeyPem(privatePem);
		expect(await decrypt(ciphertext, 'RSA-OAEP', { privateKey })).toBe('survives reload');
	});

	it('accepts PEM with CRLF line breaks and surrounding whitespace', async () => {
		const publicPem = await exportPublicKeyPem(rsa.publicKey);
		const pasted = `\n  ${publicPem.replace(/\n/g, '\r\n')}  `;
		const ciphertext = await encrypt('hi', 'RSA-OAEP', {
			publicKey: await importPublicKeyPem(pasted)
		});
		expect(await decrypt(ciphertext, 'RSA-OAEP', { privateKey: rsa.privateKey })).toBe('hi');
	});

	it('rejects the wrong PEM block or a corrupted body with a clear error', async () => {
		const publicPem = await exportPublicKeyPem(rsa.publicKey);
		await expect(importPrivateKeyPem(publicPem)).rejects.toThrow(/BEGIN PRIVATE KEY/);
		await expect(importPublicKeyPem('hello')).rejects.toThrow(/BEGIN PUBLIC KEY/);
		const truncated = publicPem.replace(/\n[^\n]+\n-----END/, '\n-----END');
		await expect(importPublicKeyPem(truncated)).rejects.toThrow(/public key/);
	});
});

describe('bytesToBase64', () => {
	it('matches btoa and survives buffers larger than the argument limit', () => {
		const bytes = Uint8Array.from({ length: 300_000 }, (_, i) => (i * 31) % 256);
		const encoded = bytesToBase64(bytes);
		expect(base64ToBytes(encoded)).toEqual(bytes);
		expect(bytesToBase64(new Uint8Array([104, 105]))).toBe(btoa('hi'));
	});
});

describe('keyless encodings', () => {
	it('need no key', () => {
		expect(keyKind('Base64')).toBe('none');
		expect(keyKind('Hex')).toBe('none');
		expect(keyKind('ROT13')).toBe('none');
		expect(keyKind('AES-GCM')).toBe('passphrase');
		expect(keyKind('AES-CBC')).toBe('passphrase');
		expect(keyKind('RSA-OAEP')).toBe('keypair');
	});

	it('encrypt and decrypt with an empty key', async () => {
		expect(await encrypt('hi', 'Base64', { passphrase: '' })).toBe('aGk=');
		expect(await decrypt('aGk=', 'Base64', { passphrase: '' })).toBe('hi');
		expect(await encrypt('hi', 'Hex', {})).toBe('6869');
		expect(await encrypt('hi', 'ROT13', {})).toBe('uv');
	});
});

describe('decrypt failure messages', () => {
	it('reports a wrong AES-GCM key as wrong key, not a generic OperationError', async () => {
		const ciphertext = await encrypt('secret', 'AES-GCM', { passphrase: 'right' });
		await expect(decrypt(ciphertext, 'AES-GCM', { passphrase: 'wrong' })).rejects.toThrow(
			WRONG_KEY_MESSAGE
		);
	});

	it('reports tampered AES-GCM ciphertext the same way', async () => {
		const keys = { passphrase: 'k' };
		const bytes = payload(await encrypt('secret', 'AES-GCM', keys));
		bytes[bytes.length - 1] ^= 1;
		await expect(decrypt(`v1:${bytesToBase64(bytes)}`, 'AES-GCM', keys)).rejects.toThrow(
			WRONG_KEY_MESSAGE
		);
	});

	it('reports a wrong AES-CBC key as wrong key whenever it fails', async () => {
		const ciphertext = await encrypt('secret message', 'AES-CBC', { passphrase: 'right' });
		for (const passphrase of ['wrong', 'also wrong', 'nope']) {
			const result = await decrypt(ciphertext, 'AES-CBC', { passphrase }).catch(
				(e: Error) => e.message
			);
			expect(result).toBe(WRONG_KEY_MESSAGE);
		}
	});

	it('reports a mismatched RSA private key as wrong key', async () => {
		const other = await generateRsaKeyPair();
		const ciphertext = await encrypt('hi', 'RSA-OAEP', { publicKey: rsa.publicKey });
		await expect(decrypt(ciphertext, 'RSA-OAEP', { privateKey: other.privateKey })).rejects.toThrow(
			WRONG_KEY_MESSAGE
		);
	});

	it('errorMessage never returns an empty string for an empty-message DOMException', () => {
		expect(errorMessage(new DOMException('', 'OperationError'), 'Decryption failed')).toBe(
			'OperationError'
		);
		expect(errorMessage(new Error(''), 'Decryption failed')).toBe('Error');
		expect(errorMessage('boom', 'Decryption failed')).toBe('Decryption failed');
		expect(errorMessage(new Error('Bad key'), 'Decryption failed')).toBe('Bad key');
	});
});
