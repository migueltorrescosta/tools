/** The index page's sections, in display order. */
export const TOOL_GROUPS = [
	'Developer',
	'Everyday',
	'Data and politics',
	'Science and simulation'
] as const;
export type ToolGroup = (typeof TOOL_GROUPS)[number];

/** A tool listed on the index page. `path` is the route directory under src/routes. */
export interface ToolRoute {
	path: string;
	name: string;
	/** One plain sentence that fits two lines of a 240px card. */
	description: string;
	group: ToolGroup;
}

export const routes: ToolRoute[] = [
	{
		path: '/jwt',
		name: 'JWT Parser',
		description: 'Read, build and check JSON Web Tokens.',
		group: 'Developer'
	},
	{
		path: '/format',
		name: 'Format Checker',
		description: 'Check JSON, YAML, XML or Markdown for errors.',
		group: 'Developer'
	},
	{
		path: '/cipher',
		name: 'Encrypter/Decrypter',
		description: 'Encrypt and decrypt text with AES, RSA and more.',
		group: 'Developer'
	},
	{
		path: '/wordle',
		name: 'Wordle Solver',
		description: 'Get the next Wordle guess from the tile colours.',
		group: 'Everyday'
	},
	{
		path: '/split',
		name: 'Asset Splitting',
		description: 'Share assets fairly, with small payments to even out.',
		group: 'Everyday'
	},
	{
		path: '/rank-vote',
		name: 'Rank Vote',
		description: 'Run a ranked vote and count it four ways.',
		group: 'Everyday'
	},
	{
		path: '/verb-conjugator',
		name: 'Verb Conjugator',
		description: 'Practise Italian, Spanish and Portuguese verbs.',
		group: 'Everyday'
	},
	{
		path: '/decision-tree',
		name: 'Decision Tree',
		description: 'Answer a few questions to pick a car or a faith.',
		group: 'Everyday'
	},
	{
		path: '/timelines',
		name: 'Timelines',
		description: 'Browse past and upcoming EU events.',
		group: 'Data and politics'
	},
	{
		path: '/volt',
		name: 'Volt',
		description: 'Who holds or held office for Volt Europa.',
		group: 'Data and politics'
	},
	{
		path: '/company-trends',
		name: 'Company Trends',
		description: 'Watch 43 companies’ revenue and margin move since 2000.',
		group: 'Data and politics'
	},
	{
		path: '/warhammer-simulator',
		name: 'Warhammer Simulator',
		description: 'Estimate who wins a Warhammer duel.',
		group: 'Science and simulation'
	},
	{
		path: '/symbolic-regression',
		name: 'Symbolic Regression',
		description: 'Find short equations that fit your CSV.',
		group: 'Science and simulation'
	},
	{
		path: '/ancilla-mzi',
		name: 'Ancilla vs MZI',
		description: 'Test whether an ancilla beats a plain interferometer.',
		group: 'Science and simulation'
	},
	{
		path: '/information-pricing',
		name: 'Information Pricing',
		description: 'Price what knowing more is worth before you decide.',
		group: 'Science and simulation'
	},
	{
		path: '/scientific-derivations',
		name: 'Scientific Derivations',
		description: 'Follow a paper’s derivation step by step.',
		group: 'Science and simulation'
	}
];
