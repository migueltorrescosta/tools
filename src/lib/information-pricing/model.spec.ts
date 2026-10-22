import { describe, expect, it } from 'vitest';
import {
	compileModel,
	decisionLabels,
	evaluateRow,
	renameSymbol,
	symbolProblem,
	type CompiledModel,
	type ModelError
} from './model';
import { airline, distributionCentre } from './formula/test-helpers';
import type { Model } from './types';

const compiled = (m: Model): CompiledModel => {
	const r = compileModel(m);
	if (!r.ok) throw new Error(JSON.stringify(r.errors));
	return r.compiled;
};
const errors = (m: Model): ModelError[] => {
	const r = compileModel(m);
	if (r.ok) throw new Error('compiled');
	return r.errors;
};
const edit = (m: Model, f: (m: Model) => void): Model => {
	const copy = structuredClone(m);
	f(copy);
	return copy;
};

describe('compileModel: presets', () => {
	it('compiles the distribution centre and evaluates hand-computed rewards', () => {
		const c = compiled(distributionCentre);
		expect(c.labels).toEqual(['8 trucks', '9 trucks', '10 trucks', '11 trucks', '12 trucks']);
		expect(c.slots).toEqual({ inputs: ['N', 'P', 'C'], shared: [] });
		// N = 9,800, P = 3, C = 100: min(9800, 1000 t)·3 − 100 t.
		expect(evaluateRow(c, [9800, 3, 100]).rewards).toEqual([23200, 26100, 28400, 28300, 28200]);
	});

	it('inlines fixed inputs as constants, outside the sampled slots', () => {
		const m = edit(distributionCentre, (m) => {
			// A fixed input between random ones: the random slots stay contiguous.
			m.inputs.splice(1, 0, { symbol: 'Z', name: '', family: 'fixed', params: [2] });
			m.decisions.reward = 'min(N, t*T)*P - t*C*Z';
		});
		const c = compiled(m);
		expect(c.slots.inputs).toEqual(['N', 'P', 'C']);
		expect(c.symbols.get('T')).toEqual({ kind: 'constant', value: 1000 });
		expect(c.symbols.get('Z')).toEqual({ kind: 'constant', value: 2 });
		expect(c.symbols.get('C')).toEqual({ kind: 'input', slot: 2 });
		expect(evaluateRow(c, [9800, 3, 50]).rewards[0]).toBe(8000 * 3 - 8 * 100);
	});

	it('orders the airline intermediates and splits off the per-decision one', () => {
		const c = compiled(airline);
		expect(c.slots).toEqual({
			inputs: ['R', 'K', 'F', 'Lr', 'p', 'i'],
			shared: ['Rev', 'Fuel', 'Delta']
		});
		expect(c.perDecision.map((p) => p.symbol)).toEqual(['L']);
		expect(c.labels[1]).toBe('250 M€');
		// Rev = 7.7e8, Fuel = 7e8, Delta = 7e7, L = 950 − b + 70.
		const { shared, rewards } = evaluateRow(c, [1.4, 3.5e8, 2, 0.1, 2.2, 0.02]);
		[7.7e8, 7e8, 7e7].forEach((v, j) => expect(shared[j]).toBeCloseTo(v, 4));
		const g = 1.02 ** 5;
		expect(rewards[1]).toBeCloseTo(250 * 1.4 + 770 * g, 9);
		expect(rewards[4]).toBeCloseTo(1400 + 20 * g, 9);
		// Negative L uses the loan rate: Rev = 4.8e8, Fuel = 7.2e8, L = 950 − 1000 − 240.
		const low = evaluateRow(c, [1.4, 3e8, 2.4, 0.1, 1.6, 0.02]).rewards[4];
		expect(low).toBeCloseTo(1400 - 290 * 1.1 ** 5, 9);
	});
});

