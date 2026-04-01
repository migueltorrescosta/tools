import { expect, test } from '@playwright/test';

test('AES-GCM encrypt and decrypt produces different output', async ({ page }) => {
	await page.goto('/crypto');

	await page.selectOption('select.algorithm-select', 'AES-GCM');

	await page.fill('#encryption-key', 'mysecretkey123');
	await page.fill('#decryption-key', 'mysecretkey123');

	const inputText = 'Hello World! This is a test message.';
	await page.fill('.input-panel textarea', inputText);

	await page.click('button:has-text("ENCRYPT & DECRYPT")');

	await page.waitForTimeout(500);

	const encryptedText = await page.locator('.panel:nth-child(3) textarea').inputValue();
	const decryptedText = await page.locator('.panel:first-child textarea').inputValue();

	expect(encryptedText).not.toBe(inputText);
	expect(decryptedText).toBe(inputText);

	const inputValue = await page.locator('.input-panel textarea').inputValue();
	expect(inputValue).toBe(decryptedText);
});
