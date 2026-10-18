import { expect, test, type Page } from '@playwright/test';
import electedOfficials from '../../../lib/data/elected_officials.json' with { type: 'json' };
import { computeStats, summaryBars } from '../../../lib/volt';

/** Load the page and wait until it has hydrated, so filter clicks are not lost. */
async function open(page: Page) {
	await page.goto('/volt');
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
}

function filters(page: Page) {
	return page.getByRole('group', { name: 'Filter by country' }).getByRole('button');
}

function filterButton(page: Page, label: string) {
	return page.getByRole('button', { name: new RegExp(`^${label}, \\d+ representatives$`) });
}

async function buttonCount(page: Page, label: string): Promise<number> {
	const name = await filterButton(page, label).getAttribute('aria-label');
	return Number(/, (\d+) representatives$/.exec(name ?? '')?.[1]);
}

const bars = (page: Page) => page.getByTestId('volt-bar');
const countries = (page: Page) => page.getByTestId('volt-country');
// Named people only; group placeholder rows ("Volt X candidates") are drawn but not counted
const personBars = (page: Page) => bars(page).filter({ hasNotText: /candidates|^\s*Volt / });

test('Volt Representatives - page loads correctly', async ({ page }) => {
	await open(page);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Volt');
	await expect(page.getByTestId('volt-timeline')).toBeVisible();
});

test('Volt - every filter shows exactly as many people as its button says', async ({ page }) => {
	await open(page);
	const names = await filters(page).evaluateAll((els) =>
		els.map((el) => el.getAttribute('aria-label') ?? '')
	);
	const labels = names.map((n) => n.replace(/, \d+ representatives$/, ''));
	// All + one per country present in the data + MEPs
	const dataBars = summaryBars(computeStats(electedOfficials));
	expect(labels.length).toBe(dataBars.length);

	for (const label of labels) {
		const button = filterButton(page, label);
		const expected = await buttonCount(page, label);
		expect(expected, `${label} button count`).toBe(dataBars.find((b) => b.label === label)?.count);

		await button.click();
		await expect(button).toHaveAttribute('aria-pressed', 'true');
		if (label !== 'All') await expect(countries(page)).toHaveCount(1);
		await expect(personBars(page), `${label} bar count`).toHaveCount(expected);
	}
});

test('Volt - filtering keeps the other buttons at their unfiltered counts', async ({ page }) => {
	await open(page);
	const netherlands = await buttonCount(page, 'Netherlands');
	const germany = await buttonCount(page, 'Germany');
	const countriesBefore = await countries(page).count();
	expect(countriesBefore).toBeGreaterThan(1);

	const germanyButton = filterButton(page, 'Germany');
	await germanyButton.click();
	await expect(germanyButton).toHaveAttribute('aria-pressed', 'true');
	await expect(countries(page)).toHaveCount(1);
	await expect(personBars(page)).toHaveCount(germany);
	expect(await buttonCount(page, 'Netherlands')).toBe(netherlands);
	await expect(filterButton(page, 'All')).toHaveAttribute('aria-pressed', 'false');

	await filterButton(page, 'All').click();
	await expect(countries(page)).toHaveCount(countriesBefore);
});

test('Volt - every gantt bar links externally over http(s)', async ({ page }) => {
	await open(page);
	const links = bars(page);
	await expect(links.first()).toBeVisible();
	const attrs = await links.evaluateAll((els) =>
		els.map((a) => ({
			href: a.getAttribute('href') ?? '',
			target: a.getAttribute('target'),
			rel: a.getAttribute('rel') ?? ''
		}))
	);
	// One link per bundled row, group placeholders included
	expect(attrs.length).toBe(electedOfficials.length);
	for (const a of attrs) {
		expect(a.href).toMatch(/^https?:\/\//);
		expect(a.target).toBe('_blank');
		expect(a.rel).toMatch(/noopener noreferrer/);
	}
});

test('Volt - bars expose their dates and a today line is drawn', async ({ page }) => {
	await open(page);
	const firstBar = bars(page).first();
	const label = await firstBar.getAttribute('aria-label');
	expect(label).toMatch(/: \d{2}\/\d{2}\/\d{4}|: \d{2}\/\d{4}|: \d{4}/);
	await expect(firstBar).toHaveAttribute('title', label ?? '');
	// The today line is labelled in the axis, not by colour alone
	await expect(page.getByText('Today', { exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: /\(former\)$/ }).first()).toBeAttached();
});

test('Volt - bar links are at least 24px tall', async ({ page }) => {
	await open(page);
	const heights = await bars(page).evaluateAll((els) =>
		els.map((el) => el.getBoundingClientRect().height)
	);
	expect(Math.min(...heights)).toBeGreaterThanOrEqual(24);
});

for (const width of [375, 1280]) {
	test(`Volt - year markers line up with bars at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await open(page);
		await filterButton(page, 'Germany').click();
		// Köln mandates start on 1 January 2025
		const bar = bars(page).filter({ hasText: 'Jennifer Glashagen' });
		const marker = page.getByText('2025', { exact: true });
		const barBox = await bar.boundingBox();
		const markerBox = await marker.boundingBox();
		expect(barBox).not.toBeNull();
		expect(markerBox).not.toBeNull();
		expect(Math.abs(barBox!.x - markerBox!.x)).toBeLessThanOrEqual(2);
	});
}
