import { expect, test, type Page } from '@playwright/test';
import euElections from '../data/events/eu-elections.json' with { type: 'json' };
import llmBreakthroughs from '../data/events/llm-breakthroughs.json' with { type: 'json' };

const picker = (page: Page) => page.getByLabel('Timeline', { exact: true });
const events = (page: Page) => page.getByTestId('timeline-event');

test('Timelines - loads with dynamic imports', async ({ page }) => {
	await page.goto('/timelines');

	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Timelines');
	await expect(picker(page)).toBeVisible();

	// Wait for events to load (the initial pick may be rich or non-rich)
	await expect(events(page).first()).toBeVisible({ timeout: 15000 });
});

test('Timelines - switch between timelines', async ({ page }) => {
	await page.goto('/timelines?t=eu-elections');
	const firstTitle = events(page).first().getByRole('link');
	await expect(firstTitle).toBeVisible({ timeout: 10000 });
	// Titles can repeat across years (e.g. two Finland presidential elections), so count
	// every row with that title instead of requiring a unique match.
	const title = (await firstTitle.textContent()) ?? '';
	const electionTitles = events(page).getByRole('link', { name: title, exact: true });
	// One row per bundled event with that title, no more and no fewer.
	const expectedCards = euElections.filter((e) => e.title === title).length;
	expect(expectedCards).toBeGreaterThanOrEqual(1);
	await expect(electionTitles).toHaveCount(expectedCards);

	await picker(page).selectOption('eu-key-events');

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
	const selected = await picker(page).inputValue();
	expect(selected).not.toBe('bogus');
	await expect(page).toHaveURL(new RegExp(`[?&]t=${selected}(&|$)`));
});

test('Timelines - focusing a row shows its description', async ({ page }) => {
	await page.goto('/timelines?t=eu-elections');
	const info = events(page).first().getByRole('button');
	await expect(info).toBeVisible({ timeout: 10000 });

	await info.focus();
	const tooltip = page.getByRole('tooltip');
	await expect(tooltip).toBeVisible();
	await expect(tooltip).not.toHaveText('');
	await expect(info).toHaveAttribute('aria-describedby', 'timeline-event-tooltip');
});

test('Timelines - verify URL parameter', async ({ page }) => {
	await page.goto('/timelines?t=eu-elections');

	await expect(events(page).first()).toBeVisible({ timeout: 10000 });

	// Check that the correct timeline is selected
	await expect(picker(page)).toHaveValue('eu-elections');
});

test('Timelines - LLM breakthroughs shows rich rows', async ({ page }) => {
	await page.goto('/timelines?t=llm-breakthroughs');

	const first = llmBreakthroughs[0];
	const firstRow = events(page).first();
	await expect(firstRow).toBeVisible({ timeout: 10000 });

	// Should have an emoji
	await expect(firstRow.getByText(first.emoji, { exact: true })).toBeVisible();

	// Should have a clickable title link opening in a new tab
	const titleLink = firstRow.getByRole('link', { name: first.title });
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

	await expect(events(page).first().getByRole('button')).toBeVisible({ timeout: 10000 });

	await picker(page).selectOption('llm-breakthroughs');

	// Should now show rich rows (with impact lines) instead of plain rows
	await expect(events(page).first().getByText(/^✦ /)).toBeVisible({ timeout: 15000 });
	await expect(events(page).getByRole('button')).toHaveCount(0);
});
