// TeX sources of the metric labels on the Ancilla vs MZI page, typeset with KaTeX
// while the page prerenders (+page.server.ts).

export const EQUATIONS = {
	Rshort: 'R',
	Rfixed: 'R_{\\rm fixed}',
	Rstd: 'R_{\\rm std}',
	deltaRshort: '\\delta R',
	RintShort: 'R_{\\rm int}'
} as const;

export type EquationId = keyof typeof EQUATIONS;
