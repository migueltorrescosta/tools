/**
 * Preset models: the babslell notebooks' distribution-centre and airline
 * share-buyback models, the Portuguese IRC rate path, and a blank starting
 * point. No DOM or Svelte imports.
 */
import { DEFAULT_SAMPLES, type Model } from './types';

export type PresetId = 'distribution-centre' | 'airline-share-buyback' | 'portuguese-irc' | 'blank';

export interface Preset {
	id: PresetId;
	/** Display name in the picker. */
	name: string;
	model: Model;
}

const SEED = 2026;

/** Fleet size under uncertain demand, profit per package and maintenance cost. */
const distributionCentre: Model = {
	inputs: [
		{ symbol: 'N', name: 'Packages per Year', family: 'lognormal', params: [5_000_000, 0.4] },
		{ symbol: 'P', name: 'Profit per Package', family: 'exponential', params: [2.5] },
		{ symbol: 'C', name: 'Yearly cost per Truck', family: 'uniform', params: [80_000, 320_000] },
		{ symbol: 'T', name: 'Packages per Truck per Year', family: 'fixed', params: [100_000] }
	],
	intermediates: [],
	decisions: {
		symbol: 't',
		values: [30, 40, 50, 60, 70],
		label: '{t} trucks',
		reward: 'min(N, t*T)*P - t*C',
		unit: '€'
	},
	seed: SEED,
	samples: DEFAULT_SAMPLES
};

/** Buyback spend against liquidity, over a 5-year horizon, in millions of euros. */
const airlineShareBuyback: Model = {
	inputs: [
		{ symbol: 'R', name: 'Share Return', family: 'lognormal', params: [1.35, 0.1] },
		{ symbol: 'K', name: 'Kilometers Flown', family: 'lognormal', params: [2.5e8, 0.35] },
		{ symbol: 'F', name: 'Fuel Cost per km', family: 'uniform', params: [1, 3.5] },
		{ symbol: 'Lr', name: 'Loan Rate', family: 'uniform', params: [0.04, 0.18] },
		{ symbol: 'p', name: 'Net revenue per km', family: 'uniform', params: [1.5, 5.5] },
		{ symbol: 'i', name: 'Interest Rate', family: 'uniform', params: [0, 0.06] },
		{ symbol: 'C0', name: 'Cash Balance', family: 'fixed', params: [600] }
	],
	intermediates: [
		{ symbol: 'Rev', name: 'Operating Revenue', formula: 'K*p' },
		{ symbol: 'Fuel', name: 'Fuel Bill', formula: 'K*F' },
		{ symbol: 'Delta', name: 'Net Operating Cash Flow', formula: 'Rev - Fuel' },
		{ symbol: 'L', name: 'Liquidity', formula: 'C0 - b + Delta/1e6' }
	],
	decisions: {
		symbol: 'b',
		values: [500, 600, 700, 800, 900, 1000],
		label: '{b} M€',
		reward: 'b*R + (L >= 0 ? L*(1+i)^5 : L*(1+Lr)^5)',
		unit: 'M€'
	},
	seed: SEED,
	samples: DEFAULT_SAMPLES
};

/**
 * Portugal's corporate tax (IRC) rate path, in millions of euros. Lei 64/2025
 * sets 19% in 2026, 18% in 2027 and 17% in 2028; each option below 19% cuts a
 * point a year until it reaches its rate. Year k is 2025 + k. The reward is the
 * general-government balance 2026-35 plus the 2035 effects (tax on the extra
 * GDP minus the lost IRC) over `A` discounted years, the 2035 net cost standing in for every later year. Sources: OE2026 report
 * (2026 IRC revenue 9,532 M€, about 300 M€ per point), INE (2025 GDP 307 bn€),
 * and the Gechert-Heimberger meta-analysis for the growth effect, whose
 * bias-corrected mean is near zero.
 */
