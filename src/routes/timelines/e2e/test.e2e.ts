import { expect, test, type Page } from '@playwright/test';
import euElections from '../data/events/eu-elections.json' with { type: 'json' };
import publicHolidays from '../data/events/public-holidays.json' with { type: 'json' };
import llmBreakthroughs from '../data/events/llm-breakthroughs.json' with { type: 'json' };

const topics = (page: Page) => page.getByRole('radiogroup', { name: 'Timeline' });
const topic = (page: Page, name: string) => topics(page).getByRole('radio', { name });
const events = (page: Page) => page.getByTestId('timeline-event');

test('Timelines - loads with dynamic imports', async ({ page }) => {
	await page.goto('/timelines');

	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Timelines');
	await expect(topics(page).getByRole('radio')).toHaveCount(5);

	// Wait for events to load (the initial pick may be rich or non-rich)
	await expect(events(page).first()).toBeVisible({ timeout: 15000 });
});

test('Timelines - switch between timelines', async ({ page }) => {
	await page.goto('/timelines?t=eu-elections');
	// Open the earlier events too, so every bundled event is on the page.
	const fold = page.getByRole('button', { name: /earlier event/ });
	await expect(events(page).first()).toBeVisible({ timeout: 10000 });
	if (await fold.isVisible()) await fold.click();
	const firstTitle = events(page).first().getByRole('link');
	await expect(firstTitle).toBeVisible();
	// Titles can repeat across years (e.g. two Finland presidential elections), so count
	// every row with that title instead of requiring a unique match. The ↗ is not part of it.
	const title = ((await firstTitle.textContent()) ?? '').replace(/↗$/, '');
	const electionTitles = events(page).getByRole('link', { name: title, exact: true });
	// One row per bundled event with that title, no more and no fewer.
	const expectedCards = euElections.filter((e) => e.title === title).length;
	expect(expectedCards).toBeGreaterThanOrEqual(1);
	await expect(electionTitles).toHaveCount(expectedCards);

	await topic(page, 'EU milestones').check();

	// The URL follows the selection, the new timeline renders and the old one is gone.
	await expect(page).toHaveURL(/[?&]t=eu-key-events(&|$)/);
	await expect(page.getByText('Treaty of Rome', { exact: true })).toBeVisible({ timeout: 10000 });
	await expect(electionTitles).toHaveCount(0);

	// Year headings run in ascending order.
	const years = (await page.getByRole('heading', { level: 2 }).allTextContents()).map(Number);
	expect(years.length).toBeGreaterThan(1);
	expect(years).toEqual([...years].sort((x, y) => x - y));
});

test('Timelines - invalid ?t falls back to a timeline and writes it to the URL', async ({
	page
}) => {
	await page.goto('/timelines?t=bogus');
	await expect(events(page).first()).toBeVisible({ timeout: 15000 });
	const selected = await topics(page).getByRole('radio', { checked: true }).getAttribute('value');
	expect(selected).toBeTruthy();
	expect(selected).not.toBe('bogus');
	await expect(page).toHaveURL(new RegExp(`[?&]t=${selected}(&|$)`));
});

test('Timelines - opens on Today and folds the earlier events', async ({ page }) => {
	await page.goto('/timelines?t=eu-elections');
	const today = new Date().toLocaleDateString('en-CA');
	const earlier = euElections.filter((e) => e.date < today);
	const upcoming = euElections.filter((e) => e.date >= today);
	test.skip(earlier.length === 0 || upcoming.length === 0, 'needs both past and upcoming events');

	const fold = page.getByRole('button', { name: /^Show \d+ earlier events? \(/ });
	await expect(fold).toBeVisible({ timeout: 10000 });
	await expect(fold).toContainText(`Show ${earlier.length} earlier`);
	await expect(page.getByTestId('timeline-today')).toBeVisible();
	await expect(events(page)).toHaveCount(upcoming.length);

	// Each description is shown in full on the row; there is no popup.
	const next = [...upcoming].sort((a, b) => (a.date < b.date ? -1 : 1))[0];
	await expect(events(page).first()).toContainText(next.description);

	await fold.click();
	await expect(fold).toHaveCount(0);
	await expect(events(page)).toHaveCount(euElections.length);
	await expect(events(page).first()).toBeFocused();
});

test('Timelines - public holidays show only flag, date and title', async ({ page }) => {
	await page.goto('/timelines?t=public-holidays');
	const today = new Date().toLocaleDateString('en-CA');
	const next = publicHolidays.find((e) => e.date >= today);
	test.skip(!next || next.description !== undefined, 'needs an upcoming holiday without a note');

	const row = events(page).first();
	await expect(row).toBeVisible({ timeout: 15000 });
	const [, m, d] = next!.date.split('-').map(Number);
	const date = new Date(Date.UTC(2000, m - 1, d)).toLocaleDateString('en-GB', {
		day: '2-digit',
		month: 'short',
		timeZone: 'UTC'
	});
	await expect(row).toHaveText(`${next!.emoji} ${date} ${next!.title}`);
});

test('Timelines - verify URL parameter', async ({ page }) => {
	await page.goto('/timelines?t=eu-elections');

	await expect(events(page).first()).toBeVisible({ timeout: 10000 });

	// The chosen topic is checked and its description shows under the chips
	await expect(topic(page, 'Elections')).toBeChecked();
	await expect(page.getByText(/^National elections across European countries/)).toBeVisible();
});

test('Timelines - LLM breakthroughs shows rich rows', async ({ page }) => {
	await page.goto('/timelines?t=llm-breakthroughs');

	const first = llmBreakthroughs[0];
	const firstRow = events(page).first();
	await expect(firstRow).toBeVisible({ timeout: 10000 });

	// Should have an emoji
	await expect(firstRow.getByText(first.emoji, { exact: true })).toBeVisible();

	// Should have a clickable title link opening in a new tab
	const titleLink = firstRow.getByRole('link', { name: first.title, exact: true });
	await expect(titleLink).toBeVisible();
	await expect(titleLink).toHaveAttribute('target', '_blank');

	// Should have a description, and the impact line with its ✦ prefix
	await expect(firstRow.getByText(first.conceptDescription!)).toBeVisible();
	await expect(firstRow.getByText(`✦ ${first.valueAdd}`, { exact: true })).toBeVisible();

	// Rich rows show everything inline, so they have no description button
	await expect(firstRow.getByRole('button')).toHaveCount(0);

	// Year headings are present
	await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
});

test('Timelines - switching to LLM breakthroughs shows rich rows', async ({ page }) => {
	// Start on a known non-rich timeline for deterministic behavior
	await page.goto('/timelines?t=eu-elections');

	await expect(events(page).first()).toBeVisible({ timeout: 10000 });
	await expect(page.getByText(/^✦ /)).toHaveCount(0);

	await topic(page, 'LLMs').check();
	await expect(page).toHaveURL(/[?&]t=llm-breakthroughs(&|$)/);

	// Should now show rich rows (with impact lines) instead of plain rows
	await expect(events(page).first().getByText(/^✦ /)).toBeVisible({ timeout: 15000 });
	await expect(events(page).getByRole('button')).toHaveCount(0);
});
