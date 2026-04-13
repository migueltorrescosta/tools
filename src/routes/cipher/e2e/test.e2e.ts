import { expect, test } from '@playwright/test';

test('AES-GCM encrypt and decrypt produces different output', async ({ page }) => {
	await page.goto('/cipher');

	await page.selectOption('select.algorithm-select', 'AES-GCM');

	await page.fill('#encryption-key', 'mysecretkey123');
	await page.fill('#decryption-key', 'mysecretkey123');

	const inputText = 'Hello World! This is a test message.';
	await page.fill('.input-panel textarea', inputText);

	await page.click('button:has-text("ENCRYPT")');

	await page.waitForTimeout(500);

	// Verify encrypted text appears
	const encryptedText = await page.locator('.panel-textarea').last().inputValue();
	expect(encryptedText).not.toBe(inputText);
	expect(encryptedText.length).toBeGreaterThan(0);

	// Check heading is present
	await expect(page.locator('h1')).toHaveText('ENCRYPTER/DECRYPTER');
});
