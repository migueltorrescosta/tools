/**
 * Encrypt/decrypt for the cipher tool. Pure: all key material is passed in, so
 * the page owns key state and specs can reach every algorithm.
 */
import { base64Decode, base64Encode, fromHex, rot13, toHex } from './crypto';

export const ALGORITHMS = ['AES-GCM', 'AES-CBC', 'RSA-OAEP', 'Base64', 'Hex', 'ROT13'] as const;

export type Algorithm = (typeof ALGORITHMS)[number];
export type AesAlgorithm = 'AES-GCM' | 'AES-CBC';

export interface CipherKeys {
	/** Passphrase for AES-GCM and AES-CBC. */
	passphrase?: string;
	/** RSA-OAEP public key (encrypt). */
	publicKey?: CryptoKey;
	/** RSA-OAEP private key (decrypt). */
	privateKey?: CryptoKey;
}

const IV_LENGTH = 12;

const BASE64_CHUNK = 0x8000;

/** Base64 of raw bytes, chunked so large buffers do not overflow the call stack. */
export function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK));
	}
	return btoa(binary);
}

export function base64ToBytes(text: string): Uint8Array<ArrayBuffer> {
	return Uint8Array.from(atob(text.trim()), (c) => c.charCodeAt(0));
}

/** AES key from a passphrase (SHA-256 of its UTF-8 bytes). */
export async function deriveKey(algorithm: AesAlgorithm, passphrase: string): Promise<CryptoKey> {
	if (!passphrase) throw new Error(`Key is required for ${algorithm}`);
	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(passphrase));
	return crypto.subtle.importKey('raw', hash, { name: algorithm }, false, ['encrypt', 'decrypt']);
}

/** Fresh RSA-OAEP 2048-bit key pair (SHA-256). */
export function generateRsaKeyPair(): Promise<CryptoKeyPair> {
	return crypto.subtle.generateKey(
		{
			name: 'RSA-OAEP',
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: 'SHA-256'
		},
		true,
		['encrypt', 'decrypt']
	);
}

function requireKey<T>(key: T | undefined, message: string): T {
	if (!key) throw new Error(message);
	return key;
}

export async function encrypt(
	text: string,
	algorithm: Algorithm,
	keys: CipherKeys
): Promise<string> {
	switch (algorithm) {
		case 'Base64':
			return base64Encode(text);
		case 'Hex':
			return toHex(text);
		case 'ROT13':
			return rot13(text);
		case 'AES-GCM':
		case 'AES-CBC': {
			const key = await deriveKey(algorithm, keys.passphrase ?? '');
			const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
			const encrypted = await crypto.subtle.encrypt(
				{ name: algorithm, iv },
				key,
				new TextEncoder().encode(text)
			);
			const combined = new Uint8Array(iv.length + encrypted.byteLength);
			combined.set(iv);
			combined.set(new Uint8Array(encrypted), iv.length);
			return bytesToBase64(combined);
		}
		case 'RSA-OAEP': {
			const publicKey = requireKey(keys.publicKey, 'RSA-OAEP needs a public key');
			const encrypted = await crypto.subtle.encrypt(
				{ name: 'RSA-OAEP' },
				publicKey,
				new TextEncoder().encode(text)
			);
			return bytesToBase64(new Uint8Array(encrypted));
		}
		default:
			throw new Error('Unsupported algorithm');
	}
}

export async function decrypt(
	text: string,
	algorithm: Algorithm,
	keys: CipherKeys
): Promise<string> {
	switch (algorithm) {
		case 'Base64':
			return base64Decode(text);
		case 'Hex':
			return fromHex(text);
		case 'ROT13':
			return rot13(text);
		case 'AES-GCM':
		case 'AES-CBC': {
			const key = await deriveKey(algorithm, keys.passphrase ?? '');
			const combined = base64ToBytes(text);
			if (combined.length <= IV_LENGTH) throw new Error('Ciphertext is too short');
			const decrypted = await crypto.subtle.decrypt(
				{ name: algorithm, iv: combined.slice(0, IV_LENGTH) },
				key,
				combined.slice(IV_LENGTH)
			);
			return new TextDecoder().decode(decrypted);
		}
		case 'RSA-OAEP': {
			const privateKey = requireKey(keys.privateKey, 'RSA-OAEP needs a private key');
			const decrypted = await crypto.subtle.decrypt(
				{ name: 'RSA-OAEP' },
				privateKey,
				base64ToBytes(text)
			);
			return new TextDecoder().decode(decrypted);
		}
		default:
			throw new Error('Unsupported algorithm');
	}
}
