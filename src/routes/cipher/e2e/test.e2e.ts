import { expect, test, type Page } from '@playwright/test';

const MESSAGE = 'Hello World! Grüße, 世界 🔐';

function ui(page: Page) {
	const result = page.getByTestId('result-panel');
	return {
		encryptMode: page.getByRole('radio', { name: 'Encrypt' }),
		decryptMode: page.getByRole('radio', { name: 'Decrypt' }),
		advanced: page.locator('details.advanced > summary'),
		algorithm: page.getByLabel('Algorithm'),
		password: page.getByLabel('Password'),
		publicKey: page.getByLabel('Public key'),
		privateKey: page.getByLabel('Private key'),
		message: page.getByLabel('Message', { exact: true }),
		resultPanel: result,
		result: result.getByRole('status', { name: 'Result' }),
		resultError: result.getByRole('alert').getByTestId('result-error'),
		encrypt: page.getByRole('button', { name: 'Encrypt', exact: true }),
		decrypt: page.getByRole('button', { name: 'Decrypt', exact: true }),
		generate: page.getByRole('button', { name: 'Generate', exact: true }),
		generatePair: page.getByRole('button', { name: 'Generate key pair' }),
		copy: result.getByRole('button', { name: /^Cop(y|ied)/ })
	};
}

/** Load the tool and wait until it has hydrated, so clicks are not lost. */
async function open(page: Page) {
	await page.goto('/cipher');
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Encrypter/Decrypter');
}

