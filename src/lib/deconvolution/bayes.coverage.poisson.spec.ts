import { it } from 'vitest';
import { atLeast, coverage } from './bayes.coverage';

it('Bayesian coverage: Poisson signal + normal noise, 50 runs', { timeout: 900_000 }, () => {
	const { bayes } = coverage(
		{ family: 'poisson', params: [4] },
		{ family: 'normal', params: [0, 0.4] },
		400,
		50
	);
	atLeast(bayes, 45);
});
