import { expect, test, type Page } from '@playwright/test';

/** Wait until the page has mounted, so clicks are not lost to hydration. */
async function hydrated(page: Page) {
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
}

/** Create a 3-choice ballot and return its tally and vote URLs. */
async function createBallot(page: Page) {
	await page.goto('/rank-vote');
	await hydrated(page);
	await page.getByLabel('Title').fill('Lunch');
	// The form starts with two choice inputs; add a third and confirm it rendered
	const third = page.getByLabel('Choice 3', { exact: true });
	await expect(async () => {
		if ((await third.count()) === 0) {
			await page.getByRole('button', { name: '+ Add choice' }).click();
		}
		await expect(third).toBeVisible({ timeout: 1000 });
	}).toPass();
	await page.getByLabel('Choice 1', { exact: true }).fill('Pizza');
	await page.getByLabel('Choice 2', { exact: true }).fill('Sushi');
	await page.getByLabel('Choice 3', { exact: true }).fill('Tacos');
	await page.getByRole('button', { name: 'Create ballot' }).click();
	await expect(page).toHaveURL(/#tally=/);
	await expect(page).toHaveTitle('Lunch — Rank Vote');
	const share = page.getByLabel('Vote link');
	await expect(share).toHaveValue(/#vote=/);
	return { tallyURL: page.url(), voteURL: await share.inputValue() };
}

/**
 * Open the vote link (ranking starts Pizza, Sushi, Tacos), move the choice in
 * 0-based row `row` (1 or 2) up one place, and return the resulting code.
 * Row 0's "Move up" is disabled by design.
 */
async function castVote(page: Page, voteURL: string, row: 1 | 2) {
	await page.goto(voteURL);
	await hydrated(page);
	const texts = page.getByRole('list', { name: 'Your ranking' }).getByTestId('ranked-choice');
	// A same-document hash navigation does not reset the ranking: reload to start fresh
	await page.reload();
	await hydrated(page);
	await expect(texts).toHaveText(['Pizza', 'Sushi', 'Tacos']);
	const expected = ['Pizza', 'Sushi', 'Tacos'];
	[expected[row - 1], expected[row]] = [expected[row], expected[row - 1]];
	const moveUp = page.getByRole('button', { name: 'Move up' }).nth(row);
	await expect(moveUp).toBeEnabled();
	await moveUp.click();
	await expect(texts).toHaveText(expected);
	const code = (await page.getByTestId('vote-code').textContent())?.trim() ?? '';
	expect(code).toMatch(/^[0-9A-Z]{2}$/);
	return code;
}

async function addVote(page: Page, name: string, code: string) {
	await page.getByLabel('Name', { exact: true }).fill(name);
	await page.getByLabel('Vote code').fill(code);
	await page.getByRole('button', { name: 'Add', exact: true }).click();
}

/** The cells of the first-ranked row in the First Past The Post table. */
const fptpFirstCells = (page: Page) =>
	page
		.getByRole('table', { name: 'First Past The Post' })
		.getByRole('row')
		.nth(1)
		.getByRole('cell');

/** One voter name per entered vote (the list items also nest each vote's ranking). */
const voteEntries = (page: Page) =>
	page.getByRole('list', { name: 'Entered votes' }).getByTestId('vote-name');

test('create, vote, tally: the entered code decides the FPTP winner', async ({ page }) => {
	const { voteURL } = await createBallot(page);

	// Ranking starts Pizza, Sushi, Tacos; moving Sushi up puts it first
	const code = await castVote(page, voteURL, 1);

	await page.getByRole('link', { name: '← Tally' }).click();
	await expect(page).toHaveURL(/#tally=/);
	await addVote(page, 'Ann', code);

	await expect(page.getByTestId('vote-count')).toHaveText('1 vote');
	await expect(fptpFirstCells(page).nth(0)).toHaveText('1');
	await expect(fptpFirstCells(page).nth(1)).toHaveText('Sushi');
});

test('shows "0 votes" and rejects a mistyped code', async ({ page }) => {
	const { voteURL, tallyURL } = await createBallot(page);
	await expect(page.getByTestId('vote-count')).toHaveText('0 votes');

	const code = await castVote(page, voteURL, 2);
	await page.goto(tallyURL);
	await hydrated(page);

	// Change the first character: the check symbol must catch it
	const typo = (code[0] === '0' ? '1' : '0') + code.slice(1);
	await addVote(page, 'Bob', typo);
	await expect(page.getByRole('alert')).toContainText('Invalid code');
	await expect(voteEntries(page)).toHaveCount(0);
});

test('entered votes survive a reload and a trip to the vote page', async ({ page }) => {
	const { voteURL, tallyURL } = await createBallot(page);
	const first = await castVote(page, voteURL, 1);
	const second = await castVote(page, voteURL, 2);

	await page.goto(tallyURL);
	await hydrated(page);
	await addVote(page, 'Ann', first);
	await addVote(page, 'Bob', second);
	await expect(voteEntries(page)).toHaveCount(2);

	await page.reload();
	await hydrated(page);
	await expect(voteEntries(page)).toHaveCount(2);
	await expect(page.getByTestId('vote-name')).toHaveText(['Ann', 'Bob']);

	await page.goto(voteURL);
	await hydrated(page);
	await page.getByRole('link', { name: '← Tally' }).click();
	await expect(voteEntries(page)).toHaveCount(2);
});

test('keyboard Enter on Remove removes the vote instead of expanding it', async ({ page }) => {
	const { voteURL, tallyURL } = await createBallot(page);
	const first = await castVote(page, voteURL, 1);
	const second = await castVote(page, voteURL, 2);
	await page.goto(tallyURL);
	await hydrated(page);
	await addVote(page, 'Ann', first);
	await addVote(page, 'Bob', second);

	// Expand Bob, then remove Ann by keyboard: Bob must stay the expanded one
	await page.getByRole('button', { name: /^Bob/ }).click();
	await page.getByRole('button', { name: 'Remove vote from Ann' }).focus();
	await page.keyboard.press('Enter');

	await expect(voteEntries(page)).toHaveCount(1);
	await expect(page.getByTestId('vote-name')).toHaveText(['Bob']);
	await expect(page.getByRole('button', { name: /^Bob/ })).toHaveAttribute('aria-expanded', 'true');
});

test('a corrupted ballot link shows an error', async ({ page }) => {
	const { tallyURL } = await createBallot(page);
	await page.goto(tallyURL.replace(/#tally=(.{4})/, '#tally=$1xx'));
	await hydrated(page);
	await expect(page.getByText('Invalid ballot link')).toBeVisible();
	await page.getByRole('link', { name: 'Create a new ballot' }).click();
	await expect(page).toHaveURL(/#create$/);
	await expect(page.getByLabel('Title')).toBeVisible();
});

test('duplicate choices cannot be submitted', async ({ page }) => {
	await page.goto('/rank-vote');
	await hydrated(page);
	await page.getByLabel('Title').fill('Dupes');
	await page.getByLabel('Choice 1', { exact: true }).fill('Pizza');
	await page.getByLabel('Choice 2', { exact: true }).fill(' pizza');
	await expect(page.getByRole('alert')).toContainText('Choices must all be different.');
	await expect(page.getByRole('button', { name: 'Create ballot' })).toBeDisabled();
});

test('page heading and the QR dialog: Esc closes it and focus returns to the trigger', async ({
	page
}) => {
	await createBallot(page);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rank Vote');
	const trigger = page.getByRole('button', { name: 'QR code' });
	await trigger.click();
	const dialog = page.getByRole('dialog', { name: 'Scan to vote' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('img', { name: /QR code/ })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();

	await trigger.click();
	await dialog.getByRole('button', { name: 'Close' }).click();
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();
});
