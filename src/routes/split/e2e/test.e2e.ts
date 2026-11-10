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
	await page.getByLabel('Rough price (€)').fill(price);
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
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByRole('heading', { name: 'Round 1', exact: true })).toBeVisible();
}

/** One card per person on the final screen. */
const finalRows = (page: Page) => page.getByTestId('final-person');

/** The result's answer: the "Who pays whom" lines (one payment is the headline itself). */
const paymentLines = (page: Page) => page.getByTestId('payment');

/**
 * Two people: the answer is one payment, and the person cards below list
 * items only, never an amount.
 */
async function expectOnePayment(page: Page) {
	await expect(finalRows(page)).toHaveCount(2);
	await expect(paymentLines(page)).toHaveCount(1);
	await expect(paymentLines(page)).toHaveText(/^(Alice|Bob) pays (Alice|Bob) \d[\d\s]*\s€\s*$/);
	await expect(finalRows(page).getByText(/€|Pay|Receive/)).toHaveCount(0);
}

/** An item pill in the setup screen. */
const itemPill = (page: Page, name: string) =>
	page.getByRole('list', { name: 'Items' }).getByRole('listitem').filter({ hasText: name });

/** The progress stepper's current step. */
const currentStep = (page: Page) =>
	page.getByRole('list', { name: 'Progress' }).locator('[aria-current="step"]');

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

	await expect(currentStep(page)).toHaveText(/^3\s*Rounds · 1$/);
	await expect(page.getByRole('list', { name: 'Progress' })).toContainText(/Start\s\(done\)/);
	// The first proposal is the price-balanced grouping: House alone, Car alone.
	const groups = page.getByTestId('split-group');
	await expect(groups).toHaveCount(2);
	await expect(groups.nth(0)).toContainText('House');
	await expect(groups.nth(0)).toContainText('Pay');
	await expect(groups.nth(1)).toContainText('Car');
	await expect(groups.nth(1)).toContainText('Receive');

	// One visible instruction, then the name chips, then the groups; no info tip, no "Unplaced" label.
	await expect(
		page.getByText(/^Drag your name onto the group you'd take at these amounts\./)
	).toBeVisible();
	await expect(page.getByRole('button', { name: /^About / })).toHaveCount(0);
	await expect(page.getByText('Unplaced', { exact: true })).toHaveCount(0);
	const unplaced = page.getByTestId('split-unplaced');
	await expect(chip(unplaced, 'Alice')).toBeVisible();
	await expect(chip(unplaced, 'Bob')).toBeVisible();
	const tray = (await unplaced.boundingBox())!;
	expect(tray.y).toBeLessThan((await groups.nth(0).boundingBox())!.y);
	// Each card is headed by its amount, not a number.
	await expect(groups.nth(0).getByRole('heading', { level: 3 })).toHaveText(/^Pay \d/);
	await expect(groups.nth(1).getByRole('heading', { level: 3 })).toHaveText(/^Receive \d/);
	await expect(page.getByText(/^Group \d$/)).toHaveCount(0);
	const boardPay = signedAmount(await groups.nth(0).getByRole('heading').innerText());

	const complete = page.getByRole('button', { name: 'Complete round' });
	await expect(complete).toBeDisabled();
	await tapPlace(page, 'Alice', 0);
	await expect(page.getByTestId('split-announce')).toHaveText('Alice chose group 1');
	await expect(complete).toBeDisabled();
	await tapPlace(page, 'Bob', 1);
	await expect(complete).toBeEnabled();
	await complete.click();

	await expect(page.getByRole('heading', { name: 'Everyone keeps their own group' })).toBeVisible();
	await expect(currentStep(page)).toHaveText(/Result$/);
	await expect(page.getByRole('button', { name: /^About / })).toHaveCount(0);
	const alice = finalRows(page).filter({ hasText: 'Alice' });
	await expect(alice).toContainText('House');
	// The answer comes first: one concrete payment, the amount the board showed.
	await expectOnePayment(page);
	const payments = paymentLines(page);
	await expect(payments).toHaveText(/^Alice pays Bob \d[\d\s]*\s€\s*$/);
	expect(signedAmount('Pay ' + (await payments.innerText()))).toBe(boardPay);
	const answer = (await page.getByRole('region', { name: 'Who pays whom' }).boundingBox())!;
	const owners = (await page.getByRole('region', { name: 'Who gets what' }).boundingBox())!;
	expect(answer.y).toBeLessThan(owners.y);

	// Final screen edits: tap the Car pill, then Alice's card (tap fallback).
	const card = (name: string) =>
		finalRows(page).filter({ has: page.getByRole('heading', { name }) });
	const recheck = page.getByRole('button', { name: 'Re-check' });
	await expect(recheck).toHaveCount(0);
	await page.getByRole('button', { name: 'Car', exact: true }).click();
	await page.getByRole('button', { name: 'Give Car to Alice' }).click();
	await expect(card('Alice')).toContainText('Car');
	// Amounts are never stale: one message replaces them and the payments list.
	await expect(
		page.getByRole('status').filter({ hasText: 'Changed: check with everyone' })
	).toBeVisible();
	await expect(page.getByRole('region', { name: 'Who pays whom' })).toHaveCount(0);
	await expect(finalRows(page).getByText(/^(Pay|Receive) /)).toHaveCount(0);
	await expect(recheck).toBeVisible();

	// Undo restores the agreed split and its amounts.
	await page.getByRole('button', { name: 'Undo changes' }).click();
	await expect(card('Bob')).toContainText('Car');
	await expect(payments).toHaveText(/^Alice pays Bob /);
	await expect(recheck).toHaveCount(0);

	// Drag the House pill onto Bob's card, and the Car onto Alice's.
	const dragTo = async (item: string, name: string) => {
		const from = await page.getByRole('button', { name: item, exact: true }).boundingBox();
		const to = await card(name).boundingBox();
		if (!from || !to) throw new Error('no layout');
		await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
		await page.mouse.down();
		await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
		await page.mouse.up();
	};
	await dragTo('House', 'Bob');
	await expect(card('Bob')).toContainText('House');
	await expect(card('Alice')).not.toContainText('House');
	await dragTo('Car', 'Alice');
	await expect(card('Alice')).toContainText('Car');

	// Re-check runs a normal round on the edited split.
	await recheck.click();
	await expect(page.getByRole('heading', { name: 'Round 1', exact: true })).toBeVisible();
	// After a re-check the stepper shows Rounds, not Start.
	await expect(currentStep(page)).toHaveText(/Rounds · 1$/);
	await expect(groups.nth(0)).toContainText('Car');
	await expect(groups.nth(1)).toContainText('House');
	await tapPlace(page, 'Alice', 0);
	await tapPlace(page, 'Bob', 1);
	await complete.click();
	await expect(card('Alice')).toContainText('Car');
	await expectOnePayment(page);

	// Start over keeps people and items.
	await page.getByRole('button', { name: 'Start over' }).click();
	await expect(itemPill(page, 'House')).toBeVisible();
	await expect(page.getByRole('listitem').filter({ hasText: 'Bob' })).toBeVisible();

	expect(errors).toEqual([]);
});

