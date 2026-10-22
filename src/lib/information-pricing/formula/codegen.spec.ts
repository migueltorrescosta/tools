import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { compileModel, evaluateRow, type CompiledModel } from '../model';
import type { Model } from '../types';
import {
	assertGenerated,
	buildKernel,
	compileKernel,
	kernelSource,
	literal,
	slotCount
} from './codegen';
import type { Node } from './ast';
import { evaluate } from './evaluate';
import { parse } from './parse';
import { print } from './print';
import { agrees, airline, distributionCentre, randomTree, strip } from './test-helpers';

const compiled = (m: Model): CompiledModel => {
	const r = compileModel(m);
	if (!r.ok) throw new Error(JSON.stringify(r.errors));
	return r.compiled;
};

/** Random input columns: a mix of integers, zeros, negatives and reals. */
function columns(prng: Prng, nInputs: number, extra: number, n: number): Float64Array[] {
	return Array.from({ length: nInputs + extra }, (_, k) =>
		k >= nInputs
			? new Float64Array(n)
			: Float64Array.from({ length: n }, () => {
					const r = prng.next();
					return r < 0.15 ? 0 : r < 0.4 ? prng.int(7) - 3 : (prng.next() - 0.5) * 20;
				})
	);
}

/** Run the kernel on `n` random rows and compare every column with `evaluateRow`. */
function checkAgainstReference(c: CompiledModel, prng: Prng, n: number) {
	const bad: string[] = [];
	const nIn = c.slots.inputs.length;
	const cols = columns(prng, nIn, c.slots.shared.length, n);
	const rewards = c.values.map(() => new Float64Array(n));
	const kernel = compileKernel(c);
	// Two chunks, as the engine would split rows.
	kernel(cols, rewards, 0, n >> 1);
	kernel(cols, rewards, n >> 1, n);
	for (let i = 0; i < n; i++) {
		const ref = evaluateRow(
			c,
			cols.slice(0, nIn).map((col) => col[i])
		);
		ref.shared.forEach((v, j) => {
			if (!agrees(cols[nIn + j][i], v))
				bad.push(`shared ${j} row ${i}: ${cols[nIn + j][i]} vs ${v}`);
		});
		ref.rewards.forEach((v, d) => {
			if (!agrees(rewards[d][i], v)) bad.push(`reward ${d} row ${i}: ${rewards[d][i]} vs ${v}`);
		});
	}
	expect(bad).toEqual([]);
}

describe('literal', () => {
	it('round-trips every number exactly', () => {
		for (const v of [
			0,
			-0,
			1,
			-1.5,
			0.1,
			1e-300,
			5e-324,
			1.7976931348623157e308,
			-2.5e21,
			Math.PI,
			NaN,
			Infinity,
			-Infinity
		]) {
			const back = new Function(`return ${literal(v)};`)() as number;
			expect(Object.is(back, v)).toBe(true);
		}
	});
});

