import { expect, test, type Page } from '@playwright/test';

const MESSAGE = 'Hello World! Grüße, 世界 🔐';

function panel(page: Page, title: string) {
	return page.locator('.panel').filter({
		has: page.locator('.panel-title', { hasText: new RegExp(`^${title}$`) })
	});
}

function ui(page: Page) {
	return {
		algorithm: page.locator('select.algorithm-select'),
		encryptionKey: page.locator('#encryption-key'),
		decryptionKey: page.locator('#decryption-key'),
		publicKey: page.locator('#public-key'),
		privateKey: page.locator('#private-key'),
		input: panel(page, 'INPUT').locator('textarea'),
		encrypted: panel(page, 'ENCRYPTED').locator('textarea'),
		encryptedError: panel(page, 'ENCRYPTED').locator('.error'),
		decrypted: panel(page, 'DECRYPTED').locator('textarea'),
		decryptedError: panel(page, 'DECRYPTED').locator('.error'),
		encrypt: page.getByRole('button', { name: 'ENCRYPT', exact: true }),
		decrypt: page.getByRole('button', { name: 'DECRYPT', exact: true }),
		useAsInput: page.getByRole('button', { name: 'USE AS INPUT', exact: true }),
		copyEncrypted: panel(page, 'ENCRYPTED').locator('.copy-btn').last(),
		copyDecrypted: panel(page, 'DECRYPTED').locator('.copy-btn')
	};
}

/** Load the tool and wait until it has hydrated, so clicks are not lost. */
async function open(page: Page) {
	await page.goto('/cipher');
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
	await expect(page.locator('h1')).toHaveText('ENCRYPTER/DECRYPTER');
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

/** Encrypt the input, move the ciphertext into the input with USE AS INPUT, decrypt, and return the ciphertext. */
async function roundTrip(page: Page, text: string): Promise<string> {
	const u = ui(page);
	await u.input.fill(text);
	await u.encrypt.click();
	await expect(u.encryptedError).toHaveCount(0);
	await expect(u.encrypted).not.toHaveValue('');
	const ciphertext = await u.encrypted.inputValue();
	expect(ciphertext).not.toBe(text);
	await u.useAsInput.click();
	await expect(u.input).toHaveValue(ciphertext);
	await u.decrypt.click();
	await expect(u.decryptedError).toHaveCount(0);
	await expect(u.decrypted).toHaveValue(text);
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
		await expect(u.encrypted).not.toHaveValue('');
		await u.input.fill(await u.encrypted.inputValue());
		await u.decrypt.click();
		await expect(u.decryptedError).toHaveText('Wrong key or corrupted ciphertext');
	});
}

test('generated random keys fill both fields and round-trip', async ({ page }) => {
	const u = ui(page);
	await page.getByRole('button', { name: 'GENERATE RANDOM KEYS' }).click();
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
		await expect(u.encrypted).toHaveValue(expected);
		await roundTrip(page, MESSAGE);
	});
}

test('RSA-OAEP encrypts with a generated public key and decrypts with its private key', async ({
	page
}) => {
	const u = ui(page);
	await u.algorithm.selectOption('RSA-OAEP');
	await page.getByRole('button', { name: 'GENERATE KEY PAIR' }).click();
	await expect(u.publicKey).toHaveValue(/-----BEGIN PUBLIC KEY-----/);
	await expect(u.privateKey).toHaveValue(/-----BEGIN PRIVATE KEY-----/);
	await roundTrip(page, MESSAGE);
});

test('RSA-OAEP reports the byte limit for an oversized input', async ({ page }) => {
	const u = ui(page);
	await u.algorithm.selectOption('RSA-OAEP');
	await page.getByRole('button', { name: 'GENERATE KEY PAIR' }).click();
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
	await expect(u.encrypted).toHaveValue('aGk=');
	await u.decrypt.click();
	await expect(u.decryptedError).toHaveText('Base64 bytes are not valid UTF-8 text');

	await u.algorithm.selectOption('Hex');
	await expect(u.encrypted).toHaveValue('');
	await expect(u.decryptedError).toHaveCount(0);
	await expect(u.decrypted).toHaveValue('');
});

test('Base64 decode reports non-UTF-8 bytes and accepts URL-safe input', async ({ page }) => {
	const u = ui(page);
	await u.algorithm.selectOption('Base64');
	await u.input.fill('/w==');
	await u.decrypt.click();
	await expect(u.decryptedError).toHaveText('Base64 bytes are not valid UTF-8 text');
	await u.input.fill('SGVsbG8_');
	await u.decrypt.click();
	await expect(u.decrypted).toHaveValue('Hello?');
});

test('COPY and USE AS INPUT are disabled while there is nothing to copy', async ({ page }) => {
	const u = ui(page);
	await expect(u.copyEncrypted).toBeDisabled();
	await expect(u.copyDecrypted).toBeDisabled();
	await expect(u.useAsInput).toBeDisabled();
	await u.encrypt.click();
	await expect(u.encryptedError).toHaveText('Input text is required');
	await expect(u.copyEncrypted).toBeDisabled();
	await expect(u.useAsInput).toBeDisabled();
});

test('COPY confirms success and copies the output', async ({ page }) => {
	await stubClipboard(page, 'resolve');
	const u = ui(page);
	await u.algorithm.selectOption('Hex');
	await u.input.fill('hi');
	await u.encrypt.click();
	await expect(u.copyEncrypted).toBeEnabled();
	await u.copyEncrypted.click();
	await expect(u.copyEncrypted).toHaveText('COPIED');
	expect(await page.evaluate(() => (window as unknown as { copied: string[] }).copied)).toEqual([
		'6869'
	]);
	await expect(u.copyEncrypted).toHaveText('COPY');
});

test('COPY reports a rejected clipboard write', async ({ page }) => {
	await stubClipboard(page, 'reject');
	const u = ui(page);
	await u.algorithm.selectOption('ROT13');
	await u.input.fill('hi');
	await u.encrypt.click();
	await u.copyEncrypted.click();
	await expect(u.copyEncrypted).toHaveText('COPY FAILED');
});
