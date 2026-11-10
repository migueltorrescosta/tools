import { expect, test, type Page } from '@playwright/test';
import electedOfficials from '../../../lib/data/elected_officials.json' with { type: 'json' };
import { computeStats, fractionalYear, summaryBars, visibleMandates } from '../../../lib/volt';

/** Load the page and wait until it has hydrated, so filter clicks are not lost. */
async function open(page: Page) {
	await page.goto('/volt');
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
}

const countrySelect = (page: Page) => page.getByRole('combobox', { name: 'Country' });
const showFormer = (page: Page) => page.getByRole('checkbox', { name: 'Show former mandates' });

/** The option texts, e.g. "Germany (8)". */
async function optionTexts(page: Page): Promise<string[]> {
	return countrySelect(page)
		.locator('option')
		.evaluateAll((els) => els.map((el) => el.textContent?.trim() ?? ''));
}

async function optionCount(page: Page, label: string): Promise<number> {
	const text = (await optionTexts(page)).find((t) => t.startsWith(`${label} (`));
	return Number(/\((\d+)\)$/.exec(text ?? '')?.[1]);
}

async function pick(page: Page, label: string) {
	const text = (await optionTexts(page)).find((t) => t.startsWith(`${label} (`));
	await countrySelect(page).selectOption({ label: text ?? label });
}

// Current mandates by the browser's clock, as the page counts them once hydrated
const today = () => fractionalYear(new Date());

const bars = (page: Page) => page.getByTestId('volt-bar');
const countries = (page: Page) => page.getByTestId('volt-country');
// Named people only; group placeholder rows ("Volt X candidates") are drawn but not counted
const personBars = (page: Page) => bars(page).filter({ hasNotText: /candidates|^\s*Volt / });

test('Volt Representatives - page loads correctly', async ({ page }) => {
	await open(page);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Volt');
	await expect(page.getByTestId('volt-timeline')).toBeVisible();
});

for (const former of [false, true]) {
	test(`Volt - every country option shows exactly as many people as it says (former ${former ? 'shown' : 'hidden'})`, async ({
		page
	}) => {
		await open(page);
		if (former) await showFormer(page).check();
		const texts = await optionTexts(page);
		const labels = texts.map((t) => t.replace(/ \(\d+\)$/, ''));
		// All countries + one per country in the data + the European Parliament
		const shown = visibleMandates(electedOfficials, today(), former);
		const dataBars = summaryBars(computeStats(shown, electedOfficials));
		expect(labels).toEqual(dataBars.map((b) => b.label));

		for (const label of labels) {
			const expected = await optionCount(page, label);
			expect(expected, `${label} option count`).toBe(
				dataBars.find((b) => b.label === label)?.count
			);
			await pick(page, label);
			if (label !== 'All countries') await expect(countries(page)).toHaveCount(1);
			await expect(personBars(page), `${label} bar count`).toHaveCount(expected);
		}
	});
}

test('Volt - picking a country keeps the other options at their counts', async ({ page }) => {
	await open(page);
	await expect(countrySelect(page)).toHaveValue('all');
	const netherlands = await optionCount(page, 'Netherlands');
	const germany = await optionCount(page, 'Germany');
	const countriesBefore = await countries(page).count();
	expect(countriesBefore).toBeGreaterThan(1);

	await pick(page, 'Germany');
	await expect(countries(page)).toHaveCount(1);
	await expect(personBars(page)).toHaveCount(germany);
	expect(await optionCount(page, 'Netherlands')).toBe(netherlands);

	await pick(page, 'All countries');
	await expect(countries(page)).toHaveCount(countriesBefore);
});

test('Volt - former mandates are hidden until asked for', async ({ page }) => {
	await open(page);
	await expect(showFormer(page)).not.toBeChecked();
	await expect(page.getByRole('link', { name: /\(former\)$/ })).toHaveCount(0);
	const current = await bars(page).count();
	const allBefore = await optionCount(page, 'All countries');

	await showFormer(page).check();
	await expect(page.getByRole('link', { name: /\(former\)$/ }).first()).toBeAttached();
	await expect(bars(page)).toHaveCount(electedOfficials.length);
	expect(current).toBeLessThan(electedOfficials.length);
	expect(await optionCount(page, 'All countries')).toBeGreaterThan(allBefore);
	await expect(page.getByText('Former', { exact: true })).toBeVisible();
});

test('Volt - a country with no one in office says so', async ({ page }) => {
	await open(page);
	expect(await optionCount(page, 'Cyprus')).toBe(0);
	await pick(page, 'Cyprus');
	await expect(
		page.getByTestId('volt-timeline').getByText(/No one in office here now/)
	).toBeVisible();
	await showFormer(page).check();
	await expect(personBars(page)).toHaveCount(1);
});

test('Volt - the key names each kind of bar', async ({ page }) => {
	await open(page);
	const key = page.getByRole('list', { name: 'Key' });
	await expect(key.getByText('In office')).toBeVisible();
	await expect(key.getByText(/Council group, size unknown/)).toHaveAttribute(
		'title',
		'Not counted in the totals'
	);
});

test('Volt - every gantt bar links externally over http(s)', async ({ page }) => {
	await open(page);
	await showFormer(page).check();
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
	await expect(page.locator('.volt-today').first()).toBeAttached();
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
		if (width < 600) await page.getByRole('button', { name: 'Timeline view' }).click();
		await pick(page, 'Germany');
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

test('Volt - on a phone the list of people in office comes first', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await open(page);
	const list = page.getByTestId('volt-list');
	await expect(list).toBeVisible();
	await expect(page.getByTestId('volt-timeline')).toBeHidden();
	const person = list.getByRole('link', { name: 'Jennifer Glashagen' });
	await expect(person).toBeVisible();
	await expect(person).toHaveAttribute('target', '_blank');
	await expect(list.getByText(/· Fraktionsvorsitzende/)).toBeVisible();

	await page.getByRole('button', { name: 'Timeline view' }).click();
	await expect(page.getByTestId('volt-timeline')).toBeVisible();
	await expect(list).toBeHidden();
	await page.getByRole('button', { name: 'List view' }).click();
	await expect(list).toBeVisible();
});

test('Volt - on a desktop the timeline shows and the list does not', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await open(page);
	await expect(page.getByTestId('volt-timeline')).toBeVisible();
	await expect(page.getByTestId('volt-list')).toBeHidden();
	await expect(page.getByRole('button', { name: 'Timeline view' })).toBeHidden();
});

test('Volt - at phone width the location gutter stays visible while the timeline scrolls', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await open(page);
	await page.getByRole('button', { name: 'Timeline view' }).click();
	const scroll = page.getByTestId('volt-scroll');
	const edges = page.locator('.ui-scroll-edges');
	await expect(edges).toHaveClass(/more-right/);
	const location = page.locator('.volt-location').first();
	const before = await location.boundingBox();
	await scroll.evaluate((el) => el.scrollTo({ left: 200 }));
	await expect
		.poll(async () => Math.abs(((await location.boundingBox())?.x ?? 0) - (before?.x ?? 0)))
		.toBeLessThanOrEqual(1);
	await scroll.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
	await expect(edges).not.toHaveClass(/more-right/);
});