describe('kernelSource', () => {
	it('emits no user text, only slots, literals and Math calls', () => {
		const src = kernelSource(compiled(airline));
		for (const name of ['Rev', 'Fuel', 'Delta', 'C0', 'Lr', 'K'])
			expect(src).not.toMatch(new RegExp(`\\b${name}\\b`));
		expect(src).toContain('Math.pow(');
		expect(src).toContain('const c6 = cols[6];');
		// Constants and decision values are inlined.
		expect(src).toContain('950');
		expect(src).toContain('750');
		expect(() => assertGenerated(src)).not.toThrow();
	});

	it('writes one shared loop and one fused loop per decision', () => {
		const src = kernelSource(compiled(airline));
		expect(src.match(/for \(/g)).toHaveLength(1 + 5);
		expect(kernelSource(compiled(distributionCentre)).match(/for \(/g)).toHaveLength(5);
	});

	it('refuses source that is not generated', () => {
		for (const bad of [
			'x = 1;',
			'cols.constructor',
			'this',
			'`a`',
			'c0["x"]',
			'globalThis',
			'c0[i] = eval(1);'
		])
			expect(() => buildKernel(`"use strict";\n${bad}`)).toThrow(/codegen/);
		expect(() => buildKernel('return 1;')).toThrow(/preamble/);
	});

	it('exposes the slot layout', () => {
		const c = compiled(airline);
		expect(slotCount(c.slots)).toBe(9);
	});
});

describe('generated kernel', () => {
	it('matches hand-computed preset rewards', () => {
		const c = compiled(distributionCentre);
		const cols = [Float64Array.of(9800, 12000), Float64Array.of(3, 1), Float64Array.of(100, 50)];
		const rewards = c.values.map(() => new Float64Array(2));
		compileKernel(c)(cols, rewards, 0, 2);
		expect(rewards.map((r) => r[0])).toEqual([23200, 26100, 28400, 28300, 28200]);
		expect(rewards.map((r) => r[1])).toEqual([7600, 8550, 9500, 10450, 11400]);

		const a = compiled(airline);
		const aCols = [1.4, 3.5e8, 2, 0.1, 2.2, 0.02]
			.map((v) => Float64Array.of(v))
			.concat([0, 0, 0].map(() => new Float64Array(1)));
		const aRewards = a.values.map(() => new Float64Array(1));
		compileKernel(a)(aCols, aRewards, 0, 1);
		expect(aCols[6][0]).toBeCloseTo(7.7e8, 0);
		expect(aRewards[1][0]).toBeCloseTo(250 * 1.4 + 770 * 1.02 ** 5, 6);
	});

	it('agrees with the reference evaluator on both presets', () => {
		const prng = new Prng(7);
		checkAgainstReference(compiled(distributionCentre), prng, 500);
		checkAgainstReference(compiled(airline), prng, 500);
	});
});

describe('property: random formulas', () => {
	const inputs = ['x', 'y', 'z'];

	it('print → parse is the identity on random trees', () => {
		const prng = new Prng(2026);
		for (let k = 0; k < 500; k++) {
			const tree = randomTree(prng, [...inputs, 'K', 't'], 6);
			const r = parse(print(tree));
			if (!r.ok) throw new Error(`${print(tree)}: ${r.error.message}`);
			expect(strip(r.ast)).toEqual(strip(tree));
		}
	});

	it('the generated loop agrees with the tree-walking evaluator to 1e-12', () => {
		const prng = new Prng(41);
		for (let k = 0; k < 150; k++) {
			const formula = (syms: string[]) => print(randomTree(prng, syms, 5));
			const model: Model = {
				inputs: inputs.map((symbol) => ({ symbol, name: '', family: 'normal', params: [0, 1] })),
				constants: [{ symbol: 'K', value: 2.5, name: '' }],
				intermediates: [
					{ symbol: 'S', name: '', formula: formula(['x', 'y', 'K']) },
					{ symbol: 'P', name: '', formula: formula(['S', 'z', 't']) + ' + t' },
					{ symbol: 'Q', name: '', formula: formula(['S', 'x']) }
				],
				decisions: {
					symbol: 't',
					values: [-1, 0, 2.5],
					label: '{t}',
					reward: formula(['P', 'Q', 'S', 'x', 't', 'K']),
					unit: ''
				},
				seed: 1,
				samples: 1
			};
			const c = compiled(model);
			expect(c.slots.shared).toEqual(['S', 'Q']);
			expect(c.perDecision.map((p) => p.symbol)).toEqual(['P']);
			checkAgainstReference(c, prng, 40);
		}
	});

	it('a single formula agrees directly with evaluate()', () => {
		const prng = new Prng(99);
		for (let k = 0; k < 300; k++) {
			const text = print(randomTree(prng, inputs, 6));
			const model: Model = {
				inputs: inputs.map((symbol) => ({ symbol, name: '', family: 'normal', params: [0, 1] })),
				constants: [],
				intermediates: [],
				decisions: { symbol: 't', values: [0], label: '{t}', reward: text, unit: '' },
				seed: 1,
				samples: 1
			};
			const c = compiled(model);
			const n = 30;
			const cols = columns(prng, 3, 0, n);
			const out = [new Float64Array(n)];
			compileKernel(c)(cols, out, 0, n);
			const ast = (parse(text) as { ok: true; ast: Node }).ast;
			for (let i = 0; i < n; i++) {
				const want = evaluate(ast, (name) => cols[inputs.indexOf(name)][i]);
				expect(agrees(out[0][i], want), `${text} row ${i}: ${out[0][i]} vs ${want}`).toBe(true);
			}
		}
	});
});
