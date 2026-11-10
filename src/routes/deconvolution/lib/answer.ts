/**
 * The one sentence that opens the results: what the signal (and the noise)
 * look like, read from the parametric fit, or from a grid estimate's mean and
 * spread when there is no parametric fit.
 */
import type { ParamEstimate } from '#lib/deconvolution/mle.js';

/** A named family with its estimates; `weight` is a mixture component's share. */
export interface Part {
	name: string;
	params: ParamEstimate[];
	weight?: number;
}

export const fmtValue = (v: number, digits = 2) =>
	Number.isFinite(v) ? Number(v.toPrecision(digits)).toLocaleString('en') : '–';

/** "Gamma (k ≈ 3.1, θ ≈ 0.97)": ≈ for a fitted value, = for one held fixed. */
export function partText(p: Part): string {
	const shown = p.params.filter((q) => q.key !== 'weight');
	const inner = shown.map((q) => `${q.label} ${q.fitted ? '≈' : '='} ${fmtValue(q.value)}`);
	const share = p.weight === undefined ? '' : `${Math.round(100 * p.weight)}% `;
	return `${share}${p.name}${inner.length ? ` (${inner.join(', ')})` : ''}`;
}

const joinAnd = (xs: string[]) =>
	xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

/** The signal's parts and the noise's part as two clauses. */
export function fitSentence(
	signal: Part[],
	noise: Part | null
): { x: string; noise: { verb: 'like' | 'held at'; text: string } | null } {
	const x = signal.length === 1 ? partText(signal[0]) : `a mix of ${joinAnd(signal.map(partText))}`;
	if (!noise) return { x, noise: null };
	const verb = noise.params.some((q) => q.fitted) ? 'like' : 'held at';
	return { x, noise: { verb, text: partText(noise) } };
}

/** Mean and standard deviation of masses on evenly spaced nodes. */
export function massMoments(x0: number, h: number, mass: ArrayLike<number>) {
	let total = 0;
	let m1 = 0;
	let m2 = 0;
	for (let j = 0; j < mass.length; j++) {
		const p = Math.max(0, mass[j]);
		const x = x0 + j * h;
		total += p;
		m1 += p * x;
		m2 += p * x * x;
	}
	if (!(total > 0)) return { mean: NaN, sd: NaN };
	const mean = m1 / total;
	return { mean, sd: Math.sqrt(Math.max(0, m2 / total - mean * mean)) };
}

/** Joins the names of the methods picked, e.g. "Parametric MLE and NPMLE (grid)". */
export const methodList = (names: string[]) => (names.length ? joinAnd(names) : 'none picked');
