import { expect, test, type Page } from '@playwright/test';

/** Load the page and wait until it has hydrated, so clicks are not lost. */
async function open(page: Page) {
	await page.goto('/split');
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('ASSET SPLITTING');
}

/** Collect console errors and uncaught exceptions so the test can fail on them. */
function trackErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(msg.text());
	});
	page.on('pageerror', (err) => errors.push(err.message));
	return errors;
}

async function addPerson(page: Page, name: string) {
	await page.getByLabel('Person name').fill(name);
	await page.getByRole('button', { name: 'Add person' }).click();
}

async function addItem(page: Page, description: string, price: string) {
	await page.getByLabel('Item description').fill(description);
	await page.getByLabel('Item price in euros').fill(price);
	await page.getByRole('button', { name: 'Add Item' }).click();
}

/** "Pay 20 000 €" -> 20000, "Receive 20 000 €" -> -20000, "No payment" -> 0. */
function signedAmount(text: string): number {
	const n = Number(text.replace(/\D/g, '') || '0');
	if (text.startsWith('Pay')) return n;
	if (text.startsWith('Receive')) return -n;
	return 0;
}

test('Asset Splitting - full algorithm flow', async ({ page }) => {
	const errors = trackErrors(page);
	await open(page);

	await addPerson(page, 'Alice');
	await addPerson(page, 'Bob');
	await expect(page.getByRole('listitem').filter({ hasText: 'Alice' })).toBeVisible();
	await expect(page.getByRole('listitem').filter({ hasText: 'Bob' })).toBeVisible();

	await addItem(page, 'Car', '10000');
	// Enter in the price field submits the add-item form.
	await page.getByLabel('Item description').fill('House');
	await page.getByLabel('Item price in euros').fill('50000');
	await page.getByLabel('Item price in euros').press('Enter');
	await expect(page.getByRole('cell', { name: 'Car', exact: true })).toBeVisible();
	await expect(page.getByRole('cell', { name: 'House', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'START' }).click();
	await expect(page.locator('.panel-title')).toHaveText('ROUND 0');

	// LPT puts the House in group 1 and the Car in group 2.
	const groups = page.getByTestId('split-group');
	await expect(groups).toHaveCount(2);
	await expect(groups.nth(0)).toContainText('House');
	await expect(groups.nth(0)).toContainText('Taker: Pay');
	await expect(groups.nth(1)).toContainText('Car');
	await expect(groups.nth(1)).toContainText('Taker: Receive');
	await expect(page.getByText('-0')).toHaveCount(0);

	// No suggestion before the first round.
	await expect(page.getByText('Complete a round to see a suggested split.')).toBeVisible();

	const alice = page.getByLabel("Alice's group choice");
	const bob = page.getByLabel("Bob's group choice");
	const complete = page.getByRole('button', { name: 'COMPLETE ROUND' });

	await expect(complete).toBeDisabled();
	await alice.selectOption('0');
	await expect(complete).toBeDisabled();
	await bob.selectOption('1');
	await expect(complete).toBeEnabled();
	await complete.click();

	await expect(page.locator('.panel-title')).toHaveText('ROUND 1');
	await expect(alice).toHaveValue('');
	await expect(bob).toHaveValue('');
	await expect(complete).toBeDisabled();

	// Suggested split: one row per person, provisional, payments net to zero.
	await expect(page.getByTestId('split-stability')).toContainText('Provisional');
	const rows = page.getByRole('table', { name: 'Suggested Split' }).locator('tbody tr');
	await expect(rows).toHaveCount(2);
	const payments = await rows.locator('td:nth-child(3)').allTextContents();
	expect(payments).toHaveLength(2);
	expect(payments.reduce((s, t) => s + signedAmount(t), 0)).toBe(0);

	expect(errors).toEqual([]);
});

test('Asset Splitting - START is blocked with a reason until 2 people and 1 item', async ({
	page
}) => {
	const errors = trackErrors(page);
	await open(page);
	const start = page.getByRole('button', { name: 'START' });

	await addPerson(page, 'Alice');
	await expect(start).toBeDisabled();
	await expect(page.getByText('Add at least 2 people to start.')).toBeVisible();

	await addPerson(page, 'Bob');
	await expect(page.getByText('Add at least 1 item to start.')).toBeVisible();

	await addItem(page, 'Car', '10000');
	await expect(start).toBeEnabled();
	expect(errors).toEqual([]);
});

test('Asset Splitting - invalid input shows a message', async ({ page }) => {
	await open(page);

	await page.getByRole('button', { name: 'Add person' }).click();
	await expect(page.getByRole('alert')).toHaveText('Enter a name.');

	await page.getByLabel('Item description').fill('Car');
	await page.getByLabel('Item price in euros').fill('0');
	await page.getByRole('button', { name: 'Add Item' }).click();
	await expect(page.getByText('Enter a price greater than 0.')).toBeVisible();
	await expect(page.getByRole('cell', { name: 'Car', exact: true })).toHaveCount(0);
});

test('Asset Splitting - items can be deleted and the round view can go back', async ({ page }) => {
	await open(page);

	await addPerson(page, 'Alice');
	await addPerson(page, 'Bob');
	await addItem(page, 'Car', '10000');
	await addItem(page, 'Boat', '3000');
	await page.getByRole('button', { name: 'Delete Boat' }).click();
	await expect(page.getByRole('cell', { name: 'Boat', exact: true })).toHaveCount(0);
	await addItem(page, 'House', '50000');

	await page.getByRole('button', { name: 'START' }).click();
	await page.getByLabel("Alice's group choice").selectOption('0');
	await page.getByLabel("Bob's group choice").selectOption('0');
	await page.getByRole('button', { name: 'COMPLETE ROUND' }).click();
	await expect(page.locator('.panel-title')).toHaveText('ROUND 1');

	await page.getByRole('button', { name: 'Back to setup' }).click();
	await expect(page.getByLabel('Person name')).toBeVisible();
	// Entered prices are restored, not the drifted consensus prices.
	const carRow = page.getByRole('row').filter({ hasText: 'Car' });
	await expect(carRow).toContainText(/10\s000\s€/);
	await page.getByRole('button', { name: 'START' }).click();
	await expect(page.locator('.panel-title')).toHaveText('ROUND 0');
});
