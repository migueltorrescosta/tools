import { it } from 'vitest';
import { atLeast, coverage } from './bayes.coverage';

// At n = 50 the Wald intervals cover too (49/50 here): the fit's log and logit scales rescue them.
it(
	'Bayesian coverage: n = 50, gamma signal + normal noise of known σ',
	{ timeout: 900_000 },
	() => {
		const { bayes } = coverage(
			{ family: 'gamma', params: [2, 1] },
			{ family: 'normal', params: [0, 0.5] },
			50,
			50,
			[false, true]
		);
		atLeast(bayes, 45);
	}
);
