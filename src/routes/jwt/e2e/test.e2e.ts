import { expect, test, type Page } from '@playwright/test';

const SAMPLE_SECRET = 'your-256-bit-secret';

function ui(page: Page) {
	return {
		token: page.locator('textarea.token-input'),
		header: page.locator('.header-panel .panel-content'),
		payload: page.locator('.payload-panel .panel-content'),
		secret: page.getByLabel(/SECRET|KEY \(PEM OR JWK\)/),
		algorithm: page.getByLabel('ALGORITHM'),
		headerJson: page.getByLabel('HEADER (JSON)'),
		payloadJson: page.getByLabel('PAYLOAD (JSON)'),
		encode: page.getByRole('button', { name: /ENCODE/ }),
		status: page.locator('.signature-panel .signature-status')
	};
}

function decodeSegment(token: string, index: number): unknown {
	return JSON.parse(Buffer.from(token.split('.')[index], 'base64url').toString('utf-8'));
}

test.beforeEach(async ({ page }) => {
	await page.goto('/jwt');
	await expect(page.locator('h1')).toHaveText('JWT PARSER');
});

test('decodes the default sample token into the panels', async ({ page }) => {
	const u = ui(page);
	await expect(u.payload).toContainText('"name": "John Doe"');
	await expect(u.header).toContainText('"alg": "HS256"');
	await expect(u.payload).toContainText('iat: 2018-01-18T01:30:22.000Z');
});

test('a malformed paste clears the previous token from every panel', async ({ page }) => {
	const u = ui(page);
	await expect(u.payload).toContainText('John Doe');
	await u.token.fill('part1.part2');
	await expect(u.header).toHaveText('Invalid JWT format');
	await expect(u.payload).not.toContainText('John Doe');
	await expect(page.locator('.signature-value')).toHaveText('Not available');
});

test('verifies the sample with its secret and rejects a wrong one', async ({ page }) => {
	const u = ui(page);
	await u.secret.fill(SAMPLE_SECRET);
	await expect(u.status).toHaveText('Signature Verified');
	await u.secret.fill('x');
	await expect(u.status).toHaveText('Signature Invalid');
});

test('ENCODE signs the edited payload into the token and it verifies', async ({ page }) => {
	const u = ui(page);
	await expect(u.payload).toContainText('John Doe');
	await u.secret.fill(SAMPLE_SECRET);
	await u.payloadJson.fill('{\n  "sub": "42",\n  "name": "Jane Roe"\n}');
	await u.encode.click();
	await expect(u.payload).toContainText('"name": "Jane Roe"');
	const token = await u.token.inputValue();
	expect(decodeSegment(token, 1)).toEqual({ sub: '42', name: 'Jane Roe' });
	expect(decodeSegment(token, 0)).toEqual({ alg: 'HS256', typ: 'JWT' });
	await expect(u.status).toHaveText('Signature Verified');
});

test('ENCODE rejects a non-object payload with a visible error', async ({ page }) => {
	const u = ui(page);
	const before = await u.token.inputValue();
	await u.payloadJson.fill('[1]');
	await u.encode.click();
	await expect(page.locator('.encode-section')).toContainText('Payload must be a JSON object');
	await expect(u.token).toHaveValue(before);
});

test('an unsigned alg none token shows the unsigned banner', async ({ page }) => {
	const u = ui(page);
	await u.algorithm.selectOption('none');
	await u.encode.click();
	await expect(u.token).toHaveValue(/\.$/);
	await expect(page.getByRole('alert').filter({ hasText: 'Unsigned token' })).toBeVisible();
});
