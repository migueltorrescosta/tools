import { expect, test, type Page } from '@playwright/test';

const MESSAGE = 'Hello World! Grüße, 世界 🔐';

function panel(page: Page, name: 'encrypted' | 'decrypted') {
	return page.getByTestId(`${name}-panel`);
}

function ui(page: Page) {
	const encrypted = panel(page, 'encrypted');
	const decrypted = panel(page, 'decrypted');
	return {
		algorithm: page.getByLabel('Algorithm'),
		encryptionKey: page.getByLabel('Encryption key'),
		decryptionKey: page.getByLabel('Decryption key'),
		publicKey: page.getByLabel('Public key (PEM, encrypts)'),
		privateKey: page.getByLabel('Private key (PEM, decrypts)'),
		input: page.getByLabel('Text', { exact: true }),
		encrypted: encrypted.getByRole('status', { name: 'Encrypted' }),
		encryptedError: encrypted.getByRole('alert').getByTestId('encrypted-error'),
		decrypted: decrypted.getByRole('status', { name: 'Decrypted' }),
		decryptedError: decrypted.getByRole('alert').getByTestId('decrypted-error'),
		encrypt: page.getByRole('button', { name: 'Encrypt', exact: true }),
		decrypt: page.getByRole('button', { name: 'Decrypt', exact: true }),
		useAsInput: page.getByRole('button', { name: 'Use as input', exact: true }),
		copyEncrypted: encrypted.getByRole('button', { name: /^Cop(y|ied)/ }),
		copyDecrypted: decrypted.getByRole('button', { name: /^Cop(y|ied)/ })
	};
}

/** Load the tool and wait until it has hydrated, so clicks are not lost. */
async function open(page: Page) {
	await page.goto('/cipher');
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Encrypter/Decrypter');
}

/** Replace navigator.clipboard.writeText with a stub that records or rejects, then reload so it applies. */
async function stubClipboard(page: Page, outcome: 'resolve' | 'reject') {
	await page.addInitScript((mode) => {
		const w = window as unknown as { copied: string[] };
		w.copied = [];
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: async (text: string) => {
					if (mode === 'reject') throw new DOMException('Denied', 'NotAllowedError');
					w.copied.push(text);
				}
			}
		});
	}, outcome);
	await open(page);
}

/** Encrypt the input, move the ciphertext into the input with Use as input, decrypt, and return the ciphertext. */
async function roundTrip(page: Page, text: string): Promise<string> {
	const u = ui(page);
	await u.input.fill(text);
	await u.encrypt.click();
	await expect(u.encryptedError).toHaveCount(0);
	await expect(u.encrypted).not.toHaveText('');
	const ciphertext = (await u.encrypted.textContent()) ?? '';
	expect(ciphertext).not.toBe(text);
	await u.useAsInput.click();
	await expect(u.input).toHaveValue(ciphertext);
	await u.decrypt.click();
	await expect(u.decryptedError).toHaveCount(0);
	await expect(u.decrypted).toHaveText(text);
	return ciphertext;
}

test.beforeEach(async ({ page }) => {
	await open(page);
});

for (const algorithm of ['AES-GCM', 'AES-CBC']) {
	test(`${algorithm} encrypts and decrypts back to the original text`, async ({ page }) => {
		const u = ui(page);
		await u.algorithm.selectOption(algorithm);
		await u.encryptionKey.fill('mysecretkey123');
		await u.decryptionKey.fill('mysecretkey123');
		const ciphertext = await roundTrip(page, MESSAGE);
		expect(ciphertext).toMatch(/^v1:[A-Za-z0-9+/]+=*$/);
	});

	test(`${algorithm} shows a visible error for a wrong decryption key`, async ({ page }) => {
		const u = ui(page);
		await u.algorithm.selectOption(algorithm);
		await u.encryptionKey.fill('right key');
		await u.decryptionKey.fill('wrong key');
		await u.input.fill(MESSAGE);
		await u.encrypt.click();
		await expect(u.encrypted).not.toHaveText('');
		await u.input.fill((await u.encrypted.textContent()) ?? '');
		await u.decrypt.click();
		await expect(u.decryptedError).toHaveText('Wrong key or corrupted ciphertext');
	});
}

