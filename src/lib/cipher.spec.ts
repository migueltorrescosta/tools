import { beforeAll, describe, expect, it } from 'vitest';
import {
	base64ToBytes,
	bytesToBase64,
	decrypt,
	encrypt,
	exportPrivateKeyPem,
	exportPublicKeyPem,
	generateRsaKeyPair,
	importPrivateKeyPem,
	importPublicKeyPem,
	type Algorithm
} from './cipher';

const UNICODE = 'Grüße, 世界 🔐';

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
		const bytes = base64ToBytes(await encrypt('secret message', 'AES-GCM', keys));
		bytes[bytes.length - 1] ^= 1;
		await expect(decrypt(bytesToBase64(bytes), 'AES-GCM', keys)).rejects.toThrow();
	});

	it('rejects ciphertext no longer than the IV with a clear error', async () => {
		const short = bytesToBase64(new Uint8Array(12));
		await expect(decrypt(short, 'AES-GCM', keys)).rejects.toThrow(/too short/);
	});

	it('requires a passphrase', async () => {
		await expect(encrypt('x', 'AES-GCM', {})).rejects.toThrow(/Key is required/);
	});
});

describe('AES-CBC', () => {
	const keys = { passphrase: 'secret' };

	it('prefixes a 16-byte IV and round-trips', async () => {
		const ciphertext = await encrypt('a', 'AES-CBC', keys);
		// 16-byte IV + one padded 16-byte block.
		expect(base64ToBytes(ciphertext)).toHaveLength(32);
		expect(await decrypt(ciphertext, 'AES-CBC', keys)).toBe('a');
	});

	it('round-trips 1 MB', async () => {
		const text = 'y'.repeat(1 << 20);
		expect(await decrypt(await encrypt(text, 'AES-CBC', keys), 'AES-CBC', keys)).toBe(text);
	});

	it('rejects ciphertext no longer than the IV with a clear error', async () => {
		const short = bytesToBase64(new Uint8Array(16));
		await expect(decrypt(short, 'AES-CBC', keys)).rejects.toThrow(/too short/);
	});

	it('never returns the plaintext for a wrong key', async () => {
		const ciphertext = await encrypt('secret message', 'AES-CBC', keys);
		const result = await decrypt(ciphertext, 'AES-CBC', { passphrase: 'wrong' }).catch(() => null);
		expect(result).not.toBe('secret message');
	});
});

describe('RSA-OAEP', () => {
	it('encrypts up to 190 bytes and rejects 191', async () => {
		const keys = keysFor('RSA-OAEP');
		const max = 'a'.repeat(190);
		expect(await decrypt(await encrypt(max, 'RSA-OAEP', keys), 'RSA-OAEP', keys)).toBe(max);
		await expect(encrypt('a'.repeat(191), 'RSA-OAEP', keys)).rejects.toThrow();
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
