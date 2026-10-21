import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

/** Load the page and wait until it has hydrated, so clicks are not lost. */
async function open(page: Page) {
	await page.goto('/split');
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Asset Splitting');
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
	await page.getByLabel('Item price (€)').fill(price);
	await page.getByRole('button', { name: 'Add item' }).click();
}

/** "Pay 20 000 €" -> 20000, "Receive 20 000 €" -> -20000, "No payment" -> 0. */
function signedAmount(text: string): number {
	const n = Number(text.replace(/\D/g, '') || '0');
	if (text.startsWith('Pay')) return n;
	if (text.startsWith('Receive')) return -n;
	return 0;
}

/** Alice and Bob split a House and a Car; lands on the round 1 board. */
async function startTwo(page: Page) {
	await open(page);
	await addPerson(page, 'Alice');
	await addPerson(page, 'Bob');
	await addItem(page, 'Car', '10000');
	await addItem(page, 'House', '50000');
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Round 1', exact: true })).toBeVisible();
}

/** One card per person on the final screen. */
const finalRows = (page: Page) => page.getByTestId('final-person');

async function expectSettlementsSumToZero(page: Page) {
	const rows = finalRows(page);
	await expect(rows).toHaveCount(2);
	const payments = await Promise.all(
		(await rows.all()).map((row) => row.locator('.settlement').innerText())
	);
	expect(payments.reduce((s, t) => s + signedAmount(t), 0)).toBe(0);
}

/** An item pill in the setup screen. */
const itemPill = (page: Page, name: string) =>
	page.getByRole('list', { name: 'Items' }).getByRole('listitem').filter({ hasText: name });

const chip = (scope: Page | Locator, name: string) =>
	scope.getByRole('button', { name, exact: true });

/** The hidden tap fallback: tap a chip, then tap a group card. */
async function tapPlace(page: Page, name: string, group: number) {
	await chip(page, name).click();
	await expect(chip(page, name)).toHaveAttribute('aria-pressed', 'true');
	await page
		.getByTestId('split-group')
		.nth(group)
		.click({ position: { x: 12, y: 12 } });
	await expect(chip(page.getByTestId('split-group').nth(group), name)).toBeVisible();
}

test('Asset Splitting - picks on different groups certify the split', async ({ page }) => {
	const errors = trackErrors(page);
	await startTwo(page);

	// The first proposal is the price-balanced grouping: House alone, Car alone.
	const groups = page.getByTestId('split-group');
	await expect(groups).toHaveCount(2);
	await expect(groups.nth(0)).toContainText('House');
	await expect(groups.nth(0)).toContainText('Taker: Pay');
	await expect(groups.nth(1)).toContainText('Car');
	await expect(groups.nth(1)).toContainText('Taker: Receive');
	await expect(groups.nth(0)).not.toContainText('Worth');
	await expect(page.getByText('-0')).toHaveCount(0);
	// Pay is red, Receive green.
	await expect(groups.nth(0).getByText(/^Pay /)).toHaveAttribute('style', /--danger-text/);
	await expect(groups.nth(1).getByText(/^Receive /)).toHaveAttribute('style', /--success-text/);

	// No visible placement controls besides the chips.
	const unplaced = page.getByTestId('split-unplaced');
	await expect(groups.getByRole('combobox')).toHaveCount(0);
	await expect(unplaced.getByRole('combobox')).toHaveCount(0);
	await expect(chip(unplaced, 'Alice')).toBeVisible();
	await expect(chip(unplaced, 'Bob')).toBeVisible();

	const complete = page.getByRole('button', { name: 'Complete round' });
	await expect(complete).toBeDisabled();
	await tapPlace(page, 'Alice', 0);
	await expect(page.getByTestId('split-announce')).toHaveText('Alice chose group 1');
	await expect(complete).toBeDisabled();
	await tapPlace(page, 'Bob', 1);
	await expect(complete).toBeEnabled();
	await complete.click();

	await expect(page.getByRole('heading', { name: 'Everyone keeps their own group' })).toBeVisible();
	await expect(page.getByText('At these amounts, nobody would rather swap.')).toBeVisible();
	const alice = finalRows(page).filter({ hasText: 'Alice' });
	await expect(alice).toContainText('House');
	await expect(alice).toContainText('Pay');
	await expect(alice.locator('.settlement')).toHaveAttribute('style', /--danger-text/);
	await expectSettlementsSumToZero(page);
	// One concrete payment settles two people.
	const payments = page.getByRole('region', { name: 'Who pays whom' }).getByRole('listitem');
	await expect(payments).toHaveCount(1);
	await expect(payments).toHaveText(/^Alice pays Bob \d[\d\s]*\s€$/);
	const paid = signedAmount('Pay ' + (await payments.innerText()));
	const owed = signedAmount(await alice.locator('.settlement').innerText());
	expect(paid).toBe(owed);

	// Swap or adjust: trade the items, then re-check on the board.
	await page.getByRole('button', { name: 'Swap or adjust' }).click();
	await expect(page.getByText('€')).toHaveCount(0);
	const adjustCard = (name: string) =>
		page.getByTestId('adjust-person').filter({ has: page.getByRole('heading', { name }) });
	// Tap fallback: tap the Car pill, then Alice's card.
	await page.getByRole('button', { name: 'Car', exact: true }).click();
	await page.getByRole('button', { name: 'Give Car to Alice' }).click();
	await expect(adjustCard('Alice')).toContainText('Car');
	// Drag the House pill onto Bob's card.
	const house = await page.getByRole('button', { name: 'House', exact: true }).boundingBox();
	const bob = await adjustCard('Bob').boundingBox();
	if (!house || !bob) throw new Error('no layout');
	await page.mouse.move(house.x + house.width / 2, house.y + house.height / 2);
	await page.mouse.down();
	await page.mouse.move(bob.x + bob.width / 2, bob.y + bob.height / 2, { steps: 8 });
	await page.mouse.up();
	await expect(adjustCard('Bob')).toContainText('House');
	await expect(adjustCard('Alice')).not.toContainText('House');
	await page.getByRole('button', { name: 'Re-check' }).click();
	await expect(groups.nth(0)).toContainText('Car');
	await expect(groups.nth(1)).toContainText('House');
	await tapPlace(page, 'Alice', 0);
	await tapPlace(page, 'Bob', 1);
	await complete.click();
	await expect(finalRows(page).filter({ hasText: 'Alice' })).toContainText('Car');
	await expectSettlementsSumToZero(page);

	// Start over keeps people and items.
	await page.getByRole('button', { name: 'Start over' }).click();
	await expect(itemPill(page, 'House')).toBeVisible();
	await expect(page.getByRole('listitem').filter({ hasText: 'Bob' })).toBeVisible();

	expect(errors).toEqual([]);
});

