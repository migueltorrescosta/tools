import type { Reference } from '#lib/ui/index.ts';

/** The work behind the Chaos Game: a short reference, its link, and what it changed here. */
export const REFERENCES: readonly Reference[] = [
	{
		cite: 'Barnsley, M. F. (1988).',
		title: 'Fractals Everywhere.',
		venue: 'Academic Press.',
		href: 'https://doi.org/10.1016/C2013-0-10335-2',
		impact:
			'Named the chaos game and showed it draws the attractor of any contracting set of affine maps, the fern included.'
	},
	{
		cite: 'Numberphile (2017).',
		title: 'Chaos Game.',
		venue: 'YouTube.',
		href: 'https://www.youtube.com/watch?v=kbKtFN71Lfs',
		impact: 'The video behind the original blog post, with the restricted-choice squares.'
	},
	{
		cite: 'Draves, S. & Reckase, E. (2008).',
		title: 'The Fractal Flame Algorithm.',
		venue: 'flam3.com.',
		href: 'https://flam3.com/flame_draves.pdf',
		impact: 'Log-density shading with a gamma, which keeps faint and dense regions both visible.'
	}
];
