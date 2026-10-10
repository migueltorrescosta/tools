/** A tool listed on the index page. `path` is the route directory under src/routes. */
export interface ToolRoute {
	path: string;
	name: string;
	description: string;
}

export const routes: ToolRoute[] = [
	{
		path: '/jwt',
		name: 'JWT Parser',
		description:
			'Decode, encode and verify JSON Web Tokens. View header, payload and signature components.'
	},
	{
		path: '/format',
		name: 'Format Checker',
		description: 'Validate JSON, YAML, XML, Markdown and plain text with detailed error reporting.'
	},
	{
		path: '/cipher',
		name: 'Encrypter/Decrypter',
		description:
			'Encrypt and decrypt messages using AES-GCM, AES-CBC, RSA-OAEP, Base64, Hex, and ROT13.'
	},
	{
		path: '/wordle',
		name: 'Wordle Solver',
		description:
			'Solver for the Wordle game. Enter the color results from the game and get suggested next words.'
	},
	{
		path: '/split',
		name: 'Asset Splitting',
		description:
			'Fair division tool for splitting assets among people. Interactive algorithm for equitable asset allocation.'
	},
	{
		path: '/timelines',
		name: 'Timelines',
		description:
			'Explore different timelines with upcoming and past events. View European elections and key EU milestones.'
	},
	{
		path: '/volt',
		name: 'Volt',
		description:
			'Timeline of current and former elected representatives of the pan-European political party Volt Europa.'
	},
	{
		path: '/volt-ga',
		name: 'Volt GA Bratislava 2026',
		description:
			'Schedule of the Volt Europa General Assembly in Bratislava. Browse sessions by room, search, and share your favorites.'
	},
	{
		path: '/rank-vote',
		name: 'Rank Vote',
		description:
			'Ranked-choice voting tool for small groups. Create a ballot, share a link, and tally results with Borda count.'
	},
	{
		path: '/verb-conjugator',
		name: 'Verb Conjugator',
		description:
			'Conjugation revision for Italian, Spanish and Portuguese verbs. Practice verb tenses with spaced recall and track your progress.'
	},
	{
		path: '/decision-tree',
		name: 'Decision Tree',
		description:
			'Navigate decision trees one answer at a time. Choose a car or find your religion through an interactive question flow.'
	},
	{
		path: '/company-trends',
		name: 'Company Trends',
		description:
			'Animated log-log trajectories of revenue vs operating expenses for 30+ companies since 2000, normalized to EUR with per-point sources.'
	},
	{
		path: '/warhammer-simulator',
		name: 'Warhammer Simulator',
		description:
			'Monte Carlo duel probability calculator for Warhammer: The Old World. Simulate character duels with dice-level resolution.'
	}
];