test('Asset Splitting - chips can be dragged, tapped or placed by keyboard', async ({ page }) => {
	const errors = trackErrors(page);
	await startTwo(page);
	const groups = page.getByTestId('split-group');
	const unplaced = page.getByTestId('split-unplaced');

	// Drag Alice's chip onto group 2 with the mouse.
	const from = (await chip(page, 'Alice').boundingBox())!;
	const to = (await groups.nth(1).boundingBox())!;
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 - 10, { steps: 3 });
	await expect(chip(page, 'Alice')).toHaveClass(/lifted/);
	await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
	await expect(groups.nth(1)).toHaveClass(/drop-over/);
	await page.mouse.up();
	await expect(chip(groups.nth(1), 'Alice')).toBeVisible();
	await expect(page.getByTestId('split-announce')).toHaveText('Alice chose group 2');
	await expect(chip(page, 'Alice')).toHaveAttribute('aria-pressed', 'false');

	// A drop outside every group card unplaces the chip.
	const box = (await chip(page, 'Alice').boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + 10, 5, { steps: 6 });
	await page.mouse.up();
	await expect(chip(unplaced, 'Alice')).toBeVisible();
	await expect(page.getByTestId('split-announce')).toHaveText('Alice is unplaced');

	// Tap to select, Escape to cancel; the cards only become targets while selected.
	await expect(page.getByRole('button', { name: /^Place / })).toHaveCount(0);
	await chip(page, 'Bob').click();
	await expect(chip(page, 'Bob')).toHaveAttribute('aria-pressed', 'true');
	await expect(groups.nth(0)).toHaveClass(/targetable/);
	await page.keyboard.press('Escape');
	await expect(chip(page, 'Bob')).toHaveAttribute('aria-pressed', 'false');
	await expect(page.getByRole('button', { name: /^Place / })).toHaveCount(0);

	// Tap a chip, then tap a card.
	await tapPlace(page, 'Bob', 0);
	await expect(page.getByTestId('split-announce')).toHaveText('Bob chose group 1');

	// Keyboard: Enter on a chip, then Enter on a focused card.
	await chip(page, 'Alice').focus();
	await page.keyboard.press('Enter');
	await expect(chip(page, 'Alice')).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: 'Place Alice in group 2' }).focus();
	await page.keyboard.press('Enter');
	await expect(chip(groups.nth(1), 'Alice')).toBeVisible();
	await expect(page.getByTestId('split-announce')).toHaveText('Alice chose group 2');
	await expect(page.getByRole('button', { name: 'Complete round' })).toBeEnabled();

	expect(errors).toEqual([]);
});

