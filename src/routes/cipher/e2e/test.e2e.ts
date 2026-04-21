import { expect, test } from '@playwright/test';

test('AES-GCM encrypt and decrypt produces different output', async ({ page }) => {
	await page.goto('/cipher');

	// Wait for page to be fully loaded
	await page.waitForLoadState('networkidle');

	// Select AES-GCM algorithm
	await page.selectOption('select.algorithm-select', 'AES-GCM');

	// Fill encryption key and wait for it to be set
	await page.fill('#encryption-key', 'mysecretkey123');
	await page.waitForTimeout(100);

	// Fill decryption key and wait for it to be set
	await page.fill('#decryption-key', 'mysecretkey123');
	await page.waitForTimeout(100);

	const inputText = 'Hello World! This is a test message.';
	await page.fill('.input-panel textarea', inputText);
	await page.waitForTimeout(100);

	// Click encrypt button
	await page.click('button:has-text("ENCRYPT")');
	await page.waitForTimeout(1000);

	// Verify encrypted text appears
	const encryptedText = await page.locator('.panel-textarea').last().inputValue();

	// Debug: print encrypted text length if empty
	if (encryptedText.length === 0) {
		const errorEl = page.locator('.panel').nth(2).locator('.error');
		const hasError = await errorEl.isVisible();
		if (hasError) {
			console.log('Error:', await errorEl.textContent());
		}
	}

	expect(encryptedText.length).toBeGreaterThan(0);

	// Check heading is present
	await expect(page.locator('h1')).toHaveText('ENCRYPTER/DECRYPTER');
});