test('Asset Splitting - Start: claim items by initials, then continue', async ({ page }) => {
	const errors = trackErrors(page);
	await open(page);
	await addPerson(page, 'Alice');
	await addPerson(page, 'Bob');
	await addItem(page, 'Car', '10000');
	await addItem(page, 'House', '50000');
	await addItem(page, 'Lamp', '20');
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await expect(currentStep(page)).toHaveText(/^2\s*Start$/);
	await expect(page.getByRole('list', { name: 'Progress' })).toContainText(/Setup\s\(done\)/);

	// Items in price order, each with one claim toggle per person; no drag targets.
	await expect(page.getByTestId('claim-item')).toHaveText([/House/, /Car/, /Lamp/]);
	const aliceHouse = page.getByRole('button', { name: 'Alice wants House' });
	await expect(aliceHouse).toHaveAttribute('aria-pressed', 'false');
	const box = (await aliceHouse.boundingBox())!;
	expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24);

	// Fair share 30 010 €. Nothing claimed: everyone would roughly receive it.
	const bar = (name: string) => page.getByTestId('start-bar').filter({ hasText: name });
	await expect(bar('Alice')).toContainText(/≈ Receive 30\s010\s€/);
	// Rings carry the person's initials; the hint says nothing is picked yet
	await expect(aliceHouse).toHaveText('A');
	await expect(page.getByTestId('claim-hint')).toHaveText(
		'Tap your initials on each item you want. Nothing is picked yet.'
	);
	await aliceHouse.click();
	await expect(page.getByTestId('claim-hint')).toHaveText(
		'Tap your initials on each item you want.'
	);
	await expect(aliceHouse).toHaveAttribute('aria-pressed', 'true');
	await expect(bar('Alice')).toContainText(/≈ Pay 19\s990\s€/);
	await expect(bar('Alice').getByRole('img')).toHaveAccessibleName(
		/^Alice: items worth 50\s000\s€ of a 30\s010\s€ fair share$/
	);

	// A shared claim counts in full for each claimant.
	await page.getByRole('button', { name: 'Bob wants House' }).click();
	await expect(page.getByRole('button', { name: 'Bob wants House' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(bar('Alice')).toContainText(/≈ Pay 19\s990\s€/);
	await expect(bar('Bob')).toContainText(/≈ Pay 19\s990\s€/);
	await page.getByRole('button', { name: 'Bob wants House' }).click();
	await page.getByRole('button', { name: 'Bob wants Car' }).click();
	await expect(bar('Bob')).toContainText(/≈ Receive 20\s010\s€/);

	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(currentStep(page)).toHaveText(/^3\s*Rounds · 1$/);
	await expect(page.getByRole('heading', { name: 'Round 1', exact: true })).toBeVisible();
	const groups = page.getByTestId('split-group');
	await expect(groups).toHaveCount(2);

	expect(errors).toEqual([]);
});

test('Asset Splitting - item pills follow the price order on every screen', async ({ page }) => {
	const errors = trackErrors(page);
	await open(page);
	await addPerson(page, 'Alice');
	await addPerson(page, 'Bob');
	for (const [name, price] of [
		['Lamp', '20'],
		['House', '50000'],
		['Boat', '3000'],
		['Car', '10000']
	])
		await addItem(page, name, price);
	const order = [/Car/, /Boat/, /Lamp/];
	await expect(page.getByRole('list', { name: 'Items' }).getByRole('listitem')).toHaveText([
		/House/,
		...order
	]);
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await page.getByRole('button', { name: 'Continue' }).click();
	// The price-balanced start: House alone, the rest together.
	const groups = page.getByTestId('split-group');
	await expect(groups.nth(1).locator('.items li')).toHaveText(order);
	await tapPlace(page, 'Alice', 0);
	await tapPlace(page, 'Bob', 1);
	await page.getByRole('button', { name: 'Complete round' }).click();
	await expect(finalRows(page).nth(1).locator('.items li')).toHaveText(order);
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
	await expect(currentStep(page)).toHaveText(/^3\s*Rounds · 2$/);
	await expect(groups.nth(0)).not.toContainText('Over-demanded');

	// Back to setup asks once before it discards the rounds, and keeps the entered prices.
	await page.getByRole('button', { name: 'Back to setup' }).click();
	const discard = page.getByRole('button', { name: 'Discard 1 round and go back' });
	await expect(discard).toBeVisible();
	await expect(currentStep(page)).toHaveText(/Rounds · 2$/);
	await discard.click();
	await expect(page.getByLabel('Person name')).toBeVisible();
	await expect(itemPill(page, 'Car')).toContainText(/10\s000\s€/);
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await page.getByRole('button', { name: 'Continue' }).click();
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
	// The offer stays from the cap onward.
	await sharePick(6);
	await expect(offer).toBeVisible();
	await page.getByRole('button', { name: 'Accept this split' }).click();
	await expect(page.getByRole('heading', { name: 'Everyone keeps their own group' })).toBeVisible();
	await expectOnePayment(page);
	await expect(page.getByText('This is the best split found so far')).toBeVisible();
	expect(errors).toEqual([]);
});

test('Asset Splitting - setup validates input and blocks Start with a reason', async ({ page }) => {
	const errors = trackErrors(page);
	await open(page);
	const start = page.getByRole('button', { name: 'Start', exact: true });
	await expect(currentStep(page)).toHaveText(/^1\s*Setup$/);

	// The empty setup shows only titles, labels and empty fields: no tips, no empty-state lines.
	await expect(page.getByRole('button', { name: /^About / })).toHaveCount(0);
	await expect(page.getByText(/^No (people|items) yet\.$/)).toHaveCount(0);
	for (const label of ['Person name', 'Item description', 'Rough price (€)']) {
		await expect(page.getByLabel(label)).toHaveValue('');
		await expect(page.getByLabel(label)).not.toHaveAttribute('placeholder');
	}

	await page.getByRole('button', { name: 'Add person' }).click();
	await expect(page.getByRole('alert')).toHaveText(/^\W*Enter a name\.$/);
	await addPerson(page, 'Alice');
	await expect(start).toBeDisabled();
	await expect(page.getByText('Add at least 2 people to start.')).toBeVisible();
	// Duplicate names are rejected, ignoring case and spaces.
	await addPerson(page, ' alice ');
	await expect(page.getByText('That name is taken.')).toBeVisible();
	await expect(page.getByRole('button', { name: /^Remove alice/i })).toHaveCount(1);
	await addPerson(page, 'Bob');
	await expect(page.getByText('Add at least 1 item to start.')).toBeVisible();

	await page.getByLabel('Item description').fill('Car');
	await page.getByLabel('Rough price (€)').fill('0');
	await page.getByRole('button', { name: 'Add item' }).click();
	await expect(page.getByText('Enter a price greater than 0.')).toBeVisible();
	// Rejected input stays in the form for correction, and no pill is added.
	await expect(page.getByLabel('Item description')).toHaveValue('Car');
	await expect(page.getByRole('button', { name: 'Remove Car' })).toHaveCount(0);

	await addItem(page, 'Car', '10000');
	// The price field is empty again after an add.
	await expect(page.getByLabel('Rough price (€)')).toHaveValue('');
	// Enter in the price field submits the add-item form.
	await page.getByLabel('Item description').fill('House');
	await page.getByLabel('Rough price (€)').fill('50000');
	await page.getByLabel('Rough price (€)').press('Enter');
	await expect(start).toBeEnabled();
	await addItem(page, 'Boat', '3000');
	await page.getByRole('button', { name: 'Remove Boat' }).click();
	await expect(itemPill(page, 'Boat')).toHaveCount(0);
	await page.getByRole('button', { name: 'Remove Bob' }).click();
	await expect(start).toBeDisabled();
	expect(errors).toEqual([]);
});

test('Asset Splitting - "+" adds and refocuses, and the setup survives a reload', async ({
	page
}) => {
	const errors = trackErrors(page);
	await open(page);
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
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByRole('heading', { name: 'Round 1', exact: true })).toBeVisible();
	await expect(page.getByText(/^Drag your name onto the group/)).toBeVisible();
	expect(errors).toEqual([]);
});

const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const axe = async (page: Page) =>
	(await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze()).violations.map(
		(v) => `${v.id}: ${v.nodes.length} node(s)`
	);

for (const colorScheme of ['light', 'dark'] as const) {
	test(`Asset Splitting - setup, board and final have no WCAG 2.2 AA violations in ${colorScheme}`, async ({
		page
	}) => {
		await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
		await open(page);
		await addPerson(page, 'Alice');
		await addPerson(page, 'Bob');
		await addItem(page, 'House', '50000');
		await addItem(page, 'Car', '10000');
		await addItem(page, 'Lamp', '20');
		expect(await axe(page)).toEqual([]);

		await page.getByRole('button', { name: 'Start', exact: true }).click();
		// Start, with a sole claim and a shared one.
		await page.getByRole('button', { name: 'Alice wants House' }).click();
		await page.getByRole('button', { name: 'Alice wants Car' }).click();
		await page.getByRole('button', { name: 'Bob wants Car' }).click();
		expect(await axe(page)).toEqual([]);
		await page.getByRole('button', { name: 'Continue' }).click();
		await tapPlace(page, 'Alice', 0);
		await tapPlace(page, 'Bob', 0);
		await page.getByRole('button', { name: 'Complete round' }).click();
		await expect(page.getByRole('heading', { name: 'Round 2', exact: true })).toBeVisible();
		await tapPlace(page, 'Alice', 1);
		// A selected chip: the cards are targets.
		await chip(page, 'Bob').click();
		expect(await axe(page)).toEqual([]);

		await page.keyboard.press('Escape');
		await tapPlace(page, 'Bob', 0);
		await page.getByRole('button', { name: 'Complete round' }).click();
		await expect(
			page.getByRole('heading', { name: 'Everyone keeps their own group' })
		).toBeVisible();
		expect(await axe(page)).toEqual([]);
		// An edited final screen, with a pill selected.
		await page.getByRole('button', { name: 'Lamp', exact: true }).click();
		await page.getByRole('button', { name: /^Give Lamp to / }).click();
		await page.getByRole('button', { name: 'Car', exact: true }).click();
		expect(await axe(page)).toEqual([]);
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
	await page.getByRole('button', { name: 'Back to setup' }).click();
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await expect(page.getByTestId('start-bar').first()).toBeVisible();
	expect(await width()).toBeLessThanOrEqual(390);
	await page.getByRole('button', { name: 'Continue' }).click();
	await tapPlace(page, 'Alice', 0);
	await tapPlace(page, 'Bob', 1);
	await page.getByRole('button', { name: 'Complete round' }).click();
	await expect(page.getByRole('heading', { name: 'Everyone keeps their own group' })).toBeVisible();
	expect(await width()).toBeLessThanOrEqual(390);
});

test('Asset Splitting - first screen leads with the task, references in How it works', async ({
	page
}) => {
	await open(page);
	// Everything but the stepper sits in a box: Start and How it works close the Items box.
	const items = page
		.locator('.ui-panel')
		.filter({ has: page.getByRole('heading', { name: 'Items' }) });
	await expect(items.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
	const how = items.locator('details.how');
	await expect(how).toHaveCount(1);
	await expect(how).not.toHaveAttribute('open');
	await expect(page.getByRole('heading', { name: 'References' })).toBeHidden();
	await expect(page.getByRole('link', { name: 'First written up on the blog' })).toBeHidden();
	await how.locator('summary').click();
	await expect(page.getByRole('heading', { name: 'References' })).toBeVisible();
	await expect(how.getByRole('link', { name: 'First written up on the blog' })).toBeVisible();
});

test('Asset Splitting - the flat prototype draws groups and people without inner boxes', async ({
	page
}) => {
	await page.addInitScript(() => localStorage.setItem('proto2', JSON.stringify({ split: 'flat' })));
	await startTwo(page);
	await expect(page.locator('html')).toHaveAttribute('data-split', 'flat');
	/** No border box and no fill: each one is a column under a hairline. */
	const unboxed = (rows: Locator) =>
		rows.evaluateAll((els) =>
			els.map((el) => {
				const css = getComputedStyle(el);
				return (
					css.borderLeftWidth === '0px' &&
					css.borderRightWidth === '0px' &&
					css.borderBottomWidth === '0px' &&
					css.backgroundColor === 'rgba(0, 0, 0, 0)'
				);
			})
		);
	const groups = page.getByTestId('split-group');
	await expect(groups).toHaveCount(2);
	expect(await unboxed(groups)).toEqual([true, true]);
	await expect(page.locator('.ui-panel .ui-panel')).toHaveCount(0);

	await tapPlace(page, 'Alice', 0);
	await tapPlace(page, 'Bob', 1);
	await page.getByRole('button', { name: 'Complete round' }).click();
	await expect(page.getByRole('heading', { name: 'Everyone keeps their own group' })).toBeVisible();
	await expectOnePayment(page);
	expect(await unboxed(finalRows(page))).toEqual([true, true]);
	await expect(page.locator('.ui-panel')).toHaveCount(1);
	await expect(page.locator('.ui-panel details.how')).toHaveCount(1);
});