test('Asset Splitting - a shared pick starts another round', async ({ page }) => {
	const errors = trackErrors(page);
	await startTwo(page);
	const groups = page.getByTestId('split-group');
	await tapPlace(page, 'Alice', 0);
	await expect(groups.nth(1)).not.toContainText('Unclaimed');
	await tapPlace(page, 'Bob', 0);
	await expect(groups.nth(0)).toContainText('Over-demanded');
	await expect(groups.nth(1)).toContainText('Unclaimed');

	await page.getByRole('button', { name: 'Complete round' }).click();
	await expect(page.getByRole('heading', { name: 'Round 2', exact: true })).toBeVisible();
	await expect(chip(page.getByTestId('split-unplaced'), 'Alice')).toBeVisible();
	await expect(groups.nth(0)).not.toContainText('Over-demanded');

	// Back to setup discards the rounds and keeps the entered prices.
	await page.getByRole('button', { name: 'Back to setup' }).click();
	await expect(page.getByLabel('Person name')).toBeVisible();
	await expect(itemPill(page, 'Car')).toContainText(/10\s000\s€/);
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Round 1', exact: true })).toBeVisible();
	expect(errors).toEqual([]);
});

test('Asset Splitting - after the round cap the best split is offered', async ({ page }) => {
	const errors = trackErrors(page);
	await startTwo(page);
	const offer = page.getByText('No split everyone agrees on yet.');
	const sharePick = async (round: number) => {
		await expect(page.getByRole('heading', { name: `Round ${round}`, exact: true })).toBeVisible();
		await tapPlace(page, 'Alice', 0);
		await tapPlace(page, 'Bob', 0);
		await page.getByRole('button', { name: 'Complete round' }).click();
	};
	// Two items, two people: the cap is 2 * 1 + 3 = 5 rounds.
	for (let round = 1; round <= 5; round++) {
		await expect(offer).toHaveCount(0);
		await sharePick(round);
	}
	await expect(page.getByRole('heading', { name: 'Round 6', exact: true })).toBeVisible();
	await expect(offer).toBeVisible();
	await expect(offer).toContainText(
		/about \d+% likely fair, largest expected gap \d+% of a fair share/
	);
	await page.getByRole('button', { name: 'Keep going' }).click();
	await expect(offer).toHaveCount(0);
	await sharePick(6);
	await expect(offer).toBeVisible();
	await page.getByRole('button', { name: 'Accept this split' }).click();
	await expect(page.getByRole('heading', { name: 'Everyone keeps their own group' })).toBeVisible();
	await expectSettlementsSumToZero(page);
	expect(errors).toEqual([]);
});

test('Asset Splitting - Start is blocked with a reason until 2 people and 1 item', async ({
	page
}) => {
	const errors = trackErrors(page);
	await open(page);
	const start = page.getByRole('button', { name: 'Start', exact: true });

	await addPerson(page, 'Alice');
	await expect(start).toBeDisabled();
	await expect(page.getByText('Add at least 2 people to start.')).toBeVisible();

	await addPerson(page, 'Bob');
	await expect(page.getByText('Add at least 1 item to start.')).toBeVisible();

	await addItem(page, 'Car', '10000');
	// Enter in the price field submits the add-item form.
	await page.getByLabel('Item description').fill('House');
	await page.getByLabel('Item price (€)').fill('50000');
	await page.getByLabel('Item price (€)').press('Enter');
	await expect(itemPill(page, 'House')).toBeVisible();
	await expect(start).toBeEnabled();
	// Pills are sorted by price, highest first.
	await expect(page.getByRole('list', { name: 'Items' }).getByRole('listitem')).toHaveText([
		/House/,
		/Car/
	]);
	expect(errors).toEqual([]);
});

