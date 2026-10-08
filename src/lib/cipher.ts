/**
 * Encrypt/decrypt for the cipher tool. Pure: all key material is passed in, so
 * the page owns key state and specs can reach every algorithm.
 */
import { base64Decode, base64Encode, fromHex, rot13, toHex } from './crypto';

export const ALGORITHMS = ['AES-GCM', 'AES-CBC', 'RSA-OAEP', 'Base64', 'Hex', 'ROT13'] as const;

export type Algorithm = (typeof ALGORITHMS)[number];
export type AesAlgorithm = 'AES-GCM' | 'AES-CBC';

/** What an algorithm needs from the user: a passphrase, an RSA key pair, or nothing. */
export type KeyKind = 'passphrase' | 'keypair' | 'none';

/** Encodings that transform text without any key. */
export const KEYLESS: ReadonlySet<Algorithm> = new Set<Algorithm>(['Base64', 'Hex', 'ROT13']);

export function keyKind(algorithm: Algorithm): KeyKind {
	if (KEYLESS.has(algorithm)) return 'none';
	return algorithm === 'RSA-OAEP' ? 'keypair' : 'passphrase';
}

export interface CipherKeys {
	/** Passphrase for AES-GCM and AES-CBC. */
	passphrase?: string;
	/** RSA-OAEP public key (encrypt). */
	publicKey?: CryptoKey;
	/** RSA-OAEP private key (decrypt). */
	privateKey?: CryptoKey;
}

/** IV bytes per AES mode: GCM uses a 96-bit nonce, CBC needs one full 128-bit block. */
export const IV_LENGTH: Record<AesAlgorithm, number> = { 'AES-GCM': 12, 'AES-CBC': 16 };

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

const RSA_PARAMS: RsaHashedImportParams = { name: 'RSA-OAEP', hash: 'SHA-256' };

/** Fresh RSA-OAEP 2048-bit key pair (SHA-256), exportable so it can be saved as PEM. */
export function generateRsaKeyPair(): Promise<CryptoKeyPair> {
	return crypto.subtle.generateKey(
		{ ...RSA_PARAMS, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
		true,
		['encrypt', 'decrypt']
	);
}

type PemLabel = 'PUBLIC KEY' | 'PRIVATE KEY';

function toPem(der: ArrayBuffer, label: PemLabel): string {
	const body = bytesToBase64(new Uint8Array(der)).replace(/.{1,64}/g, '$&\n');
	return `-----BEGIN ${label}-----\n${body}-----END ${label}-----\n`;
}

function fromPem(pem: string, label: PemLabel): Uint8Array<ArrayBuffer> {
	const match = new RegExp(`-----BEGIN ${label}-----([\\s\\S]*?)-----END ${label}-----`).exec(pem);
	if (!match) throw new Error(`Expected a PEM block "-----BEGIN ${label}-----"`);
	try {
		return base64ToBytes(match[1].replace(/\s+/g, ''));
	} catch {
		throw new Error(`The ${label.toLowerCase()} PEM body is not valid base64`);
	}
}

/** SPKI PEM ("-----BEGIN PUBLIC KEY-----") of an RSA-OAEP public key. */
export async function exportPublicKeyPem(key: CryptoKey): Promise<string> {
	return toPem(await crypto.subtle.exportKey('spki', key), 'PUBLIC KEY');
}

/** PKCS#8 PEM ("-----BEGIN PRIVATE KEY-----") of an RSA-OAEP private key. */
export async function exportPrivateKeyPem(key: CryptoKey): Promise<string> {
	return toPem(await crypto.subtle.exportKey('pkcs8', key), 'PRIVATE KEY');
}

export async function importPublicKeyPem(pem: string): Promise<CryptoKey> {
	const der = fromPem(pem, 'PUBLIC KEY');
	try {
		return await crypto.subtle.importKey('spki', der, RSA_PARAMS, true, ['encrypt']);
	} catch {
		throw new Error('Not a valid RSA public key');
	}
}

export async function importPrivateKeyPem(pem: string): Promise<CryptoKey> {
	const der = fromPem(pem, 'PRIVATE KEY');
	try {
		return await crypto.subtle.importKey('pkcs8', der, RSA_PARAMS, true, ['decrypt']);
	} catch {
		throw new Error('Not a valid RSA private key');
	}
}

/** SHA-256 digest length: OAEP spends two hashes plus two bytes of each RSA block. */
const OAEP_HASH_BYTES = 32;

/** Largest plaintext, in UTF-8 bytes, RSA-OAEP (SHA-256) can encrypt with this key: 190 for 2048-bit. */
export function rsaOaepMaxBytes(key: CryptoKey): number {
	const { modulusLength } = key.algorithm as RsaHashedKeyAlgorithm;
	return modulusLength / 8 - 2 * OAEP_HASH_BYTES - 2;
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
			const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH[algorithm]));
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
			const plaintext = new TextEncoder().encode(text);
			const max = rsaOaepMaxBytes(publicKey);
			if (plaintext.length > max) {
				const bits = (publicKey.algorithm as RsaHashedKeyAlgorithm).modulusLength;
				throw new Error(
					`RSA-OAEP-${bits} limit is ${max} bytes; this input is ${plaintext.length} bytes (UTF-8)`
				);
			}
			const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, plaintext);
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
			const ivLength = IV_LENGTH[algorithm];
			const combined = base64ToBytes(text);
			if (combined.length <= ivLength) throw new Error('Ciphertext is too short');
			const decrypted = await crypto.subtle.decrypt(
				{ name: algorithm, iv: combined.slice(0, ivLength) },
				key,
				combined.slice(ivLength)
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