test('generated random keys fill both fields and round-trip', async ({ page }) => {
	const u = ui(page);
	await page.getByRole('button', { name: 'Generate random keys' }).click();
	await expect(u.encryptionKey).toHaveValue(/^[A-Za-z0-9]{22}$/);
	await expect(u.decryptionKey).toHaveValue(await u.encryptionKey.inputValue());
	await roundTrip(page, MESSAGE);
});

for (const [algorithm, expected] of [
	['Base64', 'aGk='],
	['Hex', '6869'],
	['ROT13', 'uv']
] as const) {
	test(`${algorithm} needs no key and round-trips`, async ({ page }) => {
		const u = ui(page);
		await u.algorithm.selectOption(algorithm);
		await expect(u.encryptionKey).toHaveCount(0);
		await expect(u.decryptionKey).toHaveCount(0);
		await u.input.fill('hi');
		await u.encrypt.click();
		await expect(u.encrypted).toHaveText(expected);
		await roundTrip(page, MESSAGE);
	});
}

test('RSA-OAEP encrypts with a generated public key and decrypts with its private key', async ({
	page
}) => {
	const u = ui(page);
	await u.algorithm.selectOption('RSA-OAEP');
	await page.getByRole('button', { name: 'Generate key pair' }).click();
	await expect(u.publicKey).toHaveValue(/-----BEGIN PUBLIC KEY-----/);
	await expect(u.privateKey).toHaveValue(/-----BEGIN PRIVATE KEY-----/);
	await roundTrip(page, MESSAGE);
});

test('RSA-OAEP reports the byte limit for an oversized input', async ({ page }) => {
	const u = ui(page);
	await u.algorithm.selectOption('RSA-OAEP');
	await page.getByRole('button', { name: 'Generate key pair' }).click();
	await expect(u.publicKey).toHaveValue(/-----BEGIN PUBLIC KEY-----/);
	await u.input.fill('a'.repeat(191));
	await u.encrypt.click();
	await expect(u.encryptedError).toContainText('limit is 190 bytes');
});

test('switching algorithm clears outputs and errors', async ({ page }) => {
	const u = ui(page);
	await u.algorithm.selectOption('Base64');
	await u.input.fill('hi');
	await u.encrypt.click();
	await expect(u.encrypted).toHaveText('aGk=');
	await u.decrypt.click();
	await expect(u.decryptedError).toHaveText('Base64 bytes are not valid UTF-8 text');

	await u.algorithm.selectOption('Hex');
	await expect(u.encrypted).toHaveText('');
	await expect(u.decryptedError).toHaveCount(0);
	await expect(u.decrypted).toHaveText('');
});

test('Base64 decode reports non-UTF-8 bytes and accepts URL-safe input', async ({ page }) => {
	const u = ui(page);
	await u.algorithm.selectOption('Base64');
	await u.input.fill('/w==');
	await u.decrypt.click();
	await expect(u.decryptedError).toHaveText('Base64 bytes are not valid UTF-8 text');
	await u.input.fill('SGVsbG8_');
	await u.decrypt.click();
	await expect(u.decrypted).toHaveText('Hello?');
});

test('Copy and Use as input are disabled while there is nothing to copy', async ({ page }) => {
	const u = ui(page);
	await expect(u.copyEncrypted).toBeDisabled();
	await expect(u.copyDecrypted).toBeDisabled();
	await expect(u.useAsInput).toBeDisabled();
	await u.encrypt.click();
	await expect(u.encryptedError).toHaveText('Input text is required');
	await expect(u.copyEncrypted).toBeDisabled();
	await expect(u.useAsInput).toBeDisabled();
});

test('Copy confirms success and copies the output', async ({ page }) => {
	await stubClipboard(page, 'resolve');
	const u = ui(page);
	await u.algorithm.selectOption('Hex');
	await u.input.fill('hi');
	await u.encrypt.click();
	await expect(u.copyEncrypted).toBeEnabled();
	await u.copyEncrypted.click();
	await expect(u.copyEncrypted).toHaveText('Copied');
	expect(await page.evaluate(() => (window as unknown as { copied: string[] }).copied)).toEqual([
		'6869'
	]);
	await expect(u.copyEncrypted).toHaveText('Copy');
});

test('Copy reports a rejected clipboard write', async ({ page }) => {
	await stubClipboard(page, 'reject');
	const u = ui(page);
	await u.algorithm.selectOption('ROT13');
	await u.input.fill('hi');
	await u.encrypt.click();
	await u.copyEncrypted.click();
	await expect(u.copyEncrypted).toHaveText('Copy failed');
});