test('Asset Splitting - invalid input shows a message', async ({ page }) => {
	await open(page);

	await page.getByRole('button', { name: 'Add person' }).click();
	await expect(page.getByRole('alert')).toHaveText(/^\W*Enter a name\.$/);

	await page.getByLabel('Item description').fill('Car');
	await page.getByLabel('Item price (€)').fill('0');
	await page.getByRole('button', { name: 'Add item' }).click();
	await expect(page.getByText('Enter a price greater than 0.')).toBeVisible();
	// Rejected input stays in the form for correction, and no item row is added.
	await expect(page.getByLabel('Item description')).toHaveValue('Car');
	await expect(page.getByRole('button', { name: 'Remove Car' })).toHaveCount(0);

	await addItem(page, 'Boat', '3000');
	await page.getByRole('button', { name: 'Remove Boat' }).click();
	await expect(itemPill(page, 'Boat')).toHaveCount(0);

	// Duplicate names are rejected, ignoring case and spaces.
	await addPerson(page, 'Alice');
	await addPerson(page, ' alice ');
	await expect(page.getByText('That name is taken.')).toBeVisible();
	await expect(page.getByRole('button', { name: /^Remove alice/i })).toHaveCount(1);
	await page.getByRole('button', { name: 'Remove Alice' }).click();
	await expect(page.getByRole('list', { name: 'People' })).toHaveCount(0);
});

test('Asset Splitting - "+" adds and refocuses, and the setup survives a reload', async ({
	page
}) => {
	const errors = trackErrors(page);
	await open(page);
	await expect(page.getByRole('button', { name: 'Add person' })).toHaveText('+');
	await expect(page.getByRole('button', { name: 'Add person' })).toHaveAttribute(
		'title',
		'Add person'
	);
	await addPerson(page, 'Alice');
	await expect(page.getByLabel('Person name')).toBeFocused();
	await addPerson(page, 'Bob');
	await addItem(page, 'Car', '10000');
	await expect(page.getByLabel('Item description')).toBeFocused();
	await addItem(page, 'House', '50000');

	await page.reload();
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Remove Alice' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Remove Bob' })).toBeVisible();
	await expect(itemPill(page, 'House')).toContainText(/50\s000\s€/);
	// New entries after a reload get fresh ids (no duplicate keys).
	await addPerson(page, 'Carla');
	await expect(page.getByRole('list', { name: 'People' }).getByRole('listitem')).toHaveCount(3);
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Round 1', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'About rounds' })).toBeVisible();
	expect(errors).toEqual([]);
});

const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const colorScheme of ['light', 'dark'] as const) {
	test(`Asset Splitting - setup with pills has no WCAG 2.2 AA violations in ${colorScheme}`, async ({
		page
	}) => {
		await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
		await open(page);
		await addPerson(page, 'Alice');
		await addPerson(page, 'Bob');
		await addItem(page, 'House', '50000');
		await addItem(page, 'Car', '10000');
		await addItem(page, 'Lamp', '20');
		await page.getByRole('button', { name: 'About items' }).focus();
		await expect(page.getByRole('tooltip').filter({ hasText: 'best guess' })).toBeVisible();
		const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
		expect(violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
	});
}

for (const colorScheme of ['light', 'dark'] as const) {
	test(`Asset Splitting - the board has no WCAG 2.2 AA violations in ${colorScheme}`, async ({
		page
	}) => {
		await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
		await startTwo(page);
		await tapPlace(page, 'Alice', 0);
		await tapPlace(page, 'Bob', 0);
		await page.getByRole('button', { name: 'Complete round' }).click();
		await expect(page.getByRole('heading', { name: 'Round 2', exact: true })).toBeVisible();
		await tapPlace(page, 'Alice', 1);
		// A selected chip: the cards are targets.
		await chip(page, 'Bob').click();
		const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
		expect(violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);

		await page.keyboard.press('Escape');
		await tapPlace(page, 'Bob', 0);
		await page.getByRole('button', { name: 'Complete round' }).click();
		await expect(
			page.getByRole('heading', { name: 'Everyone keeps their own group' })
		).toBeVisible();
		const final = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
		expect(final.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
	});
}

test('Asset Splitting - group cards fill the row and the page fits 390px', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await startTwo(page);
	const groups = page.getByTestId('split-group');
	const row = (await page.locator('.groups').boundingBox())!;
	const last = (await groups.nth(1).boundingBox())!;
	expect(Math.abs(last.x + last.width - (row.x + row.width))).toBeLessThan(2);

	await page.setViewportSize({ width: 390, height: 844 });
	const width = () => page.evaluate(() => document.documentElement.scrollWidth);
	expect(await width()).toBeLessThanOrEqual(390);
	await tapPlace(page, 'Alice', 0);
	await tapPlace(page, 'Bob', 1);
	await page.getByRole('button', { name: 'Complete round' }).click();
	await expect(page.getByRole('heading', { name: 'Everyone keeps their own group' })).toBeVisible();
	expect(await width()).toBeLessThanOrEqual(390);
});
