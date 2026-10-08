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
		decrypt: page.getByRole('button', { name: 'DECRYPT', exact: true })
	};
}

/** Encrypt the input, move the ciphertext into the input, decrypt, and return the ciphertext. */
async function roundTrip(page: Page, text: string): Promise<string> {
	const u = ui(page);
	await u.input.fill(text);
	await u.encrypt.click();
	await expect(u.encryptedError).toHaveCount(0);
	await expect(u.encrypted).not.toHaveValue('');
	const ciphertext = await u.encrypted.inputValue();
	expect(ciphertext).not.toBe(text);
	await u.input.fill(ciphertext);
	await u.decrypt.click();
	await expect(u.decryptedError).toHaveCount(0);
	await expect(u.decrypted).toHaveValue(text);
	return ciphertext;
}

test.beforeEach(async ({ page }) => {
	await page.goto('/cipher');
	await expect(page.locator('h1')).toHaveText('ENCRYPTER/DECRYPTER');
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
