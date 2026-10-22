/**
 * Preset models: the babslell notebooks' distribution-centre and airline
 * share-buyback models, and a blank starting point. No DOM or Svelte imports.
 */
import { DEFAULT_SAMPLES, type Model } from './types';

export type PresetId = 'distribution-centre' | 'airline-share-buyback' | 'blank';

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
		{ symbol: 'R', name: 'Share Return', family: 'lognormal', params: [1.35, 0.35] },
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
		values: [0, 250, 500, 750, 1000],
		label: '{b} M€',
		reward: 'b*R + (L >= 0 ? L*(1+i)^5 : L*(1+Lr)^5)',
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
