/**
 * Expected opportunity loss per decision and the monetary display unit
 * (port of the reference implementation's loss summary and unit scaling).
 */

import type { Scenarios } from '../types';
import { lossMatrix, pairwiseSum } from './numeric';

/** SI prefixes per display exponent (values divide by 10^(3k)). */
export const UNIT_PREFIXES: Readonly<Record<number, string>> = {
	[-6]: 'q',
	[-5]: 'r',
	[-4]: 'p',
	[-3]: 'n',
	[-2]: 'µ',
	[-1]: 'm',
	0: '',
	1: 'k',
	2: 'M',
	3: 'G',
	4: 'T',
	5: 'P',
	6: 'E'
};

/**
 * Display exponent k so `value / 10^(3k)` lands in [10, 10 000); 0 for a
 * zero, negative or non-finite value. Clamped to the prefix range ±6.
 */
export function unitExponent(value: number): number {
	if (!Number.isFinite(value) || value <= 0) return 0;
	const k = Math.floor(Math.log10(value / 10) / 3);
	return Math.min(6, Math.max(-6, k));
}

/** SI prefix of an exponent: 1 → `k`, 2 → `M`, 0 → ``. */
export function unitPrefix(exponent: number): string {
	const prefix = UNIT_PREFIXES[exponent];
	if (prefix === undefined) throw new RangeError(`unit exponent ${exponent} is out of range`);
	return prefix;
}

/** Prefix exponents a native unit may already carry, e.g. the `M` of `M€`. */
const NATIVE_PREFIXES: Readonly<Record<string, number>> = { k: 1, M: 2, B: 3, G: 3, T: 4 };

/**
 * The unit values display in. A native prefix folds into the scale, so `€`
 * at exponent 1 is `k€`, `M€` at exponent 1 is `B€` and at −1 is `k€`. Money
 * (a currency-symbol base) uses `B` for 10⁹, anything else the SI `G`.
 * Empty when the native unit is empty.
 */
export function displayedUnit(exponent: number, unit: string): string {
	if (!unit) return '';
	const native = unit.length > 1 ? NATIVE_PREFIXES[unit[0]] : undefined;
	const base = native === undefined ? unit : unit.slice(1);
	const total = exponent + (native ?? 0);
	if (total < -6 || total > 6) return unitPrefix(exponent) + unit;
	const prefix = total === 3 && /^\p{Sc}/u.test(base) ? 'B' : unitPrefix(total);
	return prefix + base;
}

/** A native value in the display unit. */
export function scaledValue(value: number, exponent: number): number {
	return value / 10 ** (3 * exponent);
}

/** Mean opportunity loss per decision, in model order (NumPy pairwise sums). */
export function expectedLosses(s: Scenarios, loss: Float64Array = lossMatrix(s)): Float64Array {
	const D = s.rewards.length;
	const out = new Float64Array(D);
	for (let d = 0; d < D; d++) out[d] = pairwiseSum(loss, d, s.n, D) / s.n;
	return out;
}

export interface LossSummary {
	/** Expected loss per decision, model order, native units. */
	expectedLoss: Float64Array;
	/** Index of the best decision (smallest expected loss, first on ties). */
	best: number;
	/** Index of the worst decision (largest expected loss, first on ties). */
	worst: number;
	/** Exponent the display uses: from the best expected loss with a unit, 0 without one. */
	displayExponent: number;
	/** E.g. `k€`; empty without a native unit. */
	displayedUnit: string;
}

/** Expected loss per decision, best and worst, and the derived display unit. */
export function lossSummary(
	s: Scenarios,
	unit: string,
	loss: Float64Array = lossMatrix(s)
): LossSummary {
	const expectedLoss = expectedLosses(s, loss);
	const D = expectedLoss.length;
	let best = 0;
	let worst = 0;
	for (let d = 1; d < D; d++) {
		if (expectedLoss[d] < expectedLoss[best]) best = d;
		if (expectedLoss[d] > expectedLoss[worst]) worst = d;
	}
	const exponent = unitExponent(expectedLoss[best]);
	return {
		expectedLoss,
		best,
		worst,
		displayExponent: unit ? exponent : 0,
		displayedUnit: displayedUnit(exponent, unit)
	};
}
