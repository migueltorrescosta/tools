import type { Reference } from '$lib/ui';

/** The work behind the information pricing tool: a short reference, its link, and what it changed here. */
export const REFERENCES: readonly Reference[] = [
	{
		cite: 'Raiffa, H. & Schlaifer, R. (1961).',
		title: 'Applied statistical decision theory.',
		venue: 'Division of Research, Harvard Business School.',
		href: 'https://archive.org/details/appliedstatistic0000raif',
		impact:
			'Where opportunity loss and the expected value of perfect information first got their names and their maths.'
	},
	{
		cite: 'Howard, R. A. (1966).',
		title: 'Information value theory.',
		venue: 'IEEE Transactions on Systems Science and Cybernetics 2(1).',
		href: 'https://doi.org/10.1109/TSSC.1966.300074',
		impact:
			'Information is worth what it saves you on the decision, and never more than knowing everything.'
	},
	{
		cite: 'Hubbard, D. W. (2010).',
		title: 'How to measure anything: Finding the value of "intangibles" in business (2nd ed.).',
		venue: 'Wiley.',
		href: 'https://doi.org/10.1002/9781118983836',
		impact:
			'The pitch for this tool: price a measurement by the expected opportunity loss it removes before you pay for it.'
	},
	{
		cite: "Brennan, A., Kharroubi, S., O'Hagan, A. & Chilcott, J. (2007).",
		title:
			'Calculating partial expected value of perfect information via Monte Carlo sampling algorithms.',
		venue: 'Medical Decision Making 27(4).',
		href: 'https://doi.org/10.1177/0272989X07302555',
		impact:
			'The value of learning one input, done the slow way with simulations inside simulations.'
	},
	{
		cite: 'Strong, M. & Oakley, J. E. (2013).',
		title:
			'An efficient method for computing single-parameter partial expected value of perfect information.',
		venue: 'Medical Decision Making 33(6).',
		href: 'https://doi.org/10.1177/0272989X12465123',
		impact:
			'Sort the scenarios by one input, cut them into groups and pick the best decision per group: one simulation is enough.'
	},
	{
		cite: 'Sadatsafavi, M., Bansback, N., Zafari, Z., Najafzadeh, M. & Marra, C. (2013).',
		title:
			'Need for speed: An efficient algorithm for calculation of single-parameter expected value of partial perfect information.',
		venue: 'Value in Health 16(2).',
		href: 'https://doi.org/10.1016/j.jval.2012.10.018',
		impact:
			'Another take on the same shortcut, confirming that grouping the samples you already have gives good answers fast.'
	},
	{
		cite: 'Breiman, L., Friedman, J. H., Olshen, R. A. & Stone, C. J. (1984).',
		title: 'Classification and regression trees.',
		venue: 'Wadsworth (reissued by Chapman & Hall/CRC).',
		href: 'https://doi.org/10.1201/9781315139470',
		impact:
			'The policy tree grows the classic way: try every cut on every input and keep the best one.'
	},
	{
		cite: 'Athey, S. & Wager, S. (2021).',
		title: 'Policy learning with observational data.',
		venue: 'Econometrica 89(1).',
		href: 'https://doi.org/10.3982/ECTA15732',
		impact:
			'Why a simple rule that picks a decision per situation, judged by its average regret, is the right thing to learn.'
	},
	{
		cite: 'Zhou, Z., Athey, S. & Wager, S. (2023).',
		title: 'Offline multi-action policy learning: Generalization and optimization.',
		venue: 'Operations Research 71(1).',
		href: 'https://doi.org/10.1287/opre.2022.2271',
		impact: 'Shallow trees that choose among many decisions, checked on scenarios they never saw.'
	},
	{
		cite: 'Hörmann, W. (1993).',
		title: 'The generation of binomial random variates.',
		venue: 'Journal of Statistical Computation and Simulation 46(1–2).',
		href: 'https://doi.org/10.1080/00949659308811496',
		impact: 'Counts are drawn exactly and quickly, even for large numbers of trials.'
	}
];
