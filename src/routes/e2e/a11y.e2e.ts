import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { routes } from '../../lib/routes';

// Every route, scanned in both themes. Add new tools here.
const ROUTES = [
	'/',
	'/jwt',
	'/format',
	'/cipher',
	'/wordle',
	'/split',
	'/decision-tree',
	'/symbolic-regression',
	'/ancilla-mzi',
	'/rank-vote',
	'/verb-conjugator',
	'/warhammer-simulator',
	// A fixed timeline: without ?t the page picks one at random.
	'/timelines?t=llm-breakthroughs',
	'/volt',
	'/company-trends'
];
const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const colorScheme of ['light', 'dark'] as const) {
	for (const path of ROUTES) {
		test(`a11y - ${path} has no WCAG 2.2 AA violations in ${colorScheme}`, async ({ page }) => {
			await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
			await page.goto(path, { waitUntil: 'networkidle' });
			const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
			expect(violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
		});
	}
}

// WCAG 1.4.10 Reflow: no page scrolls sideways on a 390px phone (wide charts scroll inside their own box).
for (const path of ROUTES) {
	test(`a11y - ${path} fits a 390px screen without horizontal scrolling`, async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(path, { waitUntil: 'networkidle' });
		const width = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(width).toBeLessThanOrEqual(390);
	});
}

test('a11y - every tool in routes.ts is scanned', () => {
	const scanned = ROUTES.map((path) => path.split('?')[0]).sort();
	expect(scanned).toEqual(['/', ...routes.map((route) => route.path)].sort());
});
