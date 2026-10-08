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

/** PBKDF2-SHA256 work factor (OWASP 2023 minimum). */
export const PBKDF2_ITERATIONS = 600_000;
export const SALT_LENGTH = 16;
/**
 * AES ciphertext format tag. v1 output is `v1:` + base64(salt || iv || ciphertext), with the key
 * derived from the passphrase by PBKDF2-SHA256 over the salt. `:` is outside the base64
 * alphabet, so untagged ciphertexts from the earlier unsalted format are told apart.
 */
export const AES_FORMAT = 'v1';

/** AES-256 key from a passphrase and salt via PBKDF2-SHA256. */
export async function deriveKey(
	algorithm: AesAlgorithm,
	passphrase: string,
	salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
	if (!passphrase) throw new Error(`Key is required for ${algorithm}`);
	const material = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(passphrase),
		'PBKDF2',
		false,
		['deriveKey']
	);
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
		material,
		{ name: algorithm, length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

/** Bytes after the format tag, or a clear error for untagged or unknown-version input. */
function parseAesCiphertext(text: string): Uint8Array<ArrayBuffer> {
	const trimmed = text.trim();
	const match = /^(v\d+):(.*)$/s.exec(trimmed);
	if (!match) {
		throw new Error(
			`Unrecognised ciphertext: expected the "${AES_FORMAT}:" prefix. Ciphertexts from the old unsalted format can no longer be decrypted.`
		);
	}
	if (match[1] !== AES_FORMAT) {
		throw new Error(`Unsupported ciphertext version "${match[1]}"; this tool reads ${AES_FORMAT}`);
	}
	return base64ToBytes(match[2]);
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
			const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
			const key = await deriveKey(algorithm, keys.passphrase ?? '', salt);
			const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH[algorithm]));
			const encrypted = await crypto.subtle.encrypt(
				{ name: algorithm, iv },
				key,
				new TextEncoder().encode(text)
			);
			const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
			combined.set(salt);
			combined.set(iv, salt.length);
			combined.set(new Uint8Array(encrypted), salt.length + iv.length);
			return `${AES_FORMAT}:${bytesToBase64(combined)}`;
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
			if (!keys.passphrase) throw new Error(`Key is required for ${algorithm}`);
			const combined = parseAesCiphertext(text);
			const header = SALT_LENGTH + IV_LENGTH[algorithm];
			if (combined.length <= header) throw new Error('Ciphertext is too short');
			const key = await deriveKey(algorithm, keys.passphrase, combined.slice(0, SALT_LENGTH));
			const decrypted = await crypto.subtle.decrypt(
				{ name: algorithm, iv: combined.slice(SALT_LENGTH, header) },
				key,
				combined.slice(header)
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
