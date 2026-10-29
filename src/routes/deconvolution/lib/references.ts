import type { Reference } from '$lib/ui';

/** The work behind the deconvolution tool: a short reference, its link, and what it changed here. */
export const REFERENCES: readonly Reference[] = [
	{
		cite: 'Kiefer, J. & Wolfowitz, J. (1956).',
		title:
			'Consistency of the maximum likelihood estimator in the presence of infinitely many incidental parameters.',
		venue: 'Annals of Mathematical Statistics 27(4).',
		href: 'https://doi.org/10.1214/aoms/1177728066',
		impact:
			'The NPMLE: the most likely signal of any shape, which turns out to be a few point masses.'
	},
	{
		cite: 'Koenker, R. & Mizera, I. (2014).',
		title: 'Convex optimization, shape constraints, compound decisions, and empirical Bayes rules.',
		venue: 'Journal of the American Statistical Association 109(506).',
		href: 'https://doi.org/10.1080/01621459.2013.869224',
		impact:
			'Made the NPMLE a convex problem on a grid, with a unique answer and a check that it is optimal.'
	},
	{
		cite: 'Efron, B. (2016).',
		title: 'Empirical Bayes deconvolution estimates.',
		venue: 'Biometrika 103(1).',
		href: 'https://doi.org/10.1093/biomet/asv068',
		impact:
			'g-modeling: a smooth signal from a penalised spline family, fitted by maximum likelihood.'
	},
	{
		cite: 'Narasimhan, B. & Efron, B. (2020).',
		title: 'deconvolveR: A g-modeling program for deconvolution and empirical Bayes estimation.',
		venue: 'Journal of Statistical Software 94(11).',
		href: 'https://doi.org/10.18637/jss.v094.i11',
		impact:
			'The reference implementation behind the g-modeling defaults (5 spline degrees of freedom, c₀ = 1).'
	},
	{
		cite: 'Stefanski, L. A. & Carroll, R. J. (1990).',
		title: 'Deconvolving kernel density estimators.',
		venue: 'Statistics 21(2).',
		href: 'https://doi.org/10.1080/02331889008802238',
		impact:
			'The Fourier kernel estimator: divide the data’s characteristic function by the noise’s.'
	},
	{
		cite: 'Fan, J. (1991).',
		title: 'On the optimal rates of convergence for nonparametric deconvolution problems.',
		venue: 'Annals of Statistics 19(3).',
		href: 'https://doi.org/10.1214/aos/1176348248',
		impact: 'Why normal noise is so hard to undo: the best possible rate is only logarithmic in n.'
	},
	{
		cite: 'Bovy, J., Hogg, D. W. & Roweis, S. T. (2011).',
		title:
			'Extreme deconvolution: inferring complete distribution functions from noisy, heterogeneous and incomplete observations.',
		venue: 'Annals of Applied Statistics 5(2B).',
		href: 'https://doi.org/10.1214/10-AOAS439',
		impact: 'The EM updates for a Gaussian-mixture signal under known normal noise.'
	},
	{
		cite: 'Butucea, C. & Matias, C. (2005).',
		title:
			'Minimax estimation of the noise level and of the deconvolution density in a semiparametric convolution model.',
		venue: 'Bernoulli 11(2).',
		href: 'https://doi.org/10.3150/bj/1116340297',
		impact:
			'When the noise’s scale can be estimated too: only if the signal is rougher than the noise.'
	},
	{
		cite: 'Jeffreys, H. (1946).',
		title: 'An invariant form for the prior probability in estimation problems.',
		venue: 'Proceedings of the Royal Society A 186(1007).',
		href: 'https://doi.org/10.1098/rspa.1946.0056',
		impact:
			'The prior of the Bayesian fit: √det of the Fisher information, here of the observed f_Z.'
	},
	{
		cite: 'Haario, H., Saksman, E. & Tamminen, J. (2001).',
		title: 'An adaptive Metropolis algorithm.',
		venue: 'Bernoulli 7(2).',
		href: 'https://doi.org/10.2307/3318737',
		impact: 'The sampler of the Bayesian fit: random-walk steps shaped by the draws so far.'
	},
	{
		cite: 'Berger, J. O., Bernardo, J. M. & Sun, D. (2015).',
		title: 'Overall objective priors.',
		venue: 'Bayesian Analysis 10(1).',
		href: 'https://doi.org/10.1214/14-BA915',
		impact: 'The Dirichlet(1/m) prior of the NPMLE posterior, objective for grids of many cells.'
	}
];