describe('compileModel: errors', () => {
	it('rejects bad, reserved and duplicate symbols', () => {
		const m = edit(distributionCentre, (m) => {
			m.inputs[0].symbol = '1x';
			m.inputs[1].symbol = 'min';
			m.inputs[2].symbol = 'T';
			for (const symbol of ['__proto__', 'constructor', 'and'])
				m.inputs.push({ symbol, name: '', family: 'fixed', params: [1] });
		});
		const es = errors(m);
		expect(es.map((e) => [e.where, e.message])).toEqual(
			expect.arrayContaining([
				[
					{ kind: 'input', index: 0, field: 'symbol' },
					expect.stringContaining('start with a letter')
				],
				[{ kind: 'input', index: 1, field: 'symbol' }, '"min" is a function name'],
				[{ kind: 'input', index: 4, field: 'symbol' }, '"__proto__" is reserved'],
				[{ kind: 'input', index: 5, field: 'symbol' }, '"constructor" is reserved'],
				[{ kind: 'input', index: 6, field: 'symbol' }, '"and" is a keyword']
			])
		);
		// Input 2, renamed T, comes before the fixed input T, so the fixed one is the duplicate.
		expect(es).toContainEqual({
			where: { kind: 'input', index: 3, field: 'symbol' },
			message: '"T" is already declared'
		});
	});

	it('locates unknown symbols and parse errors inside formulas', () => {
		const es = errors(
			edit(airline, (m) => {
				m.intermediates[2].formula = 'K*q';
				m.decisions.reward = 'b*R +';
			})
		);
		expect(es).toEqual([
			{
				where: { kind: 'intermediate', index: 2, field: 'formula' },
				message: 'Unknown symbol "q"',
				start: 2,
				end: 3
			},
			{
				where: { kind: 'reward' },
				message: expect.stringContaining('Expected a number'),
				start: 5,
				end: 5
			}
		]);
	});

	it('marks every intermediate on a cycle, and only those', () => {
		const es = errors(
			edit(airline, (m) => {
				m.intermediates[2].formula = 'K*p + Delta'; // Rev → Delta → Rev
				m.intermediates.push({ symbol: 'S', name: '', formula: 'S + 1' });
			})
		);
		expect(es.map((e) => [e.where, e.message])).toEqual([
			[{ kind: 'intermediate', index: 1, field: 'formula' }, 'Cycle: Delta → Rev → Delta'],
			[{ kind: 'intermediate', index: 2, field: 'formula' }, 'Cycle: Delta → Rev → Delta'],
			[{ kind: 'intermediate', index: 4, field: 'formula' }, 'Cycle: S → S']
		]);
		expect(es[1]).toMatchObject({ start: 6, end: 11 });
	});

	it('checks decision values and labels', () => {
		const es = errors(
			edit(distributionCentre, (m) => {
				m.decisions.values = [8, NaN, 8];
			})
		);
		expect(es).toEqual([
			{
				where: { kind: 'decisions', field: 'values', index: 1 },
				message: 'Must be a finite number'
			},
			{
				where: { kind: 'decisions', field: 'values', index: 2 },
				message: '8 is already a decision'
			}
		]);
		expect(errors(edit(distributionCentre, (m) => (m.decisions.values = [])))[0].message).toBe(
			'Add at least one decision value'
		);
		expect(errors(edit(distributionCentre, (m) => (m.decisions.label = 'trucks')))).toEqual([
			{
				where: { kind: 'decisions', field: 'label' },
				message: 'Labels must differ; put {t} in the template'
			}
		]);
	});

	it('checks parameters are finite and calls the family validator', () => {
		const validator = (family: string, params: number[]) =>
			family === 'uniform' && params[0] >= params[1]
				? [{ index: 1, message: 'high must exceed low' }]
				: [];
		const m = edit(distributionCentre, (m) => {
			m.inputs[0].params[1] = Infinity;
			m.inputs[2].params = [500, 50];
			m.inputs[3].params[0] = NaN;
		});
		expect(compileModel(m, validator)).toEqual({
			ok: false,
			errors: [
				{
					where: { kind: 'input', index: 0, field: 'params', param: 1 },
					message: 'Must be a finite number'
				},
				{
					where: { kind: 'input', index: 2, field: 'params', param: 1 },
					message: 'high must exceed low'
				},
				{
					where: { kind: 'input', index: 3, field: 'params', param: 0 },
					message: 'Must be a finite number'
				}
			]
		});
	});

	it('caps the model at 200 symbols', () => {
		const m = edit(distributionCentre, (m) => {
			for (let k = 0; k < 196; k++)
				m.inputs.push({ symbol: `k${k}`, name: '', family: 'fixed', params: [k] });
		});
		expect(errors(m)).toEqual([
			{ where: { kind: 'model' }, message: expect.stringContaining('this model has 201') }
		]);
		expect(compileModel(edit(m, (m) => m.inputs.pop())).ok).toBe(true);
	});
});

describe('helpers', () => {
	it('symbolProblem', () => {
		expect(symbolProblem('Rev')).toBeNull();
		expect(symbolProblem('_x1')).toBeNull();
		for (const bad of ['', 'a b', 'a.b', 'if', 'not', 'toString', 'hasOwnProperty', '__x', 'NaN'])
			expect(symbolProblem(bad)).not.toBeNull();
	});

	it('decisionLabels falls back to symbol = value', () => {
		expect(
			decisionLabels({ ...distributionCentre.decisions, label: ' ', values: [1, 2.5] })
		).toEqual(['t = 1', 't = 2.5']);
	});

	it('renameSymbol rewrites declarations, formulas and the label', () => {
		const m = renameSymbol(airline, 'b', 'buy');
		expect(m.decisions).toMatchObject({
			symbol: 'buy',
			label: '{buy} M€',
			reward: 'buy*R + (L >= 0 ? L*(1+i)^5 : L*(1+Lr)^5)'
		});
		expect(m.intermediates[0].formula).toBe('C0 - buy + Delta/1e6');
		expect(airline.decisions.symbol).toBe('b');
		expect(compiled(m).labels[1]).toBe('250 M€');

		const cash = renameSymbol(airline, 'C0', 'Cash');
		expect(cash.inputs[6]).toMatchObject({ symbol: 'Cash', family: 'fixed', params: [950] });
		expect(cash.intermediates[0].formula).toBe('Cash - b + Delta/1e6');

		const r = renameSymbol(airline, 'Rev', 'Revenue');
		expect(r.intermediates[2].symbol).toBe('Revenue');
		expect(r.intermediates[1].formula).toBe('Revenue - Fuel');
	});

	it('renameSymbol only renames the declaration when the new name is taken or invalid', () => {
		const taken = renameSymbol(airline, 'Rev', 'Fuel');
		expect(taken.intermediates[2].symbol).toBe('Fuel');
		expect(taken.intermediates[1].formula).toBe('Rev - Fuel');
		expect(renameSymbol(airline, 'Rev', '').intermediates[1].formula).toBe('Rev - Fuel');
	});
});