/** Open the Advanced line and pick an algorithm. */
async function pickAlgorithm(page: Page, algorithm: string) {
	const u = ui(page);
	if (!(await u.algorithm.isVisible())) await u.advanced.click();
	await u.algorithm.selectOption(algorithm);
	await expect(u.advanced).toContainText(`algorithm ${algorithm}`);
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

/** Encrypt the message, paste the ciphertext into Decrypt mode, decrypt, and return the ciphertext. */
async function roundTrip(page: Page, text: string): Promise<string> {
	const u = ui(page);
	await u.message.fill(text);
	await u.encrypt.click();
	await expect(u.resultError).toHaveCount(0);
	await expect(u.result).not.toHaveText('');
	const ciphertext = (await u.result.textContent()) ?? '';
	expect(ciphertext).not.toBe(text);
	await u.decryptMode.check();
	await expect(u.resultPanel).toHaveCount(0);
	await u.message.fill(ciphertext);
	await u.decrypt.click();
	await expect(u.resultError).toHaveCount(0);
	await expect(u.result).toHaveText(text);
	return ciphertext;
}

test.beforeEach(async ({ page }) => {
	await open(page);
});

test('first load shows the form only, in Encrypt mode, with AES-GCM folded under Advanced', async ({
	page
}) => {
	const u = ui(page);
	await expect(u.encryptMode).toBeChecked();
	await expect(u.password).toBeVisible();
	await expect(u.message).toBeVisible();
	await expect(u.encrypt).toBeVisible();
	await expect(u.decrypt).toHaveCount(0);
	await expect(u.resultPanel).toHaveCount(0);
	await expect(u.algorithm).toBeHidden();
	await expect(u.advanced).toHaveText('Advanced · algorithm AES-GCM');
});

test('the main button follows the mode', async ({ page }) => {
	const u = ui(page);
	await u.decryptMode.check();
	await expect(u.decrypt).toBeVisible();
	await expect(u.encrypt).toHaveCount(0);
	await u.encryptMode.check();
	await expect(u.encrypt).toBeVisible();
	await expect(u.decrypt).toHaveCount(0);
});

for (const algorithm of ['AES-GCM', 'AES-CBC']) {
	test(`${algorithm} encrypts and decrypts back to the original text`, async ({ page }) => {
		const u = ui(page);
		await pickAlgorithm(page, algorithm);
		await u.password.fill('mysecretkey123');
		const ciphertext = await roundTrip(page, MESSAGE);
		expect(ciphertext).toMatch(/^v1:[A-Za-z0-9+/]+=*$/);
	});

	test(`${algorithm} shows a visible error for a wrong password`, async ({ page }) => {
		const u = ui(page);
		await pickAlgorithm(page, algorithm);
		await u.password.fill('right key');
		await u.message.fill(MESSAGE);
		await u.encrypt.click();
		await expect(u.result).not.toHaveText('');
		const ciphertext = (await u.result.textContent()) ?? '';
		await u.decryptMode.check();
		await u.password.fill('wrong key');
		await u.message.fill(ciphertext);
		await u.decrypt.click();
		await expect(u.resultError).toHaveText('Wrong key or corrupted ciphertext');
		await expect(u.copy).toHaveCount(0);
	});
}

test('Generate fills the password and it round-trips', async ({ page }) => {
	const u = ui(page);
	await u.generate.click();
	await expect(u.password).toHaveValue(/^[A-Za-z0-9]{22}$/);
	await roundTrip(page, MESSAGE);
});

test('a missing password shows the error under the Password box, not in a result', async ({
	page
}) => {
	const u = ui(page);
	await u.message.fill(MESSAGE);
	await u.encrypt.click();
	await expect(u.password).toHaveAttribute('aria-invalid', 'true');
	await expect(u.password).toHaveAccessibleDescription('Enter a password');
	await expect(u.resultPanel).toHaveCount(0);
	await u.password.fill('x');
	await expect(u.password).not.toHaveAttribute('aria-invalid', 'true');
});

test('a missing message shows the error under the Message box', async ({ page }) => {
	const u = ui(page);
	await u.password.fill('x');
	await u.encrypt.click();
	await expect(u.message).toHaveAttribute('aria-invalid', 'true');
	await expect(u.message).toHaveAccessibleDescription('Enter a message');
	await expect(u.resultPanel).toHaveCount(0);
});

for (const [algorithm, expected] of [
	['Base64', 'aGk='],
	['Hex', '6869'],
	['ROT13', 'uv']
] as const) {
	test(`${algorithm} needs no key and round-trips`, async ({ page }) => {
		const u = ui(page);
		await pickAlgorithm(page, algorithm);
		await expect(u.password).toHaveCount(0);
		await u.message.fill('hi');
		await u.encrypt.click();
		await expect(u.result).toHaveText(expected);
		await roundTrip(page, MESSAGE);
	});
}

test('RSA-OAEP shows only the key each mode needs and round-trips a generated pair', async ({
	page
}) => {
	const u = ui(page);
	await pickAlgorithm(page, 'RSA-OAEP');
	await expect(u.password).toHaveCount(0);
	await expect(u.privateKey).toHaveCount(0);
	await u.generatePair.click();
	await expect(u.publicKey).toHaveValue(/-----BEGIN PUBLIC KEY-----/);
	await u.decryptMode.check();
	await expect(u.publicKey).toHaveCount(0);
	await expect(u.privateKey).toHaveValue(/-----BEGIN PRIVATE KEY-----/);
	await u.encryptMode.check();
	await roundTrip(page, MESSAGE);
});

test('RSA-OAEP reports the byte limit for an oversized input', async ({ page }) => {
	const u = ui(page);
	await pickAlgorithm(page, 'RSA-OAEP');
	await u.generatePair.click();
	await expect(u.publicKey).toHaveValue(/-----BEGIN PUBLIC KEY-----/);
	await u.message.fill('a'.repeat(191));
	await u.encrypt.click();
	await expect(u.resultError).toContainText('limit is 190 bytes');
});

test('RSA-OAEP without a key asks for one under the key box', async ({ page }) => {
	const u = ui(page);
	await pickAlgorithm(page, 'RSA-OAEP');
	await u.message.fill('hi');
	await u.encrypt.click();
	await expect(u.publicKey).toHaveAccessibleDescription(/Enter a public key/);
	await expect(u.resultPanel).toHaveCount(0);
});

test('switching algorithm or mode clears the result', async ({ page }) => {
	const u = ui(page);
	await pickAlgorithm(page, 'Base64');
	await u.message.fill('hi');
	await u.encrypt.click();
	await expect(u.result).toHaveText('aGk=');

	await pickAlgorithm(page, 'Hex');
	await expect(u.resultPanel).toHaveCount(0);

	await u.encrypt.click();
	await expect(u.result).toHaveText('6869');
	await u.decryptMode.check();
	await expect(u.resultPanel).toHaveCount(0);
	await expect(u.message).toHaveValue('hi');
});

test('Base64 decode reports non-UTF-8 bytes and accepts URL-safe input', async ({ page }) => {
	const u = ui(page);
	await pickAlgorithm(page, 'Base64');
	await u.decryptMode.check();
	await u.message.fill('/w==');
	await u.decrypt.click();
	await expect(u.resultError).toHaveText('Base64 bytes are not valid UTF-8 text');
	await u.message.fill('SGVsbG8_');
	await u.decrypt.click();
	await expect(u.result).toHaveText('Hello?');
});

test('the result offers only Copy', async ({ page }) => {
	const u = ui(page);
	await pickAlgorithm(page, 'Hex');
	await u.message.fill('hi');
	await u.encrypt.click();
	await expect(u.resultPanel.getByRole('button')).toHaveCount(1);
	await expect(u.copy).toBeVisible();
	await expect(page.getByRole('button', { name: 'Use as input' })).toHaveCount(0);
});

test('Copy confirms success and copies the output', async ({ page }) => {
	await stubClipboard(page, 'resolve');
	const u = ui(page);
	await pickAlgorithm(page, 'Hex');
	await u.message.fill('hi');
	await u.encrypt.click();
	await u.copy.click();
	await expect(u.copy).toHaveText('Copied');
	expect(await page.evaluate(() => (window as unknown as { copied: string[] }).copied)).toEqual([
		'6869'
	]);
	await expect(u.copy).toHaveText('Copy');
});

test('Copy reports a rejected clipboard write', async ({ page }) => {
	await stubClipboard(page, 'reject');
	const u = ui(page);
	await pickAlgorithm(page, 'ROT13');
	await u.message.fill('hi');
	await u.encrypt.click();
	await u.copy.click();
	await expect(u.copy).toHaveText('Copy failed');
});
