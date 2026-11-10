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
	const tallyURL = page.url();
	return { tallyURL, voteURL: tallyURL.replace('#tally=', '#vote=') };
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

/** Replace the paste box's text, opening "Add or edit votes" first when it is closed. */
async function pasteVotes(page: Page, text: string) {
	const box = page.getByLabel('Votes, one per line');
	if (!(await box.isVisible())) await page.getByText('Add or edit votes').click();
	await box.fill(text);
}

/** The cells of the first-ranked row in the First Past The Post table. */
const fptpFirstCells = (page: Page) =>
	page
		.getByRole('table', { name: 'First Past The Post' })
		.getByRole('row')
		.nth(1)
		.getByRole('cell');

/** The answer card's heading ("Sushi wins"). */
const answerHeading = (page: Page) => page.getByRole('heading', { level: 3 }).first();

/** No share sheet, so Send my vote copies its message. */
async function withoutShareSheet(page: Page) {
	await page.addInitScript(() => {
		Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true });
	});
}

test('create, vote, tally: the pasted code decides the winner', async ({ page }) => {
	const { voteURL } = await createBallot(page);
	await expect(answerHeading(page)).toHaveText('No votes yet');
	// A new ballot opens the paste box straight away
	await expect(page.getByLabel('Votes, one per line')).toBeVisible();

	// Ranking starts Pizza, Sushi, Tacos; moving Sushi up puts it first
	const code = await castVote(page, voteURL, 1);

	await page.getByRole('link', { name: '← Tally' }).click();
	await expect(page).toHaveURL(/#tally=/);
	await pasteVotes(page, `Ann ${code}`);

	await expect(page.getByTestId('vote-count')).toHaveText('1 vote');
	await expect(page.getByTestId('voter-names')).toHaveText('· Ann');
	await expect(answerHeading(page)).toHaveText('Sushi wins');
	await expect(page.getByTestId('answer')).toHaveText(
		'Sushi beats every other choice head to head.'
	);

	// The four tables fold under one line
	const fptp = page.getByRole('table', { name: 'First Past The Post' });
	await expect(fptp).toBeHidden();
	await page.getByText('Compare counting methods').click();
	await expect(fptpFirstCells(page).nth(0)).toHaveText('1');
	await expect(fptpFirstCells(page).nth(1)).toHaveText('Sushi');
});

test('shows "0 votes" and names the lines it cannot read', async ({ page }) => {
	const { voteURL, tallyURL } = await createBallot(page);
	await expect(page.getByTestId('vote-count')).toHaveText('0 votes');

	const code = await castVote(page, voteURL, 2);
	await page.goto(tallyURL);
	await hydrated(page);

	// Change the first character: the check symbol must catch it
	const typo = (code[0] === '0' ? '1' : '0') + code.slice(1);
	await pasteVotes(page, `Ann ${code}\n\nBob ${typo}\nthanks!`);
	await expect(page.getByTestId('paste-status')).toHaveText(
		'1 vote read · 2 lines not recognised (lines 3, 4)'
	);
	await expect(page.getByText(`Line 3: Bob ${typo}`)).toBeVisible();
	await expect(page.getByTestId('vote-count')).toHaveText('1 vote');

	// Fixing the line clears the warning
	await pasteVotes(page, `Ann ${code}\nBob ${code}`);
	await expect(page.getByTestId('paste-status')).toHaveText('2 votes read');
});

test('pasted votes survive a reload and a trip to the vote page', async ({ page }) => {
	const { voteURL, tallyURL } = await createBallot(page);
	const first = await castVote(page, voteURL, 1);
	const second = await castVote(page, voteURL, 2);

	await page.goto(tallyURL);
	await hydrated(page);
	const text = `Ann ${first}\nBob ${second}\nnot a vote`;
	await pasteVotes(page, text);
	await expect(page.getByTestId('vote-count')).toHaveText('2 votes');

	await page.reload();
	await hydrated(page);
	// With votes saved, the box starts folded behind its summary line
	await expect(page.getByTestId('voter-names')).toHaveText('· Ann, Bob');
	await expect(page.getByLabel('Votes, one per line')).toBeHidden();
	await page.getByText('Add or edit votes').click();
	await expect(page.getByLabel('Votes, one per line')).toHaveValue(text);

	await page.goto(voteURL);
	await hydrated(page);
	await page.getByRole('link', { name: '← Tally' }).click();
	await expect(page.getByTestId('vote-count')).toHaveText('2 votes');
});

test('Send my vote copies a message that the paste box reads back', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await withoutShareSheet(page);
	const { voteURL, tallyURL } = await createBallot(page);
	const code = await castVote(page, voteURL, 1);

	await page.getByRole('button', { name: 'Send my vote' }).click();
	const message = `My vote for Lunch: ${code}`;
	await expect(page.getByRole('status').filter({ hasText: 'Copied' })).toContainText(message);
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(message);

	// Pasted whole, with a chat prefix, and again later under the same name: one vote from Cat
	await page.goto(tallyURL);
	await hydrated(page);
	await pasteVotes(page, `${message}\nCat: ${message}\n[10:32] Cat: ${message}`);
	await expect(page.getByTestId('vote-count')).toHaveText('3 votes');
	await pasteVotes(page, `${message}\nCat: ${message}\nCat ${code}`);
	await expect(page.getByTestId('vote-count')).toHaveText('2 votes');
	await expect(page.getByTestId('voter-names')).toHaveText('· Voter 1, Cat');
	await expect(page.getByText('A later line replaces the earlier vote from Cat.')).toBeVisible();
	await expect(answerHeading(page)).toHaveText('Sushi wins');
});

test('Send my vote opens the share sheet when there is one', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(Navigator.prototype, 'share', {
			configurable: true,
			value: async (data: ShareData) => {
				(window as unknown as { shared: string }).shared = data.text ?? '';
			}
		});
	});
	const { voteURL } = await createBallot(page);
	const code = await castVote(page, voteURL, 2);
	await page.getByRole('button', { name: 'Send my vote' }).click();
	await expect
		.poll(() => page.evaluate(() => (window as unknown as { shared?: string }).shared))
		.toBe(`My vote for Lunch: ${code}`);
	await expect(page.getByText('Copied')).toHaveCount(0);
});

test('the copy icon copies the vote link and shows a tick', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	const { voteURL } = await createBallot(page);
	await expect(page.getByRole('button', { name: 'Vote yourself' })).toHaveCount(0);
	const copy = page.getByRole('button', { name: 'Copy vote link' });
	await expect(copy).toHaveAttribute('title', 'Copy vote link');
	await copy.click();
	await expect(page.getByRole('status').filter({ hasText: /^Copied$/ })).toBeAttached();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(voteURL);
	// The tick goes back to the copy icon after two seconds
	await expect(page.getByRole('status').filter({ hasText: /^Copied$/ })).toHaveCount(0, {
		timeout: 4000
	});
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
