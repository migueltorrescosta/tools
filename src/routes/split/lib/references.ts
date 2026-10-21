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
			'Each pick updates a Gaussian estimate of everyone’s values, so steps shrink as the estimate firms up.'
	},
	{
		cite: 'Saha, A. & Gopalan, A. (2019).',
		title: 'Active ranking with subset-wise preferences.',
		venue: 'AISTATS.',
		href: 'https://arxiv.org/abs/1810.10321',
		impact:
			'Picking one winner from a bigger menu does not cut the rounds needed, so rounds show one group per person.'
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
		impact:
			'Letting people move items on the final screen and re-check raised perceived fairness; plain wording instead of jargon.'
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
		cite: 'Hosseini, H., Kavner, J., Sikdar, S., Vaish, R. & Xia, L. (2022).',
		title: 'Epistemic vs. counterfactual fairness in allocation of resources.',
		venue: 'arXiv:2212.04574.',
		href: 'https://arxiv.org/abs/2212.04574',
		impact:
			'People judge a split by whether they would swap, so the result says “nobody would rather swap”.'
	},
	{
		cite: 'W3C (2023).',
		title: 'Web Content Accessibility Guidelines 2.2, SC 2.5.7 Dragging Movements.',
		venue: '',
		href: 'https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html',
		impact: 'Dragging also works without a drag: tap (or press Enter on) a chip, then a group.'
	},
	{
		cite: 'This tool (2026).',
		title: 'Simulation of the Start step, PR #39.',
		venue: '',
		href: 'https://github.com/migueltorrescosta/tools/pull/39',
		impact:
			'No paper covers group-agreed placements; in simulation they raised items with whoever values them most from 54% to 85–95% (2 people, 50 items).'
	}
];
