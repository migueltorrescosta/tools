import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Routes on the shared UI (epic migueltorrescosta/tools#20). Each migration batch adds its routes.
const MIGRATED = [
	'/',
	'/jwt',
	'/format',
	'/cipher',
	'/wordle',
	'/split',
	'/decision-tree',
	'/symbolic-regression',
	'/rank-vote',
	'/verb-conjugator',
	'/warhammer-simulator',
	// A fixed timeline: without ?t the page picks one at random.
	'/timelines?t=llm-breakthroughs'
];
const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const colorScheme of ['light', 'dark'] as const) {
	for (const path of MIGRATED) {
		test(`a11y - ${path} has no WCAG 2.2 AA violations in ${colorScheme}`, async ({ page }) => {
			await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
			await page.goto(path, { waitUntil: 'networkidle' });
			const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
			expect(violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
		});
	}
}