const portugueseIrc: Model = {
	inputs: [
		{
			symbol: 'S',
			name: 'IRC revenue per point in 2026 (M€)',
			family: 'triangular',
			params: [250, 300, 400]
		},
		{
			symbol: 'b',
			name: 'Share of the cost a wider base recovers',
			family: 'beta',
			params: [2, 5]
		},
		{
			symbol: 'c',
			name: 'Share of a cut collected in its own year',
			family: 'uniform',
			params: [0.3, 1]
		},
		{ symbol: 'g', name: 'Yearly growth of the IRC base', family: 'normal', params: [0.04, 0.04] },
		{
			symbol: 'e',
			name: 'Extra GDP growth per point (pp a year)',
			family: 'triangular',
			params: [0, 0.005, 0.06]
		},
		{ symbol: 'n', name: 'Nominal GDP growth', family: 'normal', params: [0.04, 0.01] },
		{ symbol: 'i', name: 'Interest rate on new debt', family: 'uniform', params: [0.02, 0.04] },
		{
			symbol: 'A',
			name: 'Discounted years the 2035 effects last',
			family: 'uniform',
			params: [5, 20]
		},
		{ symbol: 'B0', name: 'Balance 2026-35 at 19% (M€)', family: 'normal', params: [0, 15000] },
		{ symbol: 'Y0', name: 'GDP in 2025 (M€)', family: 'fixed', params: [307000] },
		{ symbol: 't', name: 'Revenue per euro of extra GDP', family: 'fixed', params: [0.43] }
	],
	intermediates: [
		{ symbol: 'x2', name: 'Points below 19% in 2027', formula: '19 - max(r, 18)' },
		{ symbol: 'x3', name: 'Points below 19% in 2028', formula: '19 - max(r, 17)' },
		{ symbol: 'x4', name: 'Points below 19% in 2029', formula: '19 - max(r, 16)' },
		{ symbol: 'x5', name: 'Points below 19% from 2030', formula: '19 - r' },
		{ symbol: 'k2', name: 'Points collected in 2027', formula: 'c*x2' },
		{ symbol: 'k3', name: 'Points collected in 2028', formula: 'c*x3 + (1-c)*x2' },
		{ symbol: 'k4', name: 'Points collected in 2029', formula: 'c*x4 + (1-c)*x3' },
		{ symbol: 'k5', name: 'Points collected in 2030', formula: 'c*x5 + (1-c)*x4' },
		{ symbol: 'P3', name: 'Point-years of cuts to 2028', formula: 'x2 + x3' },
		{ symbol: 'P4', name: 'Point-years of cuts to 2029', formula: 'P3 + x4' },
		...[5, 6, 7, 8, 9, 10].map((k) => ({
			symbol: `P${k}`,
			name: `Point-years of cuts to ${2025 + k}`,
			formula: `P${k - 1} + x5`
		})),
		{ symbol: 'W', name: 'Net cost per point in 2026 (M€)', formula: 'S*(1-b)' },
		{ symbol: 'E', name: 'Tax per point-year of growth', formula: 't*e/100*Y0' },
		{ symbol: 'N2', name: 'Net cost in 2027 (M€)', formula: 'W*(1+g)*k2 - E*x2*(1+n)^2' },
		...[3, 4, 5, 6, 7, 8, 9, 10].map((k) => ({
			symbol: `N${k}`,
			name: `Net cost in ${2025 + k} (M€)`,
			formula: `W*(1+g)^${k - 1}*${k <= 5 ? `k${k}` : 'x5'} - E*P${k}*(1+n)^${k}`
		})),
		{ symbol: 'D3', name: 'Extra debt end of 2028 (M€)', formula: 'N2*(1+i) + N3' },
		...[4, 5, 6, 7, 8, 9, 10].map((k) => ({
			symbol: `D${k}`,
			name: `Extra debt end of ${2025 + k} (M€)`,
			formula: `D${k - 1}*(1+i) + N${k}`
		}))
	],
	decisions: {
		symbol: 'r',
		values: [19, 18, 17, 16, 15],
		label: 'IRC {r}%',
		reward: 'B0 - D10 - A*N10',
		unit: 'M€'
	},
	seed: SEED,
	samples: DEFAULT_SAMPLES
};

/** One input and two decisions with a trivial reward: a valid model to build on. */
const blank: Model = {
	inputs: [{ symbol: 'X', name: '', family: 'normal', params: [0, 1] }],
	intermediates: [],
	decisions: { symbol: 'd', values: [0, 1], label: 'd = {d}', reward: 'd*X', unit: '€' },
	seed: SEED,
	samples: DEFAULT_SAMPLES
};

/** Every preset, in picker order. Clone a preset's model before editing it (`presetModel`). */
export const PRESETS: readonly Preset[] = [
	{ id: 'distribution-centre', name: 'Distribution centre', model: distributionCentre },
	{ id: 'airline-share-buyback', name: 'Airline share buyback', model: airlineShareBuyback },
	{ id: 'portuguese-irc', name: 'Portuguese IRC rate', model: portugueseIrc },
	{ id: 'blank', name: 'Blank', model: blank }
];

/** The preset the page opens with. */
export const DEFAULT_PRESET: PresetId = 'distribution-centre';

/** A fresh, editable copy of a preset's model. */
export function presetModel(id: PresetId): Model {
	const preset = PRESETS.find((p) => p.id === id);
	if (!preset) throw new Error(`Unknown preset: ${id}`);
	return structuredClone(preset.model);
}

function deepEqual(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true;
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	const ka = Object.keys(a);
	const kb = Object.keys(b);
	if (ka.length !== kb.length) return false;
	return ka.every(
		(k) =>
			Object.hasOwn(b, k) &&
			deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
	);
}

/** The preset `model` equals exactly (seed and samples included), or null for "Custom". */
export function matchPreset(model: Model): PresetId | null {
	return PRESETS.find((p) => deepEqual(p.model, model))?.id ?? null;
}
