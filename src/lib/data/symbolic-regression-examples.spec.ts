import { describe, it, expect } from 'vitest';
import {
	EXAMPLES,
	NEWTON_G,
	SURCHARGE_ZONES,
	generateNewtonCsv,
	generateShippingCsv
} from './symbolic-regression-examples';
import { parseCsv } from '$lib/symbolic-regression/csv';
import {
	analyzeColumns,
	buildDataset,
	canBeCategorical,
	splitDataset
} from '$lib/symbolic-regression/dataset';

const numeric = (index: number) => ({ index, categorical: false });

function load(id: string) {
	const example = EXAMPLES.find((e) => e.id === id)!;
	const parsed = parseCsv(example.csv);
	const col = (name: string) => parsed.header.indexOf(name);
	return { example, parsed, col };
}

describe('EXAMPLES', () => {
	it('have unique ids', () => {
		expect(new Set(EXAMPLES.map((e) => e.id)).size).toBe(EXAMPLES.length);
	});

	it.each(EXAMPLES.map((e) => [e.id, e] as const))(
		'%s: target and inputs are numeric, categorical inputs within the limit, no row is dropped',
		(_, example) => {
			const parsed = parseCsv(example.csv);
			const columns = analyzeColumns(parsed);
			const index = (name: string) => {
				const c = columns.find((c) => c.name === name);
				expect(c?.numeric, name).toBe(true);
				return c!.index;
			};
			const categorical = (example.categorical ?? []).map((name) => {
				const c = columns.find((c) => c.name === name);
				expect(c && canBeCategorical(c), name).toBe(true);
				return { index: c!.index, categorical: true };
			});
			const built = buildDataset(parsed, index(example.target), [
				...example.inputs.map(index).map(numeric),
				...categorical
			]);
			expect(built.droppedRows).toBe(0);
			expect(built.totalRows).toBeGreaterThan(0);
		}
	);
});

describe('kepler', () => {
	const { parsed, col } = load('kepler');

	it('has about 20 real bodies', () => {
		expect(parsed.rows.length).toBeGreaterThanOrEqual(18);
		expect(parsed.rows.map((r) => r[0])).toContain('Halley');
	});

	it.each(parsed.rows.map((r) => [r[0], r] as const))(
		'%s satisfies T ≈ a^1.5 within 1%',
		(_, r) => {
			const a = Number(r[col('a_AU')]);
			const T = Number(r[col('T_years')]);
			expect(Math.abs(T / a ** 1.5 - 1)).toBeLessThan(0.01);
		}
	);
});

describe('newton-gravity', () => {
	const { example, parsed, col } = load('newton-gravity');

	it('is generated deterministically and kept small', () => {
		expect(example.csv).toBe(generateNewtonCsv());
		expect(parsed.rows.length).toBeLessThanOrEqual(500);
	});

	it('fits the true law within the noise level (validation R² > 0.99)', () => {
		const inputs = ['m1', 'm2', 'r'].map(col).map(numeric);
		const data = splitDataset(buildDataset(parsed, col('F'), inputs), 0.2, 1);
		const { x, y } = data.validation;
		const mean = y.reduce((s, v) => s + v, 0) / y.length;
		let ssRes = 0;
		let ssTot = 0;
		const relErrors: number[] = [];
		y.forEach((v, i) => {
			const f = (NEWTON_G * x[0][i] * x[1][i]) / x[2][i] ** 2;
			ssRes += (v - f) ** 2;
			ssTot += (v - mean) ** 2;
			relErrors.push(Math.abs(v / f - 1));
		});
		expect(1 - ssRes / ssTot).toBeGreaterThan(0.99);
		const rms = Math.sqrt(relErrors.reduce((s, e) => s + e * e, 0) / relErrors.length);
		expect(rms).toBeGreaterThan(0.005);
		expect(rms).toBeLessThan(0.03);
	});
});

describe('shipping', () => {
	const { example, parsed, col } = load('shipping');

	it('is generated deterministically and kept small', () => {
		expect(example.csv).toBe(generateShippingCsv());
		expect(parsed.rows.length).toBeLessThanOrEqual(500);
	});

	it('follows the true law within the noise level', () => {
		for (const r of parsed.rows) {
			const w = Number(r[col('weight_kg')]);
			const f = 4 + 0.8 * w + (SURCHARGE_ZONES.includes(r[col('zone')]) ? 6 : 0);
			expect(Math.abs(Number(r[col('cost')]) / f - 1)).toBeLessThan(0.1);
		}
	});
});
