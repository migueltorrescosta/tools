import { it } from 'vitest';
import { atLeast, coverage } from './bayes.coverage';

it(
	'Bayesian coverage: fringe signal + normal noise of known σ, 50 runs',
	{ timeout: 900_000 },
	() => {
		const { bayes } = coverage(
			{ family: 'fringe', params: [0, 2, 3, 0.8, 0] },
			{ family: 'normal', params: [0, 0.2] },
			1000,
			50,
			[false, true]
		);
		atLeast(bayes, 45);
	}
);
