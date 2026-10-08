import { beforeAll, describe, expect, it } from 'vitest';
import {
	base64ToBytes,
	bytesToBase64,
	decrypt,
	encrypt,
	generateRsaKeyPair,
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
	const algorithms: Algorithm[] = ['AES-GCM', 'RSA-OAEP', 'Base64', 'Hex', 'ROT13'];
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

describe('bytesToBase64', () => {
	it('matches btoa and survives buffers larger than the argument limit', () => {
		const bytes = Uint8Array.from({ length: 300_000 }, (_, i) => (i * 31) % 256);
		const encoded = bytesToBase64(bytes);
		expect(base64ToBytes(encoded)).toEqual(bytes);
		expect(bytesToBase64(new Uint8Array([104, 105]))).toBe(btoa('hi'));
	});
});
