import { it } from 'vitest';
import { atLeast, coverage } from './bayes.coverage';

it('Bayesian coverage: gamma signal + Laplace noise, 50 runs', { timeout: 900_000 }, () => {
	const { bayes } = coverage(
		{ family: 'gamma', params: [3, 1] },
		{ family: 'laplace', params: [0, 0.5] },
		1000,
		50
	);
	atLeast(bayes, 45);
});
