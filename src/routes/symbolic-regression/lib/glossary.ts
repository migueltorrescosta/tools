/** Explanations shown in the page's info tooltips. */
export const GLOSSARY = {
	complexity:
		'Nodes in the expression tree: every constant, input, indicator and operator counts 1. Simpler equations are easier to read and tend to generalise better.',
	trainMse: 'Mean squared error on the training rows, after refitting the constants on them.',
	valMse:
		'Mean squared error on the held-out validation rows, which the search never fits constants to.',
	valR2:
		"Share of the target's variance on the validation rows that the equation explains: 1 is a perfect fit, 0 is no better than predicting the mean, below 0 is worse than the mean.",
	valRmse: "Square root of the validation MSE, in the target's own units.",
	score:
		'How fast the log validation MSE drops per extra node against the next simpler equation (PySR’s score). High means the added terms pay off.',
	best: 'Among the equations within 1.5× the lowest validation MSE, the one with the highest score.',
	validation:
		'Share of rows, picked at random by the seed, held back to score the equations. Constants are never fitted to them.',
	inputs:
		'Exclude leaves a column out. Include uses its values as numbers. Categorical treats each distinct value as a level, so equations can use 1_A(column): 1 when the row’s level is in the set A, else 0. Up to 32 levels; past 10 the search slows and may overfit.'
} as const;
