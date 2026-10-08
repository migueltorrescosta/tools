import { expect, test, type Page } from '@playwright/test';
import electedOfficials from '../../../lib/data/elected_officials.json' with { type: 'json' };
import { computeStats, summaryBars } from '../../../lib/volt';

/** Load the page and wait until it has hydrated, so filter clicks are not lost. */
async function open(page: Page) {
	await page.goto('/volt');
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
}

function filterButton(page: Page, label: string) {
	return page.locator('.bar-chart .bar-row').filter({
		has: page.locator('.bar-label', { hasText: new RegExp(`\\s${label}$`) })
	});
}

async function buttonCount(page: Page, label: string): Promise<number> {
	return Number(await filterButton(page, label).locator('.bar-value').textContent());
}

// Named people only; group placeholder rows are drawn but not counted
const personBars = '.gantt-container .row-bar:not(.group-entry)';

test('Volt Representatives - page loads correctly', async ({ page }) => {
	await open(page);
	await expect(page.locator('h1')).toHaveText('VOLT REPRESENTATIVES');
	await expect(page.locator('.gantt-container')).toBeVisible();
});

test('Volt - every filter shows exactly as many people as its button says', async ({ page }) => {
	await open(page);
	const labels = await page.locator('.bar-chart .bar-label').allTextContents();
	// All + one per country present in the data + MEPs
	expect(labels.length).toBe(summaryBars(computeStats(electedOfficials)).length);

	for (const raw of labels) {
		const label = raw.trim().split(/\s+/).slice(1).join(' ');
		const button = filterButton(page, label);
		const expected = await buttonCount(page, label);
		expect(expected, `${label} should have at least one person`).toBeGreaterThan(0);

		await button.click();
		await expect(button).toHaveClass(/active/);
		await expect(button).toHaveAttribute('aria-pressed', 'true');
		if (label !== 'All') await expect(page.locator('.gantt-country')).toHaveCount(1);
		await expect(page.locator(personBars), `${label} bar count`).toHaveCount(expected);
	}
});

test('Volt - filtering keeps the other buttons at their unfiltered counts', async ({ page }) => {
	await open(page);
	const netherlands = await buttonCount(page, 'Netherlands');
	const germany = await buttonCount(page, 'Germany');
	const countriesBefore = await page.locator('.gantt-country').count();
	expect(countriesBefore).toBeGreaterThan(1);

	const germanyButton = filterButton(page, 'Germany');
	await germanyButton.click();
	await expect(germanyButton).toHaveClass(/active/);
	await expect(page.locator('.gantt-country')).toHaveCount(1);
	await expect(page.locator(personBars)).toHaveCount(germany);
	expect(await buttonCount(page, 'Netherlands')).toBe(netherlands);
	await expect(filterButton(page, 'All')).toHaveAttribute('aria-pressed', 'false');

	await filterButton(page, 'All').click();
	await expect(page.locator('.gantt-country')).toHaveCount(countriesBefore);
});

test('Volt - every gantt bar links externally over http(s)', async ({ page }) => {
	await open(page);
	const links = page.locator('.gantt-container .bar-link');
	await expect(links.first()).toBeVisible();
	const attrs = await links.evaluateAll((els) =>
		els.map((a) => ({
			href: a.getAttribute('href') ?? '',
			target: a.getAttribute('target'),
			rel: a.getAttribute('rel') ?? ''
		}))
	);
	expect(attrs.length).toBeGreaterThan(0);
	for (const a of attrs) {
		expect(a.href).toMatch(/^https?:\/\//);
		expect(a.target).toBe('_blank');
		expect(a.rel).toMatch(/noopener noreferrer/);
	}
});

test('Volt - bars expose their dates and a today line is drawn', async ({ page }) => {
	await open(page);
	const firstBar = page.locator('.gantt-container .row-bar').first();
	const label = await firstBar.locator('.bar-link').getAttribute('aria-label');
	expect(label).toMatch(/: \d{2}\/\d{2}\/\d{4}|: \d{2}\/\d{4}|: \d{4}/);
	await expect(firstBar).toHaveAttribute('title', label ?? '');
	await expect(page.locator('.today-line').first()).toBeAttached();
	await expect(page.locator('.row-bar.former').first()).toBeAttached();
});

for (const width of [375, 1280]) {
	test(`Volt - year markers line up with bars at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await open(page);
		await filterButton(page, 'Germany').click();
		// Köln mandates start on 1 January 2025
		const bar = page.locator('.row-bar').filter({ hasText: 'Jennifer Glashagen' });
		const marker = page.locator('.year-marker[data-year="2025"]');
		const barBox = await bar.boundingBox();
		const markerBox = await marker.boundingBox();
		expect(barBox).not.toBeNull();
		expect(markerBox).not.toBeNull();
		expect(Math.abs(barBox!.x - markerBox!.x)).toBeLessThanOrEqual(2);
	});
}
