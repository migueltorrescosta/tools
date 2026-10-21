/** The work behind the split tool: a short reference, its link, and what it changed here. */
export interface Reference {
	cite: string;
	title: string;
	venue: string;
	href: string;
	impact: string;
}

export const REFERENCES: readonly Reference[] = [
	{
		cite: 'Su, F. E. (1999).',
		title: "Rental harmony: Sperner's lemma in fair division.",
		venue: 'American Mathematical Monthly 106(10).',
		href: 'https://ranger.uta.edu/~weems/NOTES6319/PAPERSONE/cake.su.pdf',
		impact:
			'The stopping rule: when everyone picks a different group at the shown amounts, nobody wants to swap.'
	},
	{
		cite: 'Halpern, D. & Shah, N. (2019).',
		title: 'Fair division with subsidy.',
		venue: 'SAGT.',
		href: 'https://www.cs.toronto.edu/~nisarg/papers/subsidy.pdf',
		impact:
			'Fair payments exist only when items go to whoever values them most, and must use each person’s own values; so proposals assign items by estimated value and price each person separately, not at average prices.'
	},
	{
		cite: 'Gal, Y., Mash, M., Procaccia, A. D. & Zick, Y. (2017).',
		title: 'Which is the fairest (rent division) of them all?',
		venue: 'Journal of the ACM 64(6).',
		href: 'https://www.ijcai.org/proceedings/2017/678',
		impact:
			'Among fair payments, pick the one that is best for the worst-off person (maximin), which users rated fairer.'
	},
	{
		cite: 'Peters, D., Procaccia, A. D. & Zhu, D. (2022).',
		title: 'Robust rent division.',
		venue: 'NeurIPS.',
		href: 'https://neurips.cc/virtual/2022/poster/54359',
		impact: 'Payments keep a safety margin scaled by how unsure the model still is.'
	},
	{
		cite: 'Allenby, G. M. & Rossi, P. E. (1998).',
		title: 'Marketing models of consumer heterogeneity.',
		venue: 'Journal of Econometrics 89.',
		href: 'https://doi.org/10.1016/S0304-4076(98)00055-4',
		impact:
			'Values are modelled as a shared part plus a personal part, so one person’s picks also inform everyone else’s estimates.'
	},
	{
		cite: 'Sauré, D. & Vielma, J. P. (2019).',
		title: 'Ellipsoidal methods for adaptive choice-based conjoint analysis.',
		venue: 'Operations Research 67(2).',
		href: 'https://doi.org/10.1287/opre.2018.1790',
		impact:
			'Each pick updates a Gaussian estimate of everyone’s values, replacing the old fixed 10% step.'
	},
	{
		cite: 'Huang, D. & Luo, L. (2016).',
		title:
			'Consumer preference elicitation of complex products using fuzzy support vector machine active learning.',
		venue: 'Marketing Science 35(3).',
		href: 'https://faculty.marshall.usc.edu/lan-Luo/ActiveLearningFinal.pdf',
		impact:
			'A handful of well-chosen choice questions recovers preferences, and sharing information across people helps most early on.'
	},
	{
		cite: 'Boutilier, C., Regan, K. & Viappiani, P. (2009).',
		title: 'Online feature elicitation in interactive optimization.',
		venue: 'ICML.',
		href: 'https://icml.cc/Conferences/2009/papers/427.pdf',
		impact: 'Each round shows the current best split rather than a generic question.'
	},
	{
		cite: 'Lee, M. K. & Baykal, S. (2017).',
		title:
			'Algorithmic mediation in group decisions: Fairness perceptions of algorithmically mediated vs. discussion-based social division.',
		venue: 'CSCW.',
		href: 'https://minlee.ischool.utexas.edu/materials/Publication/2017-CSCW-AlgorithmicMediation_Fairness.pdf',
		impact: 'People pick groups instead of typing values, and picks stay visible to the group.'
	},
	{
		cite: 'Lee, M. K., Jain, A., Cha, H. J., Ojha, S. & Kusbit, D. (2019).',
		title:
			'Procedural justice in algorithmic fairness: Leveraging transparency and outcome control for fair algorithmic mediation.',
		venue: 'CSCW.',
		href: 'https://minlee.ischool.utexas.edu/materials/Publication/2019-CSCW-Al_ProceduralFairness.pdf',
		impact: 'The optional swap-or-adjust step, and plain wording instead of jargon.'
	},
	{
		cite: 'Velez, R. A. (2019).',
		title: 'Expressive mechanisms for equitable rent division on a budget.',
		venue: 'arXiv:1902.02935.',
		href: 'https://arxiv.org/abs/1902.02935',
		impact:
			'Even if people game their picks, the stable outcomes of a fair rule stay fair, so visible picks are acceptable.'
	},
	{
		cite: 'W3C (2023).',
		title: 'Web Content Accessibility Guidelines 2.2, SC 2.5.7 Dragging Movements.',
		venue: '',
		href: 'https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html',
		impact: 'Dragging also works without a drag: tap (or press Enter on) a chip, then a group.'
	}
];
