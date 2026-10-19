/** Saved state and share URLs for the symbolic regression page. No DOM imports. */

import { ALL_OPERATORS, type OperatorName } from './types';

/** Every localStorage key the tool writes starts with this. */
export const STORAGE_PREFIX = 'symbolic-regression:';
export const SETTINGS_KEY = `${STORAGE_PREFIX}settings`;
export const FRONT_KEY = `${STORAGE_PREFIX}front`;
export const DATASET_KEY = `${STORAGE_PREFIX}dataset`;

/** CSV text longer than this (in UTF-16 code units, about 2 MB) is not saved. */
export const MAX_SAVED_CSV_LENGTH = 2_000_000;

/** The settings a share URL carries. Never any user data. */
export interface ShareState {
	operators: OperatorName[];
	target: string | null;
	/** Numeric inputs. */
	inputs: string[];
	/** Categorical inputs. */
	categorical: string[];
	timeBudgetSec: number;
	validationFraction: number;
	seed: number;
	workers: number;
	exampleId: string | null;
}

/** The CSV the page last loaded, saved only when small enough. */
export interface SavedDataset {
	name: string;
	csv: string;
}

export function encodeShareParams(state: ShareState): URLSearchParams {
	const params = new URLSearchParams();
	if (state.exampleId) params.set('example', state.exampleId);
	params.set('ops', state.operators.join(','));
	if (state.target !== null) params.set('target', state.target);
	// Repeated so column names may contain commas
	for (const name of state.inputs) params.append('in', name);
	for (const name of state.categorical) params.append('cat', name);
	params.set('budget', String(state.timeBudgetSec));
	params.set('split', String(state.validationFraction));
	params.set('seed', String(state.seed));
	params.set('workers', String(state.workers));
	return params;
}

function finiteParam(params: URLSearchParams, key: string): number | undefined {
	const raw = params.get(key);
	if (raw === null || raw.trim() === '') return undefined;
	const value = Number(raw);
	return Number.isFinite(value) ? value : undefined;
}

/** Read whatever valid settings the URL holds; absent or invalid ones are left out. */
export function decodeShareParams(params: URLSearchParams): Partial<ShareState> {
	const out: Partial<ShareState> = {};
	const example = params.get('example');
	if (example) out.exampleId = example;
	const ops = params.get('ops');
	if (ops !== null) {
		const known = new Set<string>(ALL_OPERATORS);
		out.operators = ops.split(',').filter((op): op is OperatorName => known.has(op));
	}
	const target = params.get('target');
	if (target !== null) out.target = target;
	if (params.has('in')) out.inputs = params.getAll('in');
	if (params.has('cat')) out.categorical = params.getAll('cat');
	const budget = finiteParam(params, 'budget');
	if (budget !== undefined && budget > 0) out.timeBudgetSec = budget;
	const split = finiteParam(params, 'split');
	if (split !== undefined && split > 0 && split < 1) out.validationFraction = split;
	const seed = finiteParam(params, 'seed');
	if (seed !== undefined && Number.isInteger(seed)) out.seed = seed;
	const workers = finiteParam(params, 'workers');
	if (workers !== undefined && Number.isInteger(workers) && workers >= 1) out.workers = workers;
	return out;
}

/** True when the URL carries any share setting, so it takes priority over saved settings. */
export function hasShareParams(params: URLSearchParams): boolean {
	return ['example', 'ops', 'target', 'in', 'cat', 'budget', 'split', 'seed', 'workers'].some(
		(key) => params.has(key)
	);
}

export function canSaveCsv(csv: string): boolean {
	return csv.length <= MAX_SAVED_CSV_LENGTH;
}
